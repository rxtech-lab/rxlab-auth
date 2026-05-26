import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, passkeys } from "@/lib/db/schema";
import { getWebAuthnChallenge, deleteWebAuthnChallenge } from "@/lib/redis";
import { rpID, origin, base64UrlDecode } from "@/lib/webauthn/config";
import { passkeyAuthVerifyRequestSchema } from "@/lib/validations/oauth";
import {
  validateNativeClient,
  resolveRequestedScopes,
} from "@/lib/oauth/native-client";
import { issueOAuthTokenResponse } from "@/lib/oauth/issue-tokens";

// POST /api/oauth/passkey/authenticate/verify
//
// Native passkey sign-in completion: verifies the WebAuthn assertion against
// the Redis-stored challenge created by /options, looks up the matching user
// (via the credential id), and returns OAuth tokens.
// Response shape matches /api/oauth/token's authorization_code grant.
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

  const parsed = passkeyAuthVerifyRequestSchema.safeParse(body);
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

  const clientCheck = await validateNativeClient(data.client_id);
  if (!clientCheck.ok) return clientCheck.response;
  const client = clientCheck.client;

  const scopeCheck = resolveRequestedScopes(data.scope, client);
  if (!scopeCheck.ok) return scopeCheck.response;
  const requestedScopes = scopeCheck.scopes;

  const challengeData = await getWebAuthnChallenge(data.session_id);
  if (
    !challengeData ||
    challengeData.type !== "native-authentication" ||
    challengeData.clientId !== data.client_id
  ) {
    return NextResponse.json(
      {
        error: "invalid_grant",
        error_description: "No authentication challenge found",
      },
      { status: 400 },
    );
  }

  const passkey = await db.query.passkeys.findFirst({
    where: eq(passkeys.id, data.credential.id),
  });
  if (!passkey) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Passkey not found" },
      { status: 400 },
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, passkey.userId),
  });
  if (!user) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "User not found" },
      { status: 400 },
    );
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: data.credential as Parameters<
        typeof verifyAuthenticationResponse
      >[0]["response"],
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: base64UrlDecode(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports
          ? JSON.parse(passkey.transports)
          : undefined,
      },
    });
  } catch (error) {
    console.error("Passkey verify error:", error);
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Verification failed" },
      { status: 400 },
    );
  }

  if (!verification.verified) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Verification failed" },
      { status: 400 },
    );
  }

  // Update counter and last-used; clean up challenge.
  await db
    .update(passkeys)
    .set({
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    })
    .where(eq(passkeys.id, passkey.id));
  await deleteWebAuthnChallenge(data.session_id);

  const tokenResponse = await issueOAuthTokenResponse({
    user,
    client,
    scopes: requestedScopes,
  });

  return NextResponse.json(tokenResponse);
}
