import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import {
  getSocialSigninIntent,
  SocialAccountError,
} from "@/lib/auth/social/accounts";
import {
  createPendingSocialSignin,
  pendingSocialSigninCookieName,
  pendingSocialSigninCookieOptions,
} from "@/lib/auth/social/pending";
import {
  exchangeSocialProfile,
  getOAuthIssuerUrl,
  getSocialProvider,
  isSocialProviderId,
  SocialProviderError,
} from "@/lib/auth/social/providers";
import { socialSigninErrorRedirect } from "@/lib/auth/social/redirect";
import type { SocialSigninErrorCode } from "@/lib/auth/social/errors";
import {
  socialStateCookieName,
  verifySocialOAuthState,
} from "@/lib/auth/social/state";

function errorCodeFor(error: unknown): SocialSigninErrorCode {
  if (error instanceof SocialAccountError) {
    switch (error.code) {
      case "account_conflict":
        return "social_account_conflict";
      case "signup_disabled":
        return "social_signup_disabled";
      case "signup_not_whitelisted":
        return "social_signup_restricted";
      default:
        return "social_auth_failed";
    }
  }
  if (
    error instanceof SocialProviderError &&
    error.code === "verified_email_required"
  ) {
    return "social_verified_email_required";
  }
  return "social_auth_failed";
}

function clearStateCookie(
  response: NextResponse,
  provider: "github" | "google",
) {
  response.cookies.set(socialStateCookieName(provider), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/api/auth/social/${provider}/callback`,
    maxAge: 0,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isSocialProviderId(provider)) {
    return socialSigninErrorRedirect({ code: "social_auth_failed" });
  }
  if (!getSocialProvider(provider)) {
    const response = socialSigninErrorRedirect({ code: "social_auth_failed" });
    clearStateCookie(response, provider);
    return response;
  }

  const state = request.nextUrl.searchParams.get("state");
  const stateToken = request.cookies.get(socialStateCookieName(provider))?.value;
  let redirectTo = "/account";

  try {
    if (!state || !stateToken) throw new Error("Missing OAuth state");
    const verifiedState = await verifySocialOAuthState({
      provider,
      state,
      token: stateToken,
    });
    redirectTo = verifiedState.redirectTo;

    if (request.nextUrl.searchParams.has("error")) {
      const response = socialSigninErrorRedirect({
        code: "social_access_denied",
        redirectTo,
      });
      clearStateCookie(response, provider);
      return response;
    }

    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new Error("Missing authorization code");

    const profile = await exchangeSocialProfile({ provider, code });
    const intent = await getSocialSigninIntent(profile);

    if (intent.kind === "sign_in") {
      await createSession(intent.user.id, intent.user.email);

      const response = NextResponse.redirect(
        new URL(redirectTo, getOAuthIssuerUrl()),
      );
      clearStateCookie(response, provider);
      return response;
    }

    const pendingToken = await createPendingSocialSignin(
      intent.kind === "connect"
        ? {
            kind: "connect",
            userId: intent.user.id,
            profile,
            redirectTo,
          }
        : { kind: "create", profile, redirectTo },
    );

    const response = NextResponse.redirect(
      new URL("/social/confirm", getOAuthIssuerUrl()),
    );
    response.cookies.set(
      pendingSocialSigninCookieName,
      pendingToken,
      pendingSocialSigninCookieOptions,
    );
    clearStateCookie(response, provider);
    return response;
  } catch (error) {
    console.error(`Social sign-in failed for ${provider}:`, error);
    const response = socialSigninErrorRedirect({
      code: errorCodeFor(error),
      redirectTo,
    });
    clearStateCookie(response, provider);
    return response;
  }
}
