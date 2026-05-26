import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  storeWebAuthnChallenge,
  type WebAuthnChallengeData,
} from "@/lib/redis";
import { getRegistrationOptions } from "@/lib/webauthn/config";
import { passkeyRegisterOptionsRequestSchema } from "@/lib/validations/oauth";
import { validateNativeClient } from "@/lib/oauth/native-client";
import { checkSignUpAllowed } from "@/lib/settings/sign-up";

// POST /api/oauth/passkey/register/options
//
// Native passkey registration: returns WebAuthn registration options for a
// new user, plus a session id that ties this challenge to the pending
// signup. The user row is NOT created here — that happens in /verify after
// the attestation is verified.
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

  const parsed = passkeyRegisterOptionsRequestSchema.safeParse(body);
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

  const email = data.username.toLowerCase();

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

  // Generate a pending user id now so the WebAuthn credential ties to it.
  const pendingUserId = crypto.randomUUID();
  const displayName = data.name || email.split("@")[0];
  const sessionId = crypto.randomUUID();

  const options = getRegistrationOptions(pendingUserId, email, displayName);
  const registrationOptions = await generateRegistrationOptions(options);

  const challengeData: WebAuthnChallengeData = {
    challenge: registrationOptions.challenge,
    userId: pendingUserId,
    type: "native-registration",
    clientId: data.client_id,
    pendingEmail: email,
    pendingDisplayName: displayName,
    createdAt: Date.now(),
  };
  await storeWebAuthnChallenge(sessionId, challengeData);

  return NextResponse.json({
    ...registrationOptions,
    sessionId,
  });
}
