import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { oauthConsents, users } from "@/lib/db/schema";
import { verifyAccessToken } from "@/lib/oauth/jwt";
import { getUserRoleKeys } from "@/lib/oauth/roles";
import { and, eq } from "drizzle-orm";

async function handleUserInfo(request: NextRequest) {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "invalid_token", error_description: "Missing or invalid Authorization header" },
        { status: 401, headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' } }
      );
    }

    const accessToken = authHeader.substring(7);

    // Verify and decode token
    let payload;
    try {
      payload = await verifyAccessToken(accessToken);
    } catch {
      return NextResponse.json(
        { error: "invalid_token", error_description: "Invalid or expired token" },
        { status: 401, headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' } }
      );
    }

    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user) {
      return NextResponse.json(
        { error: "invalid_token", error_description: "User not found" },
        { status: 401 }
      );
    }

    // Get granted scopes from database
    const consent = await db.query.oauthConsents.findFirst({
      where: and(
        eq(oauthConsents.userId, user.id),
        eq(oauthConsents.clientId, payload.client_id)
      ),
    });
    const grantedScopes: string[] = consent ? JSON.parse(consent.scopes) : [];
    const roles = await getUserRoleKeys(user.id, payload.client_id);

    // Build response - always include profile, email requires scope from DB
    const response: Record<string, unknown> = {
      sub: user.id,
      // Always include profile claims
      name: user.displayName,
      preferred_username: user.username,
      picture: user.avatarUrl || `${process.env.OAUTH_ISSUER_URL}/api/avatar/${user.avatarSeed || user.id}`,
      roles,
    };

    if (grantedScopes.includes("email")) {
      response.email = user.email;
      response.email_verified = user.emailVerified;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("UserInfo error:", error);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleUserInfo(request);
}

export async function POST(request: NextRequest) {
  return handleUserInfo(request);
}
