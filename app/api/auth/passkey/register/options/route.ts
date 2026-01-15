import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { users, passkeys } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import {
  storeWebAuthnChallenge,
  type WebAuthnChallengeData,
} from "@/lib/redis";
import {
  getRegistrationOptions,
  parseTransports,
} from "@/lib/webauthn/config";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Passkey name is required" },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get existing passkeys to exclude
    const existingPasskeys = await db.query.passkeys.findMany({
      where: eq(passkeys.userId, user.id),
    });

    const excludeCredentials = existingPasskeys.map((pk) => ({
      id: pk.id, // Already a base64url string
      transports: parseTransports(pk.transports),
    }));

    // Generate options
    const options = getRegistrationOptions(
      user.id,
      user.email,
      user.displayName || user.email,
      excludeCredentials
    );

    const registrationOptions = await generateRegistrationOptions(options);

    // Store challenge in Redis
    const challengeData: WebAuthnChallengeData = {
      challenge: registrationOptions.challenge,
      userId: user.id,
      type: "registration",
      createdAt: Date.now(),
    };
    await storeWebAuthnChallenge(session.userId, challengeData);

    return NextResponse.json(registrationOptions);
  } catch (error) {
    console.error("Passkey registration options error:", error);
    return NextResponse.json(
      { error: "Failed to generate registration options" },
      { status: 500 }
    );
  }
}
