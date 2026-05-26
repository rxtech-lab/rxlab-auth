import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, passkeys } from "@/lib/db/schema";
import { getWebAuthnChallenge, deleteWebAuthnChallenge } from "@/lib/redis";
import { rpID, expectedOrigins, base64UrlEncode } from "@/lib/webauthn/config";
import { passkeyUpgradeVerifyRequestSchema } from "@/lib/validations/oauth";
import { requireBearerToken } from "@/lib/oauth/bearer";

// POST /api/oauth/passkey/upgrade/verify
//
// Completes the Automatic Passkey Upgrade ceremony. Verifies the attestation
// against the challenge stored under `session_id`, asserts the challenge was
// issued for the same user as the Bearer token, and persists the credential
// against the user. Does NOT create users or issue OAuth tokens — the caller
// is already authenticated.
export async function POST(request: NextRequest) {
  const auth = await requireBearerToken(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = passkeyUpgradeVerifyRequestSchema.safeParse(body);
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
    challengeData.type !== "passkey-upgrade" ||
    challengeData.userId !== auth.payload.sub
  ) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "No upgrade challenge found for this session",
      },
      { status: 400 },
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.payload.sub),
  });
  if (!user) {
    await deleteWebAuthnChallenge(data.session_id);
    return NextResponse.json(
      { error: "invalid_token", error_description: "User not found" },
      { status: 401 },
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
    console.error("Passkey upgrade verify error:", error);
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

  // Reject if this credential ID is already registered (defense-in-depth;
  // excludeCredentials in /options should normally prevent this).
  const existing = await db.query.passkeys.findFirst({
    where: eq(passkeys.id, cred.id),
  });
  if (existing) {
    await deleteWebAuthnChallenge(data.session_id);
    return NextResponse.json(
      {
        error: "credential_exists",
        error_description: "This passkey is already registered",
      },
      { status: 409 },
    );
  }

  const transportsArr = (data.credential.response as { transports?: string[] })
    .transports;

  await db.insert(passkeys).values({
    id: cred.id,
    userId: user.id,
    name: data.name || "Passkey",
    publicKey: base64UrlEncode(cred.publicKey),
    counter: cred.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports:
      transportsArr && Array.isArray(transportsArr)
        ? JSON.stringify(transportsArr)
        : null,
    createdAt: new Date(),
  });

  await deleteWebAuthnChallenge(data.session_id);

  return NextResponse.json(
    { ok: true, credential_id: cred.id },
    { status: 201 },
  );
}
