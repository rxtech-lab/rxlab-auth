import { db } from "@/lib/db";
import { appSettings, emailWhitelist } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface SignUpCheckResult {
  allowed: boolean;
  reason?: "disabled" | "not_whitelisted";
}

export interface SignUpStatus {
  publicSignUpEnabled: boolean;
  whitelistEnabled: boolean;
  isCompletelyDisabled: boolean;
}

export async function getSignUpStatus(): Promise<SignUpStatus> {
  const settings = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, "global"),
  });

  const publicSignUpEnabled = settings?.signUpEnabled ?? true;
  const whitelistEnabled = settings?.signUpWhitelistEnabled ?? false;

  return {
    publicSignUpEnabled,
    whitelistEnabled,
    isCompletelyDisabled: !publicSignUpEnabled && !whitelistEnabled,
  };
}

export async function checkSignUpAllowed(
  email: string
): Promise<SignUpCheckResult> {
  // Get settings
  const settings = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, "global"),
  });

  // Default: sign-up enabled, whitelist disabled
  const signUpEnabled = settings?.signUpEnabled ?? true;
  const whitelistEnabled = settings?.signUpWhitelistEnabled ?? false;

  // Check if email is whitelisted (whitelist overrides disabled sign-up)
  if (whitelistEnabled) {
    const whitelisted = await db.query.emailWhitelist.findFirst({
      where: eq(emailWhitelist.email, email.toLowerCase()),
    });

    if (whitelisted) {
      // Whitelisted emails can always sign up
      return { allowed: true };
    }

    // Not whitelisted - block regardless of sign-up enabled status
    return { allowed: false, reason: "not_whitelisted" };
  }

  // Whitelist not enabled - check global sign-up setting
  if (!signUpEnabled) {
    return { allowed: false, reason: "disabled" };
  }

  return { allowed: true };
}
