import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, passkeys, oauthClientUserRoles } from "@/lib/db/schema";
import { getWebAuthnChallenge, deleteWebAuthnChallenge } from "@/lib/redis";
import { rpID, expectedOrigins, base64UrlEncode } from "@/lib/webauthn/config";
import { generateAvatarSeed } from "@/lib/identicon/generate";
import { passkeyAccountCreationVerifyRequestSchema } from "@/lib/validations/oauth";
import {
  validateClientRedirect,
  resolveRequestedScopes,
} from "@/lib/oauth/native-client";
import { issueOAuthTokenResponse } from "@/lib/oauth/issue-tokens";
import { checkSignUpAllowed } from "@/lib/settings/sign-up";
import { normalizeContactIdentifier } from "@/lib/oauth/contact-identifier";

// POST /api/oauth/passkey/account-creation/verify
//
// Completes the iOS 26 / macOS 26 ASAuthorizationAccountCreationProvider
// flow. The system sheet has now returned the contact_identifier (email
// or phone) along with the attestation. We verify the attestation against
// the challenge, normalize/validate the identifier, create the user row
// (marked verified — Apple's flow is system-confirmed), persist the
// passkey, and issue OAuth tokens.
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

  const parsed = passkeyAccountCreationVerifyRequestSchema.safeParse(body);
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
    challengeData.type !== "passkey-account-creation" ||
    challengeData.clientId !== data.client_id ||
    !challengeData.userId
  ) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "No account-creation challenge found",
      },
      { status: 400 },
    );
  }

  // Re-validate the stored redirect_uri against the client's current
  // allow-list (defense-in-depth, matches register/verify).
  const clientCheck = await validateClientRedirect({
    clientId: data.client_id,
    redirectUri: challengeData.redirectUri,
  });
  if (!clientCheck.ok) return clientCheck.response;
  const client = clientCheck.client;

  const scopeCheck = resolveRequestedScopes(data.scope, client);
  if (!scopeCheck.ok) return scopeCheck.response;
  const requestedScopes = scopeCheck.scopes;

  const normalized = normalizeContactIdentifier(
    data.contact_identifier,
    data.contact_identifier_type,
  );
  if (!normalized.ok) {
    return NextResponse.json(
      { error: "invalid_request", error_description: normalized.reason },
      { status: 400 },
    );
  }

  // Apply the sign-up gate now that we know the identifier (covers the
  // whitelist case the /options step couldn't check).
  const signUpCheck = await checkSignUpAllowed(normalized.storageEmail);
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

  // Reject if another user already claimed this identifier.
  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalized.storageEmail),
  });
  if (existing) {
    await deleteWebAuthnChallenge(data.session_id);
    return NextResponse.json(
      {
        error: "user_exists",
        error_description: "An account with this identifier already exists",
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
    console.error("Passkey account-creation verify error:", error);
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
  const displayName =
    data.name || normalized.storageEmail.split("@")[0] || "User";
  const avatarSeed = generateAvatarSeed();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      email: normalized.storageEmail,
      passwordHash: null,
      displayName,
      avatarSeed,
      emailVerified: normalized.emailVerified,
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

  await deleteWebAuthnChallenge(data.session_id);

  const tokenResponse = await issueOAuthTokenResponse({
    user: {
      id: userId,
      email: normalized.storageEmail,
      emailVerified: normalized.emailVerified,
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
