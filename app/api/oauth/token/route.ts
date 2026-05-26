import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  oauthClients,
  oauthConsents,
  oauthRefreshTokens,
  users,
} from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { getOAuthCode, deleteOAuthCode } from "@/lib/redis";
import { verifyCodeChallenge } from "@/lib/oauth/pkce";
import {
  signAccessToken,
  signIdToken,
  generateRefreshToken,
} from "@/lib/oauth/jwt";
import { issueOAuthTokenResponse } from "@/lib/oauth/issue-tokens";
import { parseBasicAuth } from "@/lib/oauth/basic-auth";
import { tokenRequestSchema } from "@/lib/validations/oauth";
import { eq, and, isNull, or, gt } from "drizzle-orm";

// Grace period for refresh token rotation (allows concurrent requests)
const REFRESH_TOKEN_GRACE_PERIOD_MS = 30 * 1000; // 30 seconds

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    // Support client credentials from Authorization header (Basic auth)
    const authHeader = request.headers.get("authorization");
    const basicAuth = parseBasicAuth(authHeader);
    if (basicAuth) {
      // Only use header values if not already in body
      if (!body.client_id) {
        body.client_id = basicAuth.clientId;
      }
      if (!body.client_secret) {
        body.client_secret = basicAuth.clientSecret!;
      }
    }

    // Validate request
    const parsed = tokenRequestSchema.safeParse(body);
    if (!parsed.success) {
      console.log("Token request validation failed:", parsed.error);
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: parsed.error.issues[0]?.message,
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Validate client credentials
    const client = await db.query.oauthClients.findFirst({
      where: eq(oauthClients.id, data.client_id),
    });

    if (!client) {
      console.log("OAuth client not found:", data.client_id);
      return NextResponse.json(
        { error: "invalid_client", error_description: "Client not found" },
        { status: 401 },
      );
    }

    // Check if public client is trying to use client_credentials grant (not allowed)
    if (
      data.grant_type === "client_credentials" &&
      client.clientType === "public"
    ) {
      console.log(
        "Public client attempted client_credentials grant:",
        data.client_id,
      );
      return NextResponse.json(
        {
          error: "unauthorized_client",
          error_description:
            "Public clients cannot use client_credentials grant",
        },
        { status: 400 },
      );
    }

    // Determine if client_secret is required based on client type and grant type
    const requiresSecret =
      client.clientType === "confidential" ||
      data.grant_type === "client_credentials";

    if (requiresSecret) {
      if (!data.client_secret) {
        console.log(
          "Client secret required but not provided for client:",
          data.client_id,
        );
        return NextResponse.json(
          {
            error: "invalid_client",
            error_description: "client_secret is required for this client type",
          },
          { status: 401 },
        );
      }

      if (!client.secret) {
        console.log("Client secret not set for client:", data.client_id);
        return NextResponse.json(
          {
            error: "invalid_client",
            error_description: "Client configuration error",
          },
          { status: 401 },
        );
      }

      const secretValid = await verifyPassword(
        client.secret,
        data.client_secret,
      );
      if (!secretValid) {
        console.log("Invalid client secret for client:", data.client_id);
        return NextResponse.json(
          {
            error: "invalid_client",
            error_description: "Invalid client secret",
          },
          { status: 401 },
        );
      }
    }

    if (data.grant_type === "authorization_code") {
      console.log("Handling authorization code grant");
      return handleAuthorizationCodeGrant(data, client);
    } else if (data.grant_type === "refresh_token") {
      console.log("Handling refresh token grant");
      return handleRefreshTokenGrant(data, client);
    } else if (data.grant_type === "client_credentials") {
      console.log("Handling client credentials grant");
      return handleClientCredentialsGrant(data, client);
    } else if (data.grant_type === "password") {
      console.log("Handling password grant");
      return handlePasswordGrant(data, client);
    }

    console.log("Unsupported grant type:", data);
    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Token endpoint error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Internal server error" },
      { status: 500 },
    );
  }
}

