import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, passkeys } from "@/lib/db/schema";
import {
  storeWebAuthnChallenge,
  type WebAuthnChallengeData,
} from "@/lib/redis";
import {
  getRegistrationOptions,
  parseTransports,
} from "@/lib/webauthn/config";
import { passkeyUpgradeOptionsRequestSchema } from "@/lib/validations/oauth";
import { requireBearerToken } from "@/lib/oauth/bearer";

// POST /api/oauth/passkey/upgrade/options
//
// Apple Automatic Passkey Upgrade — silently registers a platform passkey
// for the already-authenticated user. Caller MUST present a valid OAuth
// access token in `Authorization: Bearer <token>`; the user is derived from
// the token's `sub` claim, not from any request body field.
//
// Returns the same SimpleWebAuthn registration options shape the existing
// /register/options route returns, plus a `sessionId` the client passes back
// to /upgrade/verify.
export async function POST(request: NextRequest) {
  const auth = await requireBearerToken(request);
  if (!auth.ok) return auth.response;

  // Body is optional — only `name` is read. If parsing fails (e.g. empty
  // body), fall back to an empty object so the schema's optional fields
  // still validate.
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = passkeyUpgradeOptionsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, auth.payload.sub),
  });
  if (!user) {
    return NextResponse.json(
      { error: "invalid_token", error_description: "User not found" },
      { status: 401 },
    );
  }

  const existingPasskeys = await db.query.passkeys.findMany({
    where: eq(passkeys.userId, user.id),
  });
  const excludeCredentials = existingPasskeys.map((pk) => ({
    id: pk.id,
    transports: parseTransports(pk.transports),
  }));

  const displayName = user.displayName || user.email.split("@")[0];
  const sessionId = crypto.randomUUID();

  const options = getRegistrationOptions(
    user.id,
    user.email,
    displayName,
    excludeCredentials,
  );
  const registrationOptions = await generateRegistrationOptions(options);

  const challengeData: WebAuthnChallengeData = {
    challenge: registrationOptions.challenge,
    userId: user.id,
    type: "passkey-upgrade",
    clientId: auth.payload.client_id,
    createdAt: Date.now(),
  };
  await storeWebAuthnChallenge(sessionId, challengeData);

  return NextResponse.json({
    ...registrationOptions,
    sessionId,
  });
}
