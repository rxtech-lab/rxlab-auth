import { NextRequest, NextResponse } from "next/server";
import { getSocialProvider } from "@/lib/auth/social/providers";
import { validateClientRedirect } from "@/lib/oauth/native-client";
import { storeAppleNonce } from "@/lib/redis";
import { appleNativeNonceRequestSchema } from "@/lib/validations/oauth";

// POST /api/oauth/social/apple/nonce
//
// Step 1 of native Sign in with Apple. Mirrors the passkey `/options` routes:
// the server hands out a short-lived, single-use challenge that step 2 consumes.
//
// The client passes SHA-256(nonce) to `ASAuthorizationAppleIDRequest.nonce`;
// Apple copies that hash into the identity token it mints. Sending the raw
// value back to /api/oauth/social/apple lets us re-hash and compare, which
// binds the token to this one request — without it, a leaked identity token
// could be replayed for its full 10-minute lifetime.
export async function POST(request: NextRequest) {
  if (!getSocialProvider("apple")) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "Sign in with Apple is not configured",
      },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Body must be JSON" },
      { status: 400 },
    );
  }

  const parsed = appleNativeNonceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Same gate the native passkey routes use: the client must exist and the
  // redirect_uri must be one it registered.
  const clientCheck = await validateClientRedirect({
    clientId: data.client_id,
    redirectUri: data.redirect_uri,
  });
  if (!clientCheck.ok) return clientCheck.response;

  const sessionId = crypto.randomUUID();
  const nonce = crypto.randomUUID();

  await storeAppleNonce(sessionId, {
    nonce,
    clientId: data.client_id,
    redirectUri: data.redirect_uri,
    createdAt: Date.now(),
  });

  return NextResponse.json({ session_id: sessionId, nonce });
}
