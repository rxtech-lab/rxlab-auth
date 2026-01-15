"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export interface LoginResult {
  success: boolean;
  error?: string;
  needsVerification?: boolean;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  // Validate input
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input",
    };
  }

  const { email, password } = parsed.data;

  try {
    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user) {
      return {
        success: false,
        error: "Invalid email or password",
      };
    }

    // Check if user has a password (might be passkey-only)
    if (!user.passwordHash) {
      return {
        success: false,
        error: "This account uses passkey authentication only",
      };
    }

    // Verify password
    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
      return {
        success: false,
        error: "Invalid email or password",
      };
    }

    // Check email verification (skip in E2E)
    if (!user.emailVerified && process.env.E2E_SKIP_EMAIL_VERIFICATION !== "true") {
      return {
        success: false,
        error: "Please verify your email address before logging in",
        needsVerification: true,
      };
    }

    // Create session
    await createSession(user.id, user.email);

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: "An error occurred during login. Please try again.",
    };
  }
}

export async function loginAndRedirect(
  input: LoginInput,
  redirectTo?: string
): Promise<void> {
  const result = await login(input);

  if (result.success) {
    redirect(redirectTo || "/account");
  }

  if (result.needsVerification) {
    redirect("/verify-email?resend=true");
  }

  throw new Error(result.error);
}
