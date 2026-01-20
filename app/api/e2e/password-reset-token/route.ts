import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// This endpoint is only available in E2E test mode
export async function GET(request: NextRequest) {
  // Only allow in E2E mode
  if (process.env.E2E_SKIP_EMAIL_VERIFICATION !== "true") {
    return NextResponse.json(
      { error: "This endpoint is only available in E2E test mode" },
      { status: 403 }
    );
  }

  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json(
      { error: "Email parameter is required" },
      { status: 400 }
    );
  }

  // Find user by email
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // Get the latest password reset token for this user
  const token = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.userId, user.id),
    orderBy: [desc(passwordResetTokens.createdAt)],
  });

  if (!token) {
    return NextResponse.json(
      { error: "No password reset token found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ token: token.token });
}
