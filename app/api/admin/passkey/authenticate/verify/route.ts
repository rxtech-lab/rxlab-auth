import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { adminPasskeys } from "@/lib/db/schema";
import { createAdminSession } from "@/lib/auth/session";
import { getWebAuthnChallenge, deleteWebAuthnChallenge } from "@/lib/redis";
import { rpID, origin, base64UrlDecode } from "@/lib/webauthn/config";
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

    // Find the admin passkey
    const credentialId = credential.id;
    const passkey = await db.query.adminPasskeys.findFirst({
      where: eq(adminPasskeys.id, credentialId),
    });

    if (!passkey) {
      return NextResponse.json(
        { error: "Passkey not found" },
        { status: 400 }
      );
    }

    // Verify authentication response
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: base64UrlDecode(passkey.publicKey),
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

    // Update counter and last used
    await db
      .update(adminPasskeys)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      })
      .where(eq(adminPasskeys.id, passkey.id));

    // Clean up challenge
    await deleteWebAuthnChallenge(sessionId);

    // Create admin session
    await createAdminSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin passkey authentication verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify authentication" },
      { status: 500 }
    );
  }
}
