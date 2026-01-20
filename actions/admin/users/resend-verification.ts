"use server";

import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/resend";
import {
  getVerificationEmailHtml,
  getVerificationEmailText,
} from "@/lib/email/templates";
import { eq } from "drizzle-orm";

export interface ResendVerificationResult {
  success: boolean;
  error?: string;
}

export async function adminResendVerificationEmail(
  userId: string
): Promise<ResendVerificationResult> {
  try {
    await requireAdmin();

    if (!userId) {
      return {
        success: false,
        error: "User ID is required",
      };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    if (user.emailVerified) {
      return {
        success: false,
        error: "Email is already verified",
      };
    }

    // Delete existing tokens for this user
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    // Generate new token
    const token = crypto.randomUUID();
    const tokenId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emailVerificationTokens).values({
      id: tokenId,
      userId: user.id,
      token,
      expiresAt,
      createdAt: now,
    });

    // Send email
    await sendEmail({
      to: user.email,
      subject: "Verify your email address",
      html: getVerificationEmailHtml(token),
      text: getVerificationEmailText(token),
    });

    return { success: true };
  } catch (error) {
    console.error("Admin resend verification error:", error);
    return {
      success: false,
      error: "Failed to send verification email",
    };
  }
}
