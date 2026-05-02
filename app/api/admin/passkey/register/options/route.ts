import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { adminPasskeys } from "@/lib/db/schema";
import { getAdminSession } from "@/lib/auth/session";
import {
  storeWebAuthnChallenge,
  type WebAuthnChallengeData,
} from "@/lib/redis";
import {
  rpID,
  rpName,
  parseTransports,
} from "@/lib/webauthn/config";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Passkey name is required" },
        { status: 400 }
      );
    }

    // Get existing admin passkeys to exclude
    const existingPasskeys = await db.query.adminPasskeys.findMany();

    const excludeCredentials = existingPasskeys.map((pk) => ({
      id: pk.id,
      transports: parseTransports(pk.transports),
    }));

    // Use a fixed admin user ID for registration
    const adminUserId = "admin";
    const adminUserName = "Admin";

    const registrationOptions = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(adminUserId),
      userName: adminUserName,
      userDisplayName: "Administrator",
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
      extensions: { prf: {} } as Parameters<
        typeof generateRegistrationOptions
      >[0]["extensions"],
    });

    // Store challenge in Redis with admin prefix
    const challengeKey = `admin:${crypto.randomUUID()}`;
    const challengeData: WebAuthnChallengeData = {
      challenge: registrationOptions.challenge,
      type: "registration",
      createdAt: Date.now(),
    };
    await storeWebAuthnChallenge(challengeKey, challengeData);

    return NextResponse.json({
      ...registrationOptions,
      sessionId: challengeKey,
    });
  } catch (error) {
    console.error("Admin passkey registration options error:", error);
    return NextResponse.json(
      { error: "Failed to generate registration options" },
      { status: 500 }
    );
  }
}
