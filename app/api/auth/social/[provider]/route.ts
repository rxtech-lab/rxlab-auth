import { NextRequest, NextResponse } from "next/server";
import {
  buildSocialAuthorizationUrl,
  getSocialProvider,
  isSocialProviderId,
} from "@/lib/auth/social/providers";
import { socialSigninErrorRedirect } from "@/lib/auth/social/redirect";
import {
  createSocialOAuthState,
  sanitizeRedirectPath,
  socialStateCookieName,
  socialStateCookieOptions,
} from "@/lib/auth/social/state";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const redirectTo = sanitizeRedirectPath(
    request.nextUrl.searchParams.get("redirect"),
  );

  if (!isSocialProviderId(provider) || !getSocialProvider(provider)) {
    return socialSigninErrorRedirect({
      code: "social_auth_failed",
      redirectTo,
    });
  }

  // Building the authorization URL can still fail after the provider passes the
  // configured check — Apple refuses an http or localhost redirect_uri, and
  // buildSocialAuthorizationUrl rejects rather than sending the user to a page
  // that would answer "invalid_client". Send them back to /login with a real
  // message instead of a 500.
  let authorizationUrl: URL;
  const oauthState = await createSocialOAuthState({ provider, redirectTo });
  try {
    authorizationUrl = buildSocialAuthorizationUrl({
      provider,
      state: oauthState.state,
    });
  } catch (error) {
    console.error(`Could not start ${provider} sign-in:`, error);
    return socialSigninErrorRedirect({
      code: "social_auth_failed",
      redirectTo,
    });
  }

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(
    socialStateCookieName(provider),
    oauthState.token,
    socialStateCookieOptions(provider),
  );
  return response;
}
