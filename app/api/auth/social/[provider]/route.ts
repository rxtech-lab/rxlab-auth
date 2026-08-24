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

  const oauthState = await createSocialOAuthState({ provider, redirectTo });
  const response = NextResponse.redirect(
    buildSocialAuthorizationUrl({ provider, state: oauthState.state }),
  );
  response.cookies.set(
    socialStateCookieName(provider),
    oauthState.token,
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: `/api/auth/social/${provider}/callback`,
      maxAge: 10 * 60,
    },
  );
  return response;
}
