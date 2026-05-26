import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import {
  storeWebAuthnChallenge,
  type WebAuthnChallengeData,
} from "@/lib/redis";
import { getRegistrationOptions } from "@/lib/webauthn/config";
import { passkeyAccountCreationOptionsRequestSchema } from "@/lib/validations/oauth";
import { validateClientRedirect } from "@/lib/oauth/native-client";
import { checkSignUpAllowed } from "@/lib/settings/sign-up";

// POST /api/oauth/passkey/account-creation/options
//
// iOS 26 / macOS 26 ASAuthorizationAccountCreationProvider: the OS sheet
// hasn't yet asked iCloud for the user's contact identifier, so we don't
// know who is signing up. We mint a placeholder userId and return
// WebAuthn registration options bound to it. The /verify step receives
// the actual contact_identifier (email or phone) from the system sheet
// and creates the user row.
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

  const parsed = passkeyAccountCreationOptionsRequestSchema.safeParse(body);
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

  const clientCheck = await validateClientRedirect({
    clientId: data.client_id,
    redirectUri: data.redirect_uri,
  });
  if (!clientCheck.ok) return clientCheck.response;

  // Global sign-up gate: respect the same disabled/whitelist controls as
  // the other native signup routes. checkSignUpAllowed only refuses when
  // global sign-up is disabled (no whitelist match is fine — there's no
  // identifier to check yet; whitelist enforcement defers to /verify).
  const status = await checkSignUpAllowed("");
  if (!status.allowed && status.reason === "disabled") {
    return NextResponse.json(
      {
        error: "access_denied",
        error_description: "Sign-up is currently disabled",
      },
      { status: 403 },
    );
  }

  const pendingUserId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  const options = getRegistrationOptions(pendingUserId, "", "");
  const registrationOptions = await generateRegistrationOptions(options);

  const challengeData: WebAuthnChallengeData = {
    challenge: registrationOptions.challenge,
    userId: pendingUserId,
    type: "passkey-account-creation",
    clientId: data.client_id,
    redirectUri: data.redirect_uri,
    createdAt: Date.now(),
  };
  await storeWebAuthnChallenge(sessionId, challengeData);

  return NextResponse.json({
    ...registrationOptions,
    sessionId,
  });
}
