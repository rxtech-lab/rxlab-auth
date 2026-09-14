import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { exportJWK, exportPKCS8, generateKeyPair, SignJWT, type JWK } from "jose";
import { resetAppleClientSecretCache } from "./apple-client-secret";
import { resetAppleJwksCache } from "./apple-identity-token";
import {
  appleProfileFromClaims,
  buildSocialAuthorizationUrl,
  exchangeSocialProfile,
  getEnabledSocialProviders,
  getWebSocialProviders,
  SocialProviderError,
  usesFormPostCallback,
} from "./providers";

const APPLE_KID = "apple-test-key";
const appleSigningKey = await generateKeyPair("ES256", { extractable: true });
const applePrivateKeyPem = await exportPKCS8(appleSigningKey.privateKey);
const appleIdTokenKey = await generateKeyPair("RS256", { extractable: true });
const appleJwk: JWK = {
  ...(await exportJWK(appleIdTokenKey.publicKey)),
  kid: APPLE_KID,
  alg: "RS256",
  use: "sig",
};

function configureApple() {
  process.env.APPLE_OAUTH_SERVICES_ID = "com.rxlab.auth.web";
  process.env.APPLE_OAUTH_TEAM_ID = "TEAM123456";
  process.env.APPLE_OAUTH_KEY_ID = "KEY7890";
  process.env.APPLE_OAUTH_PRIVATE_KEY = applePrivateKeyPem;
}

function signAppleIdToken(claims: Record<string, unknown>, audience = "com.rxlab.auth.web") {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: APPLE_KID })
    .setIssuer("https://appleid.apple.com")
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(appleIdTokenKey.privateKey);
}

const originalFetch = globalThis.fetch;
const originalEnv = {
  GITHUB_OAUTH_CLIENT_ID: process.env.GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_CLIENT_SECRET: process.env.GITHUB_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  OAUTH_ISSUER_URL: process.env.OAUTH_ISSUER_URL,
  SOCIAL_OAUTH_TEST_BASE_URL: process.env.SOCIAL_OAUTH_TEST_BASE_URL,
  APPLE_OAUTH_SERVICES_ID: process.env.APPLE_OAUTH_SERVICES_ID,
  APPLE_OAUTH_TEAM_ID: process.env.APPLE_OAUTH_TEAM_ID,
  APPLE_OAUTH_KEY_ID: process.env.APPLE_OAUTH_KEY_ID,
  APPLE_OAUTH_PRIVATE_KEY: process.env.APPLE_OAUTH_PRIVATE_KEY,
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
  delete process.env.APPLE_OAUTH_SERVICES_ID;
  delete process.env.APPLE_OAUTH_TEAM_ID;
  delete process.env.APPLE_OAUTH_KEY_ID;
  delete process.env.APPLE_OAUTH_PRIVATE_KEY;
  resetAppleClientSecretCache();
  resetAppleJwksCache();
  process.env.OAUTH_ISSUER_URL = "https://auth.rxlab.app";
  globalThis.fetch = originalFetch;
});

afterAll(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetAppleClientSecretCache();
  resetAppleJwksCache();
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

  test("hides Apple until the whole signing quartet is configured", () => {
    configureApple();
    delete process.env.APPLE_OAUTH_KEY_ID;

    expect(getEnabledSocialProviders()).toEqual([]);
  });

  test("advertises Apple with its light and dark brand marks", () => {
    configureApple();

    expect(getEnabledSocialProviders()).toEqual([
      {
        id: "apple",
        label: "Continue with Apple",
        iconPath: "/brand/apple-logo-black.svg",
        darkIconPath: "/brand/apple-logo-white.svg",
      },
    ]);
  });

  test("builds the Apple authorization request with form_post", () => {
    configureApple();

    const url = buildSocialAuthorizationUrl({
      provider: "apple",
      state: "csrf-state",
    });

    expect(url.origin + url.pathname).toBe(
      "https://appleid.apple.com/auth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("com.rxlab.auth.web");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://auth.rxlab.app/api/auth/social/apple/callback",
    );
    expect(url.searchParams.get("scope")).toBe("name email");
    // Apple rejects the name/email scopes without form_post.
    expect(url.searchParams.get("response_mode")).toBe("form_post");
  });

  describe("Apple's https-only redirect_uri", () => {
    // Apple rejects http and localhost redirect URIs with a bare
    // `invalid_client` page. Catch it here rather than sending users there.
    test("hides Apple from the web login form on an http issuer", () => {
      configureApple();
      process.env.OAUTH_ISSUER_URL = "http://localhost:3000";

      expect(getEnabledSocialProviders().map((p) => p.id)).toContain("apple");
      expect(getWebSocialProviders().map((p) => p.id)).not.toContain("apple");
    });

    test("hides Apple from the web login form on an https localhost issuer", () => {
      configureApple();
      process.env.OAUTH_ISSUER_URL = "https://localhost:3000";

      expect(getWebSocialProviders().map((p) => p.id)).not.toContain("apple");
    });

    test("keeps Apple in the UI schema list so native sign-in still works", () => {
      // The native endpoint has no redirect URI, so an http issuer is no reason
      // to stop advertising Apple to an iOS client.
      configureApple();
      process.env.OAUTH_ISSUER_URL = "http://localhost:3000";

      expect(getEnabledSocialProviders().map((p) => p.id)).toEqual(["apple"]);
    });

    test("shows Apple on the web once the issuer is a real https origin", () => {
      configureApple();
      process.env.OAUTH_ISSUER_URL = "https://auth.rxlab.app";

      expect(getWebSocialProviders().map((p) => p.id)).toContain("apple");
    });

    test("refuses to build an authorization URL Apple would reject", () => {
      configureApple();
      process.env.OAUTH_ISSUER_URL = "http://localhost:3000";

      expect(() =>
        buildSocialAuthorizationUrl({ provider: "apple", state: "s" }),
      ).toThrow(SocialProviderError);
    });

    test("does not restrict the other providers", () => {
      process.env.GITHUB_OAUTH_CLIENT_ID = "github-client";
      process.env.GITHUB_OAUTH_CLIENT_SECRET = "github-secret";
      process.env.OAUTH_ISSUER_URL = "http://localhost:3000";

      expect(getWebSocialProviders().map((p) => p.id)).toEqual(["github"]);
    });
  });

  test("only Apple uses the cross-site form_post callback", () => {
    expect(usesFormPostCallback("apple")).toBe(true);
    expect(usesFormPostCallback("google")).toBe(false);
    expect(usesFormPostCallback("github")).toBe(false);
  });
});

