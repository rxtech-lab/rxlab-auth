import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth/session";
import {
  getSocialSigninIntent,
  SocialAccountError,
} from "@/lib/auth/social/accounts";
import {
  parseAppleUserPayload,
  type AppleUserPayload,
} from "@/lib/auth/social/apple-identity-token";
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
  usesFormPostCallback,
  type SocialProviderId,
} from "@/lib/auth/social/providers";
import { socialSigninErrorRedirect } from "@/lib/auth/social/redirect";
import type { SocialSigninErrorCode } from "@/lib/auth/social/errors";
import {
  socialStateCookieName,
  socialStateCookieOptions,
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

function clearStateCookie(response: NextResponse, provider: SocialProviderId) {
  response.cookies.set(socialStateCookieName(provider), "", {
    ...socialStateCookieOptions(provider),
    maxAge: 0,
  });
}

// The provider's answer, normalized across transports. GitHub and Google put it
// in the query string; Apple posts a form because it refuses to put a user's
// name in a URL.
interface CallbackParams {
  state: string | null;
  code: string | null;
  error: string | null;
  appleUser: AppleUserPayload | null;
}

async function readCallbackParams(
  request: NextRequest,
  provider: SocialProviderId,
): Promise<CallbackParams> {
  if (!usesFormPostCallback(provider)) {
    const params = request.nextUrl.searchParams;
    return {
      state: params.get("state"),
      code: params.get("code"),
      error: params.get("error"),
      appleUser: null,
    };
  }

  const form = await request.formData();
  const value = (key: string) => {
    const raw = form.get(key);
    return typeof raw === "string" ? raw : null;
  };

  return {
    state: value("state"),
    code: value("code"),
    error: value("error"),
    // Apple sends `user` exactly once — on the very first consent — and never
    // again, so this is the only opportunity to learn the user's name.
    appleUser: parseAppleUserPayload(value("user")),
  };
}

async function handleCallback(
  request: NextRequest,
  providerParam: string,
): Promise<NextResponse> {
  if (!isSocialProviderId(providerParam)) {
    return socialSigninErrorRedirect({ code: "social_auth_failed" });
  }
  const provider = providerParam;

  if (!getSocialProvider(provider)) {
    const response = socialSigninErrorRedirect({ code: "social_auth_failed" });
    clearStateCookie(response, provider);
    return response;
  }

  const stateToken = request.cookies.get(socialStateCookieName(provider))?.value;
  let redirectTo = "/account";

  try {
    const params = await readCallbackParams(request, provider);

    if (!params.state || !stateToken) throw new Error("Missing OAuth state");
    const verifiedState = await verifySocialOAuthState({
      provider,
      state: params.state,
      token: stateToken,
    });
    redirectTo = verifiedState.redirectTo;

    if (params.error) {
      const response = socialSigninErrorRedirect({
        code: "social_access_denied",
        redirectTo,
      });
      clearStateCookie(response, provider);
      return response;
    }

    if (!params.code) throw new Error("Missing authorization code");

    const profile = await exchangeSocialProfile({
      provider,
      code: params.code,
      appleUser: params.appleUser,
    });
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  return handleCallback(request, provider);
}

// Apple only. Requesting the `name`/`email` scopes forces
// `response_mode=form_post`, so the result arrives as a cross-site form
// submission rather than a redirect. Every provider redirects to a GET;
// rejecting a POST here for them keeps the surface tight.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isSocialProviderId(provider) || !usesFormPostCallback(provider)) {
    return socialSigninErrorRedirect({ code: "social_auth_failed" });
  }
  return handleCallback(request, provider);
}
