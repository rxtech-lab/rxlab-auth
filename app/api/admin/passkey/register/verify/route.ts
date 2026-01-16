import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { adminPasskeys } from "@/lib/db/schema";
import { getAdminSession } from "@/lib/auth/session";
import { getWebAuthnChallenge, deleteWebAuthnChallenge } from "@/lib/redis";
import { rpID, origin, base64UrlEncode } from "@/lib/webauthn/config";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, credential, sessionId } = await request.json();
    if (!name || !credential || !sessionId) {
      return NextResponse.json(
        { error: "Name, credential, and sessionId are required" },
        { status: 400 }
      );
    }

    // Get stored challenge
    const challengeData = await getWebAuthnChallenge(sessionId);
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

    const { credential: cred } = verification.registrationInfo;

    // Store passkey in database
    const credentialId = cred.id;
    const publicKey = base64UrlEncode(cred.publicKey);

    await db.insert(adminPasskeys).values({
      id: credentialId,
      name,
      publicKey,
      counter: cred.counter,
      transports: credential.response.transports
        ? JSON.stringify(credential.response.transports)
        : null,
      createdAt: new Date(),
    });

    // Clean up challenge
    await deleteWebAuthnChallenge(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin passkey registration verify error:", error);
    return NextResponse.json(
      { error: "Failed to verify registration" },
      { status: 500 }
    );
  }
}
