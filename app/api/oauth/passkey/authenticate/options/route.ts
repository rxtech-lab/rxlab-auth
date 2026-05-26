import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, passkeys } from "@/lib/db/schema";
import {
  storeWebAuthnChallenge,
  type WebAuthnChallengeData,
} from "@/lib/redis";
import {
  getAuthenticationOptions,
  parseTransports,
} from "@/lib/webauthn/config";
import { passkeyAuthOptionsRequestSchema } from "@/lib/validations/oauth";
import { validateNativeClient } from "@/lib/oauth/native-client";

// POST /api/oauth/passkey/authenticate/options
//
// Native passkey sign-in: returns a WebAuthn assertion options blob + a
// session id that the macOS client passes back to /verify. No cookie or
// pre-existing session is required.
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

  const parsed = passkeyAuthOptionsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  }

  const check = await validateNativeClient(parsed.data.client_id);
  if (!check.ok) return check.response;

  const sessionId = crypto.randomUUID();

  let allowCredentials: {
    id: string;
    transports?: AuthenticatorTransport[];
  }[] = [];

  if (parsed.data.username) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, parsed.data.username.toLowerCase()),
    });
    if (user) {
      const userPasskeys = await db.query.passkeys.findMany({
        where: eq(passkeys.userId, user.id),
      });
      allowCredentials = userPasskeys.map((pk) => ({
        id: pk.id,
        transports: parseTransports(pk.transports),
      }));
    }
  }

  const options = getAuthenticationOptions(allowCredentials);
  const authenticationOptions = await generateAuthenticationOptions(options);

  const challengeData: WebAuthnChallengeData = {
    challenge: authenticationOptions.challenge,
    type: "native-authentication",
    clientId: parsed.data.client_id,
    createdAt: Date.now(),
  };
  await storeWebAuthnChallenge(sessionId, challengeData);

  return NextResponse.json({
    ...authenticationOptions,
    sessionId,
  });
}
