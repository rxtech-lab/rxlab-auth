import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { oauthClients, oauthRefreshTokens } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { revokeRequestSchema } from "@/lib/validations/oauth";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const body: Record<string, string> = {};
    formData.forEach((value, key) => {
      body[key] = value.toString();
    });

    // Validate request
    const parsed = revokeRequestSchema.safeParse(body);
    if (!parsed.success) {
      // Per RFC 7009, return 200 even for invalid requests
      return NextResponse.json({});
    }

    const { token, client_id, client_secret } = parsed.data;

    // Validate client credentials
    const client = await db.query.oauthClients.findFirst({
      where: eq(oauthClients.id, client_id),
    });

    if (!client) {
      // Per RFC 7009, return 200 even for invalid client
      return NextResponse.json({});
    }

    const secretValid = await verifyPassword(client.secret, client_secret);
    if (!secretValid) {
      return NextResponse.json({});
    }

    // Try to revoke as refresh token
    const refreshToken = await db.query.oauthRefreshTokens.findFirst({
      where: and(
        eq(oauthRefreshTokens.token, token),
        eq(oauthRefreshTokens.clientId, client_id)
      ),
    });

    if (refreshToken) {
      await db
        .update(oauthRefreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(oauthRefreshTokens.id, refreshToken.id));
    }

    // Per RFC 7009, always return 200
    return NextResponse.json({});
  } catch (error) {
    console.error("Revoke error:", error);
    // Per RFC 7009, return 200 even on error
    return NextResponse.json({});
  }
}
