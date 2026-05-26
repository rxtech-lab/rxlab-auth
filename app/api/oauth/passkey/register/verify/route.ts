import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, passkeys } from "@/lib/db/schema";
import { getWebAuthnChallenge, deleteWebAuthnChallenge } from "@/lib/redis";
import { rpID, expectedOrigins, base64UrlEncode } from "@/lib/webauthn/config";
import { generateAvatarSeed } from "@/lib/identicon/generate";
import { passkeyRegisterVerifyRequestSchema } from "@/lib/validations/oauth";
import {
  validateClientRedirect,
  resolveRequestedScopes,
} from "@/lib/oauth/native-client";
import { issueOAuthTokenResponse } from "@/lib/oauth/issue-tokens";

// POST /api/oauth/passkey/register/verify
//
// Native passkey registration completion: verifies the attestation against
// the pending-user challenge from /options, creates the user + passkey, and
// returns OAuth tokens. Mirrors /api/oauth/signup's E2E branch but uses a
// passkey as the credential instead of a password.
//
// The user is created already-verified — the WebAuthn challenge proves the
// caller controls a device, and there is no password to recover, so the
// email-verification gate is unnecessary for this flow.
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

  const parsed = passkeyRegisterVerifyRequestSchema.safeParse(body);
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

  const challengeData = await getWebAuthnChallenge(data.session_id);
  if (
    !challengeData ||
    challengeData.type !== "native-registration" ||
    challengeData.clientId !== data.client_id ||
    !challengeData.pendingEmail ||
    !challengeData.userId
  ) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "No registration challenge found",
      },
      { status: 400 },
    );
  }

  // Re-validate the redirect_uri persisted on the challenge against the
  // client's current allow-list (defense-in-depth).
  const clientCheck = await validateClientRedirect({
    clientId: data.client_id,
    redirectUri: challengeData.redirectUri,
  });
  if (!clientCheck.ok) return clientCheck.response;
  const client = clientCheck.client;

  const scopeCheck = resolveRequestedScopes(data.scope, client);
  if (!scopeCheck.ok) return scopeCheck.response;
  const requestedScopes = scopeCheck.scopes;

  // Re-check that the email wasn't taken between options and verify.
  const existing = await db.query.users.findFirst({
    where: eq(users.email, challengeData.pendingEmail),
  });
  if (existing) {
    await deleteWebAuthnChallenge(data.session_id);
    return NextResponse.json(
      {
        error: "user_exists",
        error_description: "An account with this email already exists",
      },
      { status: 409 },
    );
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: data.credential as Parameters<
        typeof verifyRegistrationResponse
      >[0]["response"],
      expectedChallenge: challengeData.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
    });
  } catch (error) {
    console.error("Passkey register verify error:", error);
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Verification failed" },
      { status: 400 },
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Verification failed" },
      { status: 400 },
    );
  }

  const {
    credential: cred,
    credentialDeviceType,
    credentialBackedUp,
  } = verification.registrationInfo;

  const userId = challengeData.userId;
  const email = challengeData.pendingEmail;
  const displayName = challengeData.pendingDisplayName || email.split("@")[0];
  const avatarSeed = generateAvatarSeed();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email,
      passwordHash: null,
      displayName,
      avatarSeed,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(passkeys).values({
      id: cred.id,
      userId,
      name: "Passkey",
      publicKey: base64UrlEncode(cred.publicKey),
      counter: cred.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports:
        (data.credential.response as { transports?: string[] }).transports &&
        Array.isArray(
          (data.credential.response as { transports?: string[] }).transports,
        )
          ? JSON.stringify(
              (data.credential.response as { transports: string[] })
                .transports,
            )
          : null,
      createdAt: now,
    });
  });

  await deleteWebAuthnChallenge(data.session_id);

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
