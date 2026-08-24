"use server";

import { cookies } from "next/headers";
import { completeSocialSignin, SocialAccountError } from "@/lib/auth/social/accounts";
import {
  pendingSocialSigninCookieName,
  pendingSocialSigninCookieOptions,
  verifyPendingSocialSignin,
} from "@/lib/auth/social/pending";
import { createSession } from "@/lib/auth/session";

export interface SocialSigninConfirmationResult {
  success: boolean;
  redirectUrl?: string;
  error?: string;
}

async function clearPendingSocialSignin(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(pendingSocialSigninCookieName, "", {
    ...pendingSocialSigninCookieOptions,
    maxAge: 0,
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof SocialAccountError) {
    switch (error.code) {
      case "account_conflict":
        return "This social account is already connected to another account.";
      case "flow_changed":
      case "user_not_found":
        return "Your account details changed. Start social sign-in again.";
      case "signup_disabled":
        return "Sign-up is currently disabled.";
      case "signup_not_whitelisted":
        return "Sign-up is restricted to approved email addresses.";
    }
  }

  return "Social sign-in could not be completed. Please try again.";
}

export async function confirmSocialSignin(): Promise<SocialSigninConfirmationResult> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(pendingSocialSigninCookieName)?.value;
    if (!token) {
      return {
        success: false,
        error: "This social sign-in request has expired. Start again.",
      };
    }

    const pending = await verifyPendingSocialSignin(token);
    const user = await completeSocialSignin({
      kind: pending.kind,
      userId: pending.kind === "connect" ? pending.userId : undefined,
      profile: pending.profile,
      redirectTo: pending.redirectTo,
    });

    await createSession(user.id, user.email);
    await clearPendingSocialSignin();

    return { success: true, redirectUrl: pending.redirectTo };
  } catch (error) {
    console.error("Social sign-in confirmation failed:", error);
    return { success: false, error: errorMessage(error) };
  }
}

export async function cancelSocialSignin(): Promise<{ redirectUrl: string }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(pendingSocialSigninCookieName)?.value;
  let redirectTo = "/account";

  if (token) {
    try {
      redirectTo = (await verifyPendingSocialSignin(token)).redirectTo;
    } catch {
      // Treat an invalid or expired pending request as an ordinary cancellation.
    }
  }

  await clearPendingSocialSignin();

  if (redirectTo === "/account") return { redirectUrl: "/login" };
  const params = new URLSearchParams({ redirect: redirectTo });
  return { redirectUrl: `/login?${params.toString()}` };
}