async function handleAuthorizationCodeGrant(
  data: {
    grant_type: "authorization_code";
    code: string;
    redirect_uri: string;
    code_verifier: string;
    client_id: string;
    client_secret?: string;
  },
  client: typeof oauthClients.$inferSelect,
) {
  // Get stored authorization code
  const codeData = await getOAuthCode(data.code);
  if (!codeData) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Authorization code expired or invalid",
      },
      { status: 400 },
    );
  }

  // Validate code belongs to this client
  if (codeData.clientId !== data.client_id) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Code does not belong to this client",
      },
      { status: 400 },
    );
  }

  // Validate redirect URI matches
  if (codeData.redirectUri !== data.redirect_uri) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Redirect URI mismatch" },
      { status: 400 },
    );
  }

  // Verify PKCE
  const pkceValid = verifyCodeChallenge(
    data.code_verifier,
    codeData.codeChallenge,
    codeData.codeChallengeMethod,
  );
  if (!pkceValid) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400 },
    );
  }

  // Delete the code (single use)
  await deleteOAuthCode(data.code);

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, codeData.userId),
  });

  if (!user) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "User not found" },
      { status: 400 },
    );
  }

  // Get granted scopes from database
  const consent = await db.query.oauthConsents.findFirst({
    where: and(
      eq(oauthConsents.userId, user.id),
      eq(oauthConsents.clientId, client.id),
    ),
  });
  const grantedScopes: string[] = consent ? JSON.parse(consent.scopes) : [];

  // Generate tokens
  const scopeString = codeData.scopes.join(" ");

  const accessToken = await signAccessToken({
    sub: user.id,
    client_id: client.id,
    scope: scopeString,
  });

  const idToken = await signIdToken(
    {
      sub: user.id,
      // Email claims based on granted scopes from database
      email: grantedScopes.includes("email") ? user.email : undefined,
      email_verified: grantedScopes.includes("email")
        ? (user.emailVerified ?? false)
        : undefined,
      // Always include profile claims
      name: user.displayName ?? undefined,
      preferred_username: user.username ?? undefined,
      picture: user.avatarUrl || `${process.env.OAUTH_ISSUER_URL}/api/avatar/${user.avatarSeed || user.id}`,
      nonce: codeData.nonce,
      auth_time: Math.floor(Date.now() / 1000),
    },
    client.id,
  );

  // Always generate refresh token
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(oauthRefreshTokens).values({
    id: crypto.randomUUID(),
    token: refreshToken,
    userId: user.id,
    clientId: client.id,
    scopes: JSON.stringify(codeData.scopes),
    expiresAt,
    createdAt: new Date(),
  });

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    id_token: idToken,
    scope: scopeString,
    refresh_token: refreshToken,
  });
}

async function handleRefreshTokenGrant(
  data: {
    grant_type: "refresh_token";
    refresh_token: string;
    client_id: string;
    client_secret?: string;
    scope?: string;
  },
  client: typeof oauthClients.$inferSelect,
) {
  // Find refresh token (allow grace period for concurrent requests)
  const now = new Date();
  const storedToken = await db.query.oauthRefreshTokens.findFirst({
    where: and(
      eq(oauthRefreshTokens.token, data.refresh_token),
      eq(oauthRefreshTokens.clientId, client.id),
      // Token is valid if: not revoked OR revoked but still in grace period
      or(
        isNull(oauthRefreshTokens.revokedAt),
        gt(oauthRefreshTokens.revokedAt, now),
      ),
    ),
  });

  if (!storedToken) {
    console.log("Invalid refresh token for client:", data.client_id);
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Invalid refresh token" },
      { status: 400 },
    );
  }

  // Check expiration
  if (storedToken.expiresAt && storedToken.expiresAt < new Date()) {
    console.log("Refresh token expired for client:", data.client_id);
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Refresh token expired" },
      { status: 400 },
    );
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, storedToken.userId),
  });

  if (!user) {
    console.log("User not found for refresh token, client:", data.client_id);
    return NextResponse.json(
      { error: "invalid_grant", error_description: "User not found" },
      { status: 400 },
    );
  }

  // Get scopes
  const storedScopes: string[] = JSON.parse(storedToken.scopes);
  const requestedScopes = data.scope ? data.scope.split(" ") : storedScopes;

  // Requested scopes must be subset of original scopes
  const validScopes = requestedScopes.every((s) => storedScopes.includes(s));
  if (!validScopes) {
    console.log(
      "Requested scopes exceed original grant for client:",
      data.client_id,
    );
    return NextResponse.json(
      {
        error: "invalid_scope",
        error_description: "Requested scopes exceed original grant",
      },
      { status: 400 },
    );
  }

  const scopeString = requestedScopes.join(" ");

  // Generate new access token
  const accessToken = await signAccessToken({
    sub: user.id,
    client_id: client.id,
    scope: scopeString,
  });

  // Rotate refresh token
  const newRefreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Revoke old token with grace period (allows concurrent requests to still use it briefly)
  await db
    .update(oauthRefreshTokens)
    .set({ revokedAt: new Date(Date.now() + REFRESH_TOKEN_GRACE_PERIOD_MS) })
    .where(eq(oauthRefreshTokens.id, storedToken.id));

  // Create new token
  await db.insert(oauthRefreshTokens).values({
    id: crypto.randomUUID(),
    token: newRefreshToken,
    userId: user.id,
    clientId: client.id,
    scopes: JSON.stringify(requestedScopes),
    expiresAt,
    createdAt: new Date(),
  });

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    refresh_token: newRefreshToken,
    scope: scopeString,
  });
}

