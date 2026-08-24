import type { SocialProviderId } from "@/lib/auth/social/providers";

export function buildUnauthenticatedAuthorizationRedirect(input: {
  requestUrl: string;
  searchParams: URLSearchParams;
  identityProvider: SocialProviderId | null;
}): URL {
  const redirectParams = new URLSearchParams(input.searchParams.toString());
  redirectParams.set("fresh_login", "true");
  const authorizationRedirect = `/api/oauth/authorize?${redirectParams.toString()}`;

  if (input.identityProvider) {
    const socialUrl = new URL(
      `/api/auth/social/${input.identityProvider}`,
      input.requestUrl,
    );
    socialUrl.searchParams.set("redirect", authorizationRedirect);
    return socialUrl;
  }

  const loginUrl = new URL("/login", input.requestUrl);
  loginUrl.searchParams.set("redirect", authorizationRedirect);
  return loginUrl;
}
