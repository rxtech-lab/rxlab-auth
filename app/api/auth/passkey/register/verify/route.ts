import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { passkeys } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { getWebAuthnChallenge, deleteWebAuthnChallenge } from "@/lib/redis";
import { rpID, origin, base64UrlEncode } from "@/lib/webauthn/config";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, credential } = await request.json();
    if (!name || !credential) {
      return NextResponse.json(
        { error: "Name and credential are required" },
        { status: 400 }
      );
    }

    // Get stored challenge
    const challengeData = await getWebAuthnChallenge(session.userId);
    if (!challengeData || challengeData.type !== "registration") {
      return NextResponse.json(
        { error: "No registration challenge found. Please try again." },
        { status: 400 }
      );
    }

    // Verify registration response
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 400 }
      );
    }

    const { credential: cred, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    // Store passkey in database
    // cred.id is already a base64url string
    // cred.publicKey is a Uint8Array that needs encoding for storage
    const credentialId = cred.id;
    const publicKey = base64UrlEncode(cred.publicKey);

    await db.insert(passkeys).values({
      id: credentialId,
      userId: session.userId,
      name,
      publicKey,
      counter: cred.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: credential.response.transports
        ? JSON.stringify(credential.response.transports)
        : null,
      createdAt: new Date(),
    });

    // Clean up challenge
    await deleteWebAuthnChallenge(session.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Passkey registration verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify registration" },
      { status: 500 }
    );
  }
}
