"use server";

import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/resend";
import {
  getPasswordResetEmailHtml,
  getPasswordResetEmailText,
} from "@/lib/email/templates";
import { eq } from "drizzle-orm";

export interface SendPasswordResetResult {
  success: boolean;
  error?: string;
}

export async function adminSendPasswordReset(
  userId: string
): Promise<SendPasswordResetResult> {
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

    // Delete existing tokens for this user
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    // Generate new token
    const token = crypto.randomUUID();
    const tokenId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      id: tokenId,
      userId: user.id,
      token,
      expiresAt,
      createdAt: now,
    });

    // Send email
    await sendEmail({
      to: user.email,
      subject: "Reset your password",
      html: getPasswordResetEmailHtml(token),
      text: getPasswordResetEmailText(token),
    });

    return { success: true };
  } catch (error) {
    console.error("Admin send password reset error:", error);
    return {
      success: false,
      error: "Failed to send password reset email",
    };
  }
}
