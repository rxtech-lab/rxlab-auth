import { describe, expect, test } from "bun:test";
import { buildUnauthenticatedAuthorizationRedirect } from "./login-redirect";

const authorizeParams = new URLSearchParams({
  client_id: "macos-app",
  redirect_uri: "rxauthswift://callback",
  response_type: "code",
  scope: "openid profile email",
  code_challenge: "challenge",
  code_challenge_method: "S256",
});

describe("buildUnauthenticatedAuthorizationRedirect", () => {
  test("keeps the existing login page flow when no provider is selected", () => {
    const url = buildUnauthenticatedAuthorizationRedirect({
      requestUrl: "https://auth.rxlab.app/api/oauth/authorize",
      searchParams: authorizeParams,
      identityProvider: null,
    });

    expect(url.pathname).toBe("/login");
    const redirect = new URL(
      url.searchParams.get("redirect")!,
      "https://auth.rxlab.app",
    );
    expect(redirect.pathname).toBe("/api/oauth/authorize");
    expect(redirect.searchParams.get("client_id")).toBe("macos-app");
    expect(redirect.searchParams.get("fresh_login")).toBe("true");
  });

  test("routes a native provider choice through social sign-in", () => {
    const params = new URLSearchParams(authorizeParams);
    params.set("identity_provider", "google");
    const url = buildUnauthenticatedAuthorizationRedirect({
      requestUrl: "https://auth.rxlab.app/api/oauth/authorize",
      searchParams: params,
      identityProvider: "google",
    });

    expect(url.pathname).toBe("/api/auth/social/google");
    const redirect = new URL(
      url.searchParams.get("redirect")!,
      "https://auth.rxlab.app",
    );
    expect(redirect.pathname).toBe("/api/oauth/authorize");
    expect(redirect.searchParams.get("identity_provider")).toBe("google");
    expect(redirect.searchParams.get("fresh_login")).toBe("true");
  });
});
