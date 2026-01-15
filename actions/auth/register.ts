"use server";

import { db } from "@/lib/db";
import { users, emailVerificationTokens } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/resend";
import {
  getVerificationEmailHtml,
  getVerificationEmailText,
} from "@/lib/email/templates";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { generateAvatarSeed } from "@/lib/identicon/generate";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export interface RegisterResult {
  success: boolean;
  error?: string;
}

export async function register(input: RegisterInput): Promise<RegisterResult> {
  // Validate input
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    };
  }

  const { email, password, displayName } = parsed.data;

  try {
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return {
        success: false,
        error: "An account with this email already exists",
      };
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate user ID and avatar seed
    const userId = crypto.randomUUID();
    const avatarSeed = generateAvatarSeed();
    const now = new Date();

    // Create user
    await db.insert(users).values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName || email.split("@")[0],
      avatarSeed,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    // Skip email verification in E2E test environment
    if (process.env.E2E_SKIP_EMAIL_VERIFICATION === "true") {
      // Mark email as verified immediately
      await db
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, userId));

      // Create session
      await createSession(userId, email.toLowerCase());

      return { success: true };
    }

    // Generate verification token
    const token = crypto.randomUUID();
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emailVerificationTokens).values({
      id: tokenId,
      userId,
      token,
      expiresAt,
      createdAt: now,
    });

    // Send verification email
    await sendEmail({
      to: email,
      subject: "Verify your email address",
      html: getVerificationEmailHtml(token),
      text: getVerificationEmailText(token),
    });

    return { success: true };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error: "An error occurred during registration. Please try again.",
    };
  }
}

export async function registerAndRedirect(input: RegisterInput): Promise<void> {
  const result = await register(input);

  if (result.success) {
    if (process.env.E2E_SKIP_EMAIL_VERIFICATION === "true") {
      redirect("/account");
    } else {
      redirect("/verify-email?sent=true");
    }
  }

  // If there's an error, throw it so the form can handle it
  throw new Error(result.error);
}
