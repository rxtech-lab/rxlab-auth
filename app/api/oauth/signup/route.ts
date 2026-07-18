import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  oauthClients,
  oauthClientUserRoles,
  users,
  emailVerificationTokens,
} from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { issueOAuthTokenResponse } from "@/lib/oauth/issue-tokens";
import { signupRequestSchema } from "@/lib/validations/oauth";
import { checkSignUpAllowed } from "@/lib/settings/sign-up";
import { generateAvatarSeed } from "@/lib/identicon/generate";
import { sendEmail } from "@/lib/email/resend";
import {
  getVerificationEmailHtml,
  getVerificationEmailText,
} from "@/lib/email/templates";

// POST /api/oauth/signup
//
// Native registration endpoint for first-party clients (e.g. the macOS test app).
// Body (JSON): { client_id, username (email), password, name?, scope? }
//
// Two-mode response:
//   * E2E_SKIP_EMAIL_VERIFICATION=true → user created verified + tokens issued
//     immediately (shape matches POST /api/oauth/token).
//   * otherwise → user created unverified, verification email sent, returns
//     { user_id, email, email_verification_required: true }.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = signupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const email = data.username.toLowerCase();

  // Validate client
  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, data.client_id),
  });
  if (!client) {
    return NextResponse.json(
      { error: "invalid_client", error_description: "Client not found" },
      { status: 401 },
    );
  }

  // First-party / open sign-in clients only. Whitelist clients shouldn't
  // accept native sign-up since the user doesn't exist yet to whitelist.
  if (client.signInPermission !== "all") {
    return NextResponse.json(
      {
        error: "unauthorized_client",
        error_description:
          "Native sign-up is only available for first-party clients",
      },
      { status: 400 },
    );
  }

  // Scope validation (against client's allowed_scopes).
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

  // Global / whitelist sign-up gate.
  const signUpCheck = await checkSignUpAllowed(email);
  if (!signUpCheck.allowed) {
    return NextResponse.json(
      {
        error: "access_denied",
        error_description:
          signUpCheck.reason === "disabled"
            ? "Sign-up is currently disabled"
            : "Sign-up is restricted. Your email is not on the approved list",
      },
      { status: 403 },
    );
  }

  // Reject duplicate email.
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return NextResponse.json(
      {
        error: "user_exists",
        error_description: "An account with this email already exists",
      },
      { status: 409 },
    );
  }

  const userId = crypto.randomUUID();
  const avatarSeed = generateAvatarSeed();
  const now = new Date();
  const passwordHash = await hashPassword(data.password);
  const displayName = data.name || email.split("@")[0];

  const e2eMode = process.env.E2E_SKIP_EMAIL_VERIFICATION === "true";

  try {
    if (e2eMode) {
      // E2E: create verified, no email.
      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          email,
          passwordHash,
          displayName,
          avatarSeed,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        });

        if (client.defaultRoleId) {
          await tx.insert(oauthClientUserRoles).values({
            id: crypto.randomUUID(),
            clientId: client.id,
            userId,
            roleId: client.defaultRoleId,
            createdAt: now,
          });
        }
      });
    } else {
      // Production native flow: create unverified user + send verification email.
      // Mirrors actions/auth/register.ts (the email-verification branch).
      const token = crypto.randomUUID();
      const tokenId = crypto.randomUUID();
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: userId,
          email,
          passwordHash,
          displayName,
          avatarSeed,
          emailVerified: false,
          createdAt: now,
          updatedAt: now,
        });

        if (client.defaultRoleId) {
          await tx.insert(oauthClientUserRoles).values({
            id: crypto.randomUUID(),
            clientId: client.id,
            userId,
            roleId: client.defaultRoleId,
            createdAt: now,
          });
        }

        await tx.insert(emailVerificationTokens).values({
          id: tokenId,
          userId,
          token,
          expiresAt: tokenExpiresAt,
          createdAt: now,
        });

        await sendEmail({
          to: email,
          subject: "Verify your email address",
          html: getVerificationEmailHtml(token),
          text: getVerificationEmailText(token),
        });
      });

      return NextResponse.json(
        {
          user_id: userId,
          email,
          email_verification_required: true,
        },
        { status: 201 },
      );
    }
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to create account" },
      { status: 500 },
    );
  }

  // E2E branch only: issue tokens identical to the authorization_code grant.
  const tokenResponse = await issueOAuthTokenResponse({
    user: {
      id: userId,
      email,
      emailVerified: true,
      displayName,
      username: null,
      avatarSeed,
      avatarUrl: null,
    },
    client,
    scopes: requestedScopes,
  });

  return NextResponse.json(tokenResponse, { status: 201 });
}
