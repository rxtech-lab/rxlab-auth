import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { users, passkeys } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/session";
import { getWebAuthnChallenge, deleteWebAuthnChallenge } from "@/lib/redis";
import { rpID, expectedOrigins, base64UrlDecode } from "@/lib/webauthn/config";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { credential, sessionId } = await request.json();

    if (!credential || !sessionId) {
      return NextResponse.json(
        { error: "Credential and session ID are required" },
        { status: 400 }
      );
    }

    // Get stored challenge
    const challengeData = await getWebAuthnChallenge(sessionId);
    if (!challengeData || challengeData.type !== "authentication") {
      return NextResponse.json(
        { error: "No authentication challenge found. Please try again." },
        { status: 400 }
      );
    }

    // Find the passkey
    const credentialId = credential.id;
    const passkey = await db.query.passkeys.findFirst({
      where: eq(passkeys.id, credentialId),
    });

    if (!passkey) {
      return NextResponse.json(
        { error: "Passkey not found" },
        { status: 400 }
      );
    }

    // Get the user
    const user = await db.query.users.findFirst({
      where: eq(users.id, passkey.userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 400 }
      );
    }

    // Verify authentication response
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: rpID,
      credential: {
        id: passkey.id, // base64url string
        publicKey: base64UrlDecode(passkey.publicKey), // Uint8Array
        counter: passkey.counter,
        transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    // Update counter
    await db
      .update(passkeys)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      })
      .where(eq(passkeys.id, passkey.id));

    // Clean up challenge
    await deleteWebAuthnChallenge(sessionId);

    // Create session
    await createSession(user.id, user.email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Passkey authentication verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify authentication" },
      { status: 500 }
    );
  }
}