async function handleClientCredentialsGrant(
  data: {
    grant_type: "client_credentials";
    client_id: string;
    client_secret?: string;
    scope?: string;
  },
  client: typeof oauthClients.$inferSelect,
) {
  // Get allowed scopes for this client
  const allowedScopes: string[] = JSON.parse(client.allowedScopes);

  // Determine which scopes to grant
  let requestedScopes: string[];
  if (data.scope) {
    // Parse requested scopes
    requestedScopes = data.scope.split(" ").filter(Boolean);

    // Validate requested scopes against allowed scopes
    const invalidScopes = requestedScopes.filter(
      (s) => !allowedScopes.includes(s),
    );
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        {
          error: "invalid_scope",
          error_description: `Requested scope(s) not allowed: ${invalidScopes.join(", ")}`,
        },
        { status: 400 },
      );
    }
  } else {
    // No scope requested - use all allowed scopes
    requestedScopes = allowedScopes;
  }

  const scopeString = requestedScopes.join(" ");

  // Generate access token (no user - use client_id as subject)
  const accessToken = await signAccessToken({
    sub: client.id,
    client_id: client.id,
    scope: scopeString,
  });

  // Return token response (no refresh_token, no id_token for client_credentials)
  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: scopeString,
  });
}

async function handlePasswordGrant(
  data: {
    grant_type: "password";
    username: string;
    password: string;
    client_id: string;
    client_secret?: string;
    scope?: string;
  },
  client: typeof oauthClients.$inferSelect,
) {
  // Gate to first-party clients with open sign-in only.
  // password grant bypasses the web consent UI, so we refuse for any
  // client that has restricted sign-in (none/whitelist).
  if (client.signInPermission !== "all") {
    return NextResponse.json(
      {
        error: "unauthorized_client",
        error_description:
          "password grant is only available for first-party clients",
      },
      { status: 400 },
    );
  }

  // Resolve allowed scopes; default to client's allowed scopes when omitted
  const allowedScopes: string[] = JSON.parse(client.allowedScopes);
  let requestedScopes: string[];
  if (data.scope) {
    requestedScopes = data.scope.split(" ").filter(Boolean);
    const invalidScopes = requestedScopes.filter(
      (s) => !allowedScopes.includes(s),
    );
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        {
          error: "invalid_scope",
          error_description: `Requested scope(s) not allowed: ${invalidScopes.join(", ")}`,
        },
        { status: 400 },
      );
    }
  } else {
    requestedScopes = allowedScopes;
  }

  // Look up user by email (preferred) or username field
  const normalized = data.username.toLowerCase();
  const user = await db.query.users.findFirst({
    where: or(eq(users.email, normalized), eq(users.username, data.username)),
  });

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Invalid username or password",
      },
      { status: 400 },
    );
  }

  const passwordValid = await verifyPassword(user.passwordHash, data.password);
  if (!passwordValid) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Invalid username or password",
      },
      { status: 400 },
    );
  }

  // Enforce email verification (mirrors actions/auth/login.ts)
  if (
    !user.emailVerified &&
    process.env.E2E_SKIP_EMAIL_VERIFICATION !== "true"
  ) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "Email address is not verified",
      },
      { status: 400 },
    );
  }

  const tokenResponse = await issueOAuthTokenResponse({
    user,
    client,
    scopes: requestedScopes,
  });

  return NextResponse.json(tokenResponse);
}
