import { NextRequest, NextResponse } from "next/server";
import type { JWTPayload } from "jose";
import { verifyAccessToken, type AccessTokenPayload } from "@/lib/oauth/jwt";

export type BearerCheck =
  | { ok: true; payload: JWTPayload & AccessTokenPayload }
  | { ok: false; response: NextResponse };

// Parse `Authorization: Bearer <jwt>` and verify the access token.
// On failure returns a 401 with WWW-Authenticate set per RFC 6750.
export async function requireBearerToken(
  request: NextRequest,
): Promise<BearerCheck> {
  const header = request.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "invalid_token",
          error_description: "Missing or invalid Authorization header",
        },
        {
          status: 401,
          headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' },
        },
      ),
    };
  }
  const token = header.substring(7);
  try {
    const payload = await verifyAccessToken(token);
    return { ok: true, payload };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "invalid_token",
          error_description: "Invalid or expired token",
        },
        {
          status: 401,
          headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' },
        },
      ),
    };
  }
}