describe("appleProfileFromClaims", () => {
  test("maps verified claims plus the first-consent name", () => {
    expect(
      appleProfileFromClaims(
        {
          sub: "001234.abcdef",
          email: "Person@Example.com",
          email_verified: true,
        },
        { name: { firstName: "Ada", lastName: "Lovelace" } },
      ),
    ).toEqual({
      provider: "apple",
      providerAccountId: "001234.abcdef",
      email: "person@example.com",
      name: "Ada Lovelace",
      avatarUrl: null,
    });
  });

  test("treats a private-relay address as a normal verified email", () => {
    const profile = appleProfileFromClaims({
      sub: "001234.abcdef",
      email: "abc123@privaterelay.appleid.com",
      email_verified: true,
    });
    expect(profile.email).toBe("abc123@privaterelay.appleid.com");
    // Repeat sign-ins carry no `user` payload, so the name is simply absent.
    expect(profile.name).toBeNull();
  });

  test("rejects claims with no email", () => {
    expect(() =>
      appleProfileFromClaims({ sub: "001234.abcdef", email_verified: true }),
    ).toThrow(SocialProviderError);
  });

  test("rejects claims Apple marked unverified", () => {
    expect(() =>
      appleProfileFromClaims({
        sub: "001234.abcdef",
        email: "person@example.com",
        email_verified: false,
      }),
    ).toThrow(SocialProviderError);
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

  test("reads the Apple profile out of the verified id_token", async () => {
    configureApple();
    const idToken = await signAppleIdToken({
      sub: "001234.abcdef",
      email: "Person@Example.com",
      email_verified: "true",
    });

    const fetchMock = mock(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      // jose fetches Apple's key set to verify the signature.
      if (url.includes("/auth/keys")) return Response.json({ keys: [appleJwk] });
      return Response.json({ id_token: idToken });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      exchangeSocialProfile({
        provider: "apple",
        code: "apple-code",
        appleUser: { name: { firstName: "Ada", lastName: "Lovelace" } },
      }),
    ).resolves.toEqual({
      provider: "apple",
      providerAccountId: "001234.abcdef",
      email: "person@example.com",
      name: "Ada Lovelace",
      avatarUrl: null,
    });
  });

  test("rejects an Apple id_token audienced to another client", async () => {
    configureApple();
    const idToken = await signAppleIdToken(
      { sub: "001234.abcdef", email: "person@example.com", email_verified: true },
      "com.someone.else",
    );

    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/auth/keys")) return Response.json({ keys: [appleJwk] });
      return Response.json({ id_token: idToken });
    }) as unknown as typeof fetch;

    try {
      await exchangeSocialProfile({ provider: "apple", code: "apple-code" });
      throw new Error("Expected exchangeSocialProfile to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(SocialProviderError);
      expect((error as SocialProviderError).code).toBe(
        "provider_response_invalid",
      );
    }
  });

  test("sends a freshly minted ES256 client secret to Apple's token endpoint", async () => {
    configureApple();
    const idToken = await signAppleIdToken({
      sub: "001234.abcdef",
      email: "person@example.com",
      email_verified: true,
    });

    let tokenBody: URLSearchParams | undefined;
    globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/auth/keys")) return Response.json({ keys: [appleJwk] });
      tokenBody = init?.body as URLSearchParams;
      return Response.json({ id_token: idToken });
    }) as unknown as typeof fetch;

    await exchangeSocialProfile({ provider: "apple", code: "apple-code" });

    expect(tokenBody?.get("client_id")).toBe("com.rxlab.auth.web");
    expect(tokenBody?.get("grant_type")).toBe("authorization_code");
    expect(tokenBody?.get("redirect_uri")).toBe(
      "https://auth.rxlab.app/api/auth/social/apple/callback",
    );
    // The secret is a JWT, not a static string.
    expect(tokenBody?.get("client_secret")?.split(".")).toHaveLength(3);
  });
});
