import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
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
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;

    // Generate a temporary session ID for challenge storage
    const sessionId = crypto.randomUUID();

    let allowCredentials: { id: string; transports?: AuthenticatorTransport[] }[] = [];

    if (email) {
      // If email provided, get user's passkeys
      const user = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });

      if (user) {
        const userPasskeys = await db.query.passkeys.findMany({
          where: eq(passkeys.userId, user.id),
        });

        allowCredentials = userPasskeys.map((pk) => ({
          id: pk.id, // Already a base64url string
          transports: parseTransports(pk.transports),
        }));
      }
    }

    // Generate options
    const options = getAuthenticationOptions(allowCredentials);
    const authenticationOptions = await generateAuthenticationOptions(options);

    // Store challenge in Redis with session ID
    const challengeData: WebAuthnChallengeData = {
      challenge: authenticationOptions.challenge,
      type: "authentication",
      createdAt: Date.now(),
    };
    await storeWebAuthnChallenge(sessionId, challengeData);

    // Return options with session ID for verification
    return NextResponse.json({
      ...authenticationOptions,
      sessionId,
    });
  } catch (error) {
    console.error("Passkey authentication options error:", error);
    return NextResponse.json(
      { error: "Failed to generate authentication options" },
      { status: 500 }
    );
  }
}
