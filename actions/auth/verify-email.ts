"use server";

import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/resend";
import {
  getVerificationEmailHtml,
  getVerificationEmailText,
} from "@/lib/email/templates";
import { eq, and, gt } from "drizzle-orm";
import { redirect } from "next/navigation";

export interface VerifyEmailResult {
  success: boolean;
  error?: string;
}

export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  if (!token) {
    return {
      success: false,
      error: "Verification token is required",
    };
  }

  try {
    // Find token
    const verificationToken = await db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.token, token),
        gt(emailVerificationTokens.expiresAt, new Date())
      ),
    });

    if (!verificationToken) {
      return {
        success: false,
        error: "Invalid or expired verification token",
      };
    }

    // Update user
    await db
      .update(users)
      .set({
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, verificationToken.userId));

    // Delete used token
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.id, verificationToken.id));

    // Get user and create session
    const user = await db.query.users.findFirst({
      where: eq(users.id, verificationToken.userId),
    });

    if (user) {
      await createSession(user.id, user.email);
    }

    return { success: true };
  } catch (error) {
    console.error("Email verification error:", error);
    return {
      success: false,
      error: "An error occurred during verification. Please try again.",
    };
  }
}

export async function verifyEmailAndRedirect(token: string): Promise<void> {
  const result = await verifyEmail(token);

  if (result.success) {
    redirect("/account?verified=true");
  }

  throw new Error(result.error);
}

export async function resendVerificationEmail(
  email: string
): Promise<VerifyEmailResult> {
  if (!email) {
    return {
      success: false,
      error: "Email is required",
    };
  }

  try {
    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user) {
      // Don't reveal if user exists
      return { success: true };
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
      .where(eq(emailVerificationTokens.userId, user.id));

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
      to: email,
      subject: "Verify your email address",
      html: getVerificationEmailHtml(token),
      text: getVerificationEmailText(token),
    });

    return { success: true };
  } catch (error) {
    console.error("Resend verification error:", error);
    return {
      success: false,
      error: "An error occurred. Please try again.",
    };
  }
}
