import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createSocialOAuthState,
  sanitizeRedirectPath,
  verifySocialOAuthState,
} from "./state";

const originalSecret = process.env.SESSION_SECRET;

beforeAll(() => {
  process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
});

afterAll(() => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
});

describe("social OAuth state", () => {
  test("round-trips a provider-bound state and internal redirect", async () => {
    const created = await createSocialOAuthState({
      provider: "github",
      redirectTo: "/api/oauth/authorize?client_id=macos-app&scope=openid",
    });

    await expect(
      verifySocialOAuthState({
        provider: "github",
        state: created.state,
        token: created.token,
      }),
    ).resolves.toEqual({
      provider: "github",
      state: created.state,
      redirectTo: "/api/oauth/authorize?client_id=macos-app&scope=openid",
    });
  });

  test("rejects a state replayed for another provider", async () => {
    const created = await createSocialOAuthState({
      provider: "github",
      redirectTo: "/account",
    });

    await expect(
      verifySocialOAuthState({
        provider: "google",
        state: created.state,
        token: created.token,
      }),
    ).rejects.toThrow("Invalid OAuth state");
  });

  test("blocks absolute and protocol-relative redirects", () => {
    expect(sanitizeRedirectPath("https://evil.example/callback")).toBe(
      "/account",
    );
    expect(sanitizeRedirectPath("//evil.example/callback")).toBe("/account");
    expect(sanitizeRedirectPath("/account/passkeys")).toBe(
      "/account/passkeys",
    );
  });
});
