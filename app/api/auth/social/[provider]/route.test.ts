import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { verifySocialOAuthState } from "@/lib/auth/social/state";
import { GET } from "./route";

const originalEnv = {
  GITHUB_OAUTH_CLIENT_ID: process.env.GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_CLIENT_SECRET: process.env.GITHUB_OAUTH_CLIENT_SECRET,
  OAUTH_ISSUER_URL: process.env.OAUTH_ISSUER_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
};

beforeAll(() => {
  process.env.GITHUB_OAUTH_CLIENT_ID = "github-client";
  process.env.GITHUB_OAUTH_CLIENT_SECRET = "github-secret";
  process.env.OAUTH_ISSUER_URL = "https://auth.rxlab.app";
  process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
});

afterAll(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("GET /api/auth/social/[provider]", () => {
  test("redirects to GitHub with a cookie-bound state", async () => {
    const redirectTo =
      "/api/oauth/authorize?client_id=macos-app&scope=openid";
    const request = new NextRequest(
      `https://auth.rxlab.app/api/auth/social/github?redirect=${encodeURIComponent(redirectTo)}`,
    );

    const response = await GET(request, {
      params: Promise.resolve({ provider: "github" }),
    });

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin + location.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    const state = location.searchParams.get("state");
    expect(state).toBeTruthy();

    const cookie = response.cookies.get("rxlab-social-oauth-github");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    await expect(
      verifySocialOAuthState({
        provider: "github",
        state: state!,
        token: cookie!.value,
      }),
    ).resolves.toMatchObject({ redirectTo });
  });

  test("does not allow an external post-sign-in redirect", async () => {
    const request = new NextRequest(
      "https://auth.rxlab.app/api/auth/social/github?redirect=https%3A%2F%2Fevil.example",
    );
    const response = await GET(request, {
      params: Promise.resolve({ provider: "github" }),
    });
    const location = new URL(response.headers.get("location")!);
    const cookie = response.cookies.get("rxlab-social-oauth-github")!;

    await expect(
      verifySocialOAuthState({
        provider: "github",
        state: location.searchParams.get("state")!,
        token: cookie.value,
      }),
    ).resolves.toMatchObject({ redirectTo: "/account" });
  });
});
