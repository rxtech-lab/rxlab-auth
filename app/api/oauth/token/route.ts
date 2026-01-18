import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { oauthClients, oauthConsents, oauthRefreshTokens, users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { getOAuthCode, deleteOAuthCode } from "@/lib/redis";
import { verifyCodeChallenge } from "@/lib/oauth/pkce";
import {
  signAccessToken,
  signIdToken,
  generateRefreshToken,
} from "@/lib/oauth/jwt";
import { tokenRequestSchema } from "@/lib/validations/oauth";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    // Validate request
    const parsed = tokenRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: parsed.error.issues[0]?.message,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate client credentials
    const client = await db.query.oauthClients.findFirst({
      where: eq(oauthClients.id, data.client_id),
    });

    if (!client) {
      return NextResponse.json(
        { error: "invalid_client", error_description: "Client not found" },
        { status: 401 }
      );
    }

    const secretValid = await verifyPassword(client.secret, data.client_secret);
    if (!secretValid) {
      return NextResponse.json(
        { error: "invalid_client", error_description: "Invalid client secret" },
        { status: 401 }
      );
    }

    if (data.grant_type === "authorization_code") {
      return handleAuthorizationCodeGrant(data, client);
    } else if (data.grant_type === "refresh_token") {
      return handleRefreshTokenGrant(data, client);
    }

    return NextResponse.json(
      { error: "unsupported_grant_type" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Token endpoint error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Internal server error" },
      { status: 500 }
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
    client_secret: string;
  },
  client: typeof oauthClients.$inferSelect
) {
  // Get stored authorization code
  const codeData = await getOAuthCode(data.code);
  if (!codeData) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Authorization code expired or invalid" },
      { status: 400 }
    );
  }

  // Validate code belongs to this client
  if (codeData.clientId !== data.client_id) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Code does not belong to this client" },
      { status: 400 }
    );
  }

  // Validate redirect URI matches
  if (codeData.redirectUri !== data.redirect_uri) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Redirect URI mismatch" },
      { status: 400 }
    );
  }

  // Verify PKCE
  const pkceValid = verifyCodeChallenge(
    data.code_verifier,
    codeData.codeChallenge,
    codeData.codeChallengeMethod
  );
  if (!pkceValid) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400 }
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
      { status: 400 }
    );
  }

  // Get granted scopes from database
  const consent = await db.query.oauthConsents.findFirst({
    where: and(
      eq(oauthConsents.userId, user.id),
      eq(oauthConsents.clientId, client.id)
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
      email_verified: grantedScopes.includes("email") ? user.emailVerified ?? false : undefined,
      // Always include profile claims
      name: user.displayName ?? undefined,
      preferred_username: user.username ?? undefined,
      picture: `${process.env.OAUTH_ISSUER_URL}/api/avatar/${user.avatarSeed || user.id}`,
      nonce: codeData.nonce,
      auth_time: Math.floor(Date.now() / 1000),
    },
    client.id
  );

  // Generate refresh token if offline_access scope
  let refreshToken: string | undefined;
  if (codeData.scopes.includes("offline_access")) {
    refreshToken = generateRefreshToken();
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
  }

  const response: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    id_token: idToken,
    scope: scopeString,
  };

  if (refreshToken) {
    response.refresh_token = refreshToken;
  }

  return NextResponse.json(response);
}

async function handleRefreshTokenGrant(
  data: {
    grant_type: "refresh_token";
    refresh_token: string;
    client_id: string;
    client_secret: string;
    scope?: string;
  },
  client: typeof oauthClients.$inferSelect
) {
  // Find refresh token
  const storedToken = await db.query.oauthRefreshTokens.findFirst({
    where: and(
      eq(oauthRefreshTokens.token, data.refresh_token),
      eq(oauthRefreshTokens.clientId, client.id),
      isNull(oauthRefreshTokens.revokedAt)
    ),
  });

  if (!storedToken) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Invalid refresh token" },
      { status: 400 }
    );
  }

  // Check expiration
  if (storedToken.expiresAt && storedToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Refresh token expired" },
      { status: 400 }
    );
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, storedToken.userId),
  });

  if (!user) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "User not found" },
      { status: 400 }
    );
  }

  // Get scopes
  const storedScopes: string[] = JSON.parse(storedToken.scopes);
  const requestedScopes = data.scope ? data.scope.split(" ") : storedScopes;

  // Requested scopes must be subset of original scopes
  const validScopes = requestedScopes.every((s) => storedScopes.includes(s));
  if (!validScopes) {
    return NextResponse.json(
      { error: "invalid_scope", error_description: "Requested scopes exceed original grant" },
      { status: 400 }
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

  // Revoke old token
  await db
    .update(oauthRefreshTokens)
    .set({ revokedAt: new Date() })
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
