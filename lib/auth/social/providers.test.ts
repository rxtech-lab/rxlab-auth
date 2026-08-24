import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  buildSocialAuthorizationUrl,
  exchangeSocialProfile,
  getEnabledSocialProviders,
  SocialProviderError,
} from "./providers";

const originalFetch = globalThis.fetch;
const originalEnv = {
  GITHUB_OAUTH_CLIENT_ID: process.env.GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_CLIENT_SECRET: process.env.GITHUB_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  OAUTH_ISSUER_URL: process.env.OAUTH_ISSUER_URL,
  SOCIAL_OAUTH_TEST_BASE_URL: process.env.SOCIAL_OAUTH_TEST_BASE_URL,
};

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

beforeEach(() => {
  delete process.env.GITHUB_OAUTH_CLIENT_ID;
  delete process.env.GITHUB_OAUTH_CLIENT_SECRET;
  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  delete process.env.SOCIAL_OAUTH_TEST_BASE_URL;
  process.env.OAUTH_ISSUER_URL = "https://auth.rxlab.app";
  globalThis.fetch = originalFetch;
});

afterAll(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = originalFetch;
});

describe("social provider configuration", () => {
  test("only exposes providers with a complete credential pair", () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "github-client";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "github-secret";
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client";

    expect(getEnabledSocialProviders()).toEqual([
      {
        id: "github",
        label: "Continue with GitHub",
        iconPath: "/brand/github-invertocat-black.svg",
        darkIconPath: "/brand/github-invertocat-white.svg",
      },
    ]);
  });

  test("builds the Google authorization request with the registered callback", () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-secret";

    const url = buildSocialAuthorizationUrl({
      provider: "google",
      state: "csrf-state",
    });

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("google-client");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://auth.rxlab.app/api/auth/social/google/callback",
    );
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });
});

describe("exchangeSocialProfile", () => {
  test("uses GitHub's stable account ID and a verified primary email", async () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "github-client";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "github-secret";
    const fetchMock = mock()
      .mockResolvedValueOnce(jsonResponse({ access_token: "github-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 12345,
          login: "octocat",
          name: "The Octocat",
          avatar_url: "https://avatars.githubusercontent.com/u/12345",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            email: "secondary@example.com",
            primary: false,
            verified: true,
          },
          {
            email: "Primary@Example.com",
            primary: true,
            verified: true,
          },
        ]),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      exchangeSocialProfile({ provider: "github", code: "github-code" }),
    ).resolves.toEqual({
      provider: "github",
      providerAccountId: "12345",
      email: "primary@example.com",
      name: "The Octocat",
      avatarUrl: "https://avatars.githubusercontent.com/u/12345",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("rejects GitHub accounts without a verified email", async () => {
    process.env.GITHUB_OAUTH_CLIENT_ID = "github-client";
    process.env.GITHUB_OAUTH_CLIENT_SECRET = "github-secret";
    globalThis.fetch = mock()
      .mockResolvedValueOnce(jsonResponse({ access_token: "github-token" }))
      .mockResolvedValueOnce(
        jsonResponse({ id: 12345, login: "octocat", name: null }),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          { email: "hidden@example.com", primary: true, verified: false },
        ]),
      ) as unknown as typeof fetch;

    try {
      await exchangeSocialProfile({ provider: "github", code: "code" });
      throw new Error("Expected exchangeSocialProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(SocialProviderError);
      expect((error as SocialProviderError).code).toBe(
        "verified_email_required",
      );
    }
  });

  test("maps a verified Google OpenID profile", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-secret";
    globalThis.fetch = mock()
      .mockResolvedValueOnce(jsonResponse({ access_token: "google-token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          sub: "google-subject",
          email: "Person@Example.com",
          email_verified: true,
          name: "Person Example",
          picture: "https://lh3.googleusercontent.com/avatar",
        }),
      ) as unknown as typeof fetch;

    await expect(
      exchangeSocialProfile({ provider: "google", code: "google-code" }),
    ).resolves.toEqual({
      provider: "google",
      providerAccountId: "google-subject",
      email: "person@example.com",
      name: "Person Example",
      avatarUrl: "https://lh3.googleusercontent.com/avatar",
    });
  });
});
