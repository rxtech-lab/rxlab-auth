"use server";

import { db } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/email/resend";
import {
  getPasswordResetEmailHtml,
  getPasswordResetEmailText,
} from "@/lib/email/templates";
import {
  resetPasswordRequestSchema,
  resetPasswordSchema,
  type ResetPasswordRequestInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import { eq, and, gt } from "drizzle-orm";
import { redirect } from "next/navigation";

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

export async function requestPasswordReset(
  input: ResetPasswordRequestInput
): Promise<ResetPasswordResult> {
  const parsed = resetPasswordRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    };
  }

  const { email } = parsed.data;

  try {
    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true };
    }

    // Delete existing tokens for this user
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

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
      to: email,
      subject: "Reset your password",
      html: getPasswordResetEmailHtml(token),
      text: getPasswordResetEmailText(token),
    });

    return { success: true };
  } catch (error) {
    console.error("Password reset request error:", error);
    return {
      success: false,
      error: "An error occurred. Please try again.",
    };
  }
}

export async function resetPassword(
  input: ResetPasswordInput
): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    };
  }

  const { token, password } = parsed.data;

  try {
    // Find token
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.token, token),
        gt(passwordResetTokens.expiresAt, new Date())
      ),
    });

    if (!resetToken) {
      return {
        success: false,
        error: "Invalid or expired reset token",
      };
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user password
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, resetToken.userId));

    // Delete used token
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, resetToken.id));

    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    return {
      success: false,
      error: "An error occurred. Please try again.",
    };
  }
}

export async function resetPasswordAndRedirect(
  input: ResetPasswordInput
): Promise<void> {
  const result = await resetPassword(input);

  if (result.success) {
    redirect("/login?reset=true");
  }

  throw new Error(result.error);
}
