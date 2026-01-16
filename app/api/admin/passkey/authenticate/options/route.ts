import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import {
  storeWebAuthnChallenge,
  type WebAuthnChallengeData,
} from "@/lib/redis";
import { rpID, parseTransports } from "@/lib/webauthn/config";

export async function POST() {
  try {
    // Generate a session ID for challenge storage
    const sessionId = `admin:auth:${crypto.randomUUID()}`;

    // Get all admin passkeys
    const allAdminPasskeys = await db.query.adminPasskeys.findMany();

    const allowCredentials = allAdminPasskeys.map((pk) => ({
      id: pk.id,
      transports: parseTransports(pk.transports),
    }));

    // Generate options
    const authenticationOptions = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: "preferred",
    });

    // Store challenge in Redis
    const challengeData: WebAuthnChallengeData = {
      challenge: authenticationOptions.challenge,
      type: "authentication",
      createdAt: Date.now(),
    };
    await storeWebAuthnChallenge(sessionId, challengeData);

    return NextResponse.json({
      ...authenticationOptions,
      sessionId,
    });
  } catch (error) {
    console.error("Admin passkey authentication options error:", error);
    return NextResponse.json(
      { error: "Failed to generate authentication options" },
      { status: 500 }
    );
  }
}
