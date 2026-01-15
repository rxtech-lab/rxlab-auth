import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyAccessToken } from "@/lib/oauth/jwt";
import { eq } from "drizzle-orm";

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

    // Build response based on scopes
    const scopes = payload.scope.split(" ");
    const response: Record<string, unknown> = {
      sub: user.id,
    };

    if (scopes.includes("profile")) {
      response.name = user.displayName;
      response.preferred_username = user.username;
      response.picture = `${process.env.OAUTH_ISSUER_URL}/api/avatar/${user.avatarSeed || user.id}`;
    }

    if (scopes.includes("email")) {
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
