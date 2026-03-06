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
import { checkSignUpAllowed } from "@/lib/settings/sign-up";
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

  // Check if sign-up is allowed
  const signUpCheck = await checkSignUpAllowed(email);
  if (!signUpCheck.allowed) {
    return {
      success: false,
      error:
        signUpCheck.reason === "disabled"
          ? "Sign-up is currently disabled. Please contact an administrator."
          : "Sign-up is restricted. Your email is not on the approved list.",
    };
  }

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

    // Skip email verification in E2E test environment
    if (process.env.E2E_SKIP_EMAIL_VERIFICATION === "true") {
      // Create user with email already verified
      await db.insert(users).values({
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        displayName: displayName || email.split("@")[0],
        avatarSeed,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });

      // Create session
      await createSession(userId, email.toLowerCase());

      return { success: true };
    }

    // Generate verification token
    const token = crypto.randomUUID();
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Wrap user creation, token creation, and email sending in a transaction
    // If email fails to send, the transaction will rollback and no user will be created
    await db.transaction(async (tx) => {
      // Create user
      await tx.insert(users).values({
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        displayName: displayName || email.split("@")[0],
        avatarSeed,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
      });

      // Create verification token
      await tx.insert(emailVerificationTokens).values({
        id: tokenId,
        userId,
        token,
        expiresAt,
        createdAt: now,
      });

      // Send verification email - if this throws, the transaction rolls back
      await sendEmail({
        to: email,
        subject: "Verify your email address",
        html: getVerificationEmailHtml(token),
        text: getVerificationEmailText(token),
      });
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
      redirect("/account?setup=passkey");
    } else {
      redirect("/verify-email?sent=true");
    }
  }

  // If there's an error, throw it so the form can handle it
  throw new Error(result.error);
}
