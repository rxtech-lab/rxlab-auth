import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import {
  appleDisplayName,
  AppleIdentityTokenError,
  parseAppleUserPayload,
  resetAppleJwksCache,
  verifyAppleIdentityToken,
} from "./apple-identity-token";

const originalFetch = globalThis.fetch;
const originalNodeEnv = process.env.NODE_ENV;
const originalTestBaseUrl = process.env.SOCIAL_OAUTH_TEST_BASE_URL;

const KID = "apple-test-key";
const keyPair = await generateKeyPair("RS256", { extractable: true });
const publicJwk: JWK = { ...(await exportJWK(keyPair.publicKey)), kid: KID, alg: "RS256", use: "sig" };

// Stand in for https://appleid.apple.com/auth/keys. Serving a real JWKS keeps
// the test on the production verification path rather than stubbing it out.
function serveJwks(keys: JWK[] = [publicJwk]) {
  globalThis.fetch = (async () => Response.json({ keys })) as typeof fetch;
}

async function signIdentityToken(
  claims: Record<string, unknown>,
  overrides: { issuer?: string; audience?: string; expiresIn?: string } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setIssuer(overrides.issuer ?? "https://appleid.apple.com")
    .setAudience(overrides.audience ?? "com.rxlab.app")
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? "10m")
    .sign(keyPair.privateKey);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

beforeEach(() => {
  resetAppleJwksCache();
  serveJwks();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  resetAppleJwksCache();
  process.env.NODE_ENV = originalNodeEnv;
  if (originalTestBaseUrl === undefined) delete process.env.SOCIAL_OAUTH_TEST_BASE_URL;
  else process.env.SOCIAL_OAUTH_TEST_BASE_URL = originalTestBaseUrl;
});

describe("verifyAppleIdentityToken", () => {
  test("returns the claims for a well-formed token", async () => {
    const token = await signIdentityToken({
      sub: "001234.abcdef",
      email: "user@example.com",
      email_verified: true,
    });

    const claims = await verifyAppleIdentityToken({
      identityToken: token,
      audiences: ["com.rxlab.app"],
    });

    expect(claims.sub).toBe("001234.abcdef");
    expect(claims.email).toBe("user@example.com");
    expect(claims.email_verified).toBe(true);
  });

  test('coerces Apple\'s string booleans', async () => {
    // Apple returns these as "true"/"false" strings in some responses.
    const token = await signIdentityToken({
      sub: "001234.abcdef",
      email: "relay@privaterelay.appleid.com",
      email_verified: "true",
      is_private_email: "true",
    });

    const claims = await verifyAppleIdentityToken({
      identityToken: token,
      audiences: ["com.rxlab.app"],
    });

    expect(claims.email_verified).toBe(true);
    expect(claims.is_private_email).toBe(true);
  });

  test("rejects a token audienced to a different app", async () => {
    const token = await signIdentityToken(
      { sub: "001234.abcdef", email: "user@example.com" },
      { audience: "com.someone.else" },
    );

    await expect(
      verifyAppleIdentityToken({
        identityToken: token,
        audiences: ["com.rxlab.app"],
      }),
    ).rejects.toMatchObject({ code: "invalid_token" });
  });

  test("rejects a token from a different issuer", async () => {
    const token = await signIdentityToken(
      { sub: "001234.abcdef" },
      { issuer: "https://evil.example.com" },
    );

    await expect(
      verifyAppleIdentityToken({
        identityToken: token,
        audiences: ["com.rxlab.app"],
      }),
    ).rejects.toMatchObject({ code: "invalid_token" });
  });

  test("rejects an expired token", async () => {
    const token = await signIdentityToken(
      { sub: "001234.abcdef" },
      { expiresIn: "-1m" },
    );

    await expect(
      verifyAppleIdentityToken({
        identityToken: token,
        audiences: ["com.rxlab.app"],
      }),
    ).rejects.toMatchObject({ code: "invalid_token" });
  });

  test("rejects a token signed by a key Apple never published", async () => {
    const attacker = await generateKeyPair("RS256", { extractable: true });
    const token = await new SignJWT({ sub: "001234.abcdef" })
      .setProtectedHeader({ alg: "RS256", kid: KID })
      .setIssuer("https://appleid.apple.com")
      .setAudience("com.rxlab.app")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(attacker.privateKey);

    await expect(
      verifyAppleIdentityToken({
        identityToken: token,
        audiences: ["com.rxlab.app"],
      }),
    ).rejects.toMatchObject({ code: "invalid_token" });
  });

  test("refuses to verify when no audience is configured", async () => {
    const token = await signIdentityToken({ sub: "001234.abcdef" });

    await expect(
      verifyAppleIdentityToken({ identityToken: token, audiences: [] }),
    ).rejects.toMatchObject({ code: "invalid_audience" });
  });

  describe("nonce binding", () => {
    test("accepts the token when the hashed nonce matches", async () => {
      const raw = "raw-nonce-value";
      const token = await signIdentityToken({
        sub: "001234.abcdef",
        email: "user@example.com",
        nonce: await sha256Hex(raw),
      });

      const claims = await verifyAppleIdentityToken({
        identityToken: token,
        audiences: ["com.rxlab.app"],
        expectedNonce: raw,
      });
      expect(claims.sub).toBe("001234.abcdef");
    });

    test("rejects a token carrying a different nonce", async () => {
      const token = await signIdentityToken({
        sub: "001234.abcdef",
        nonce: await sha256Hex("someone-elses-nonce"),
      });

      await expect(
        verifyAppleIdentityToken({
          identityToken: token,
          audiences: ["com.rxlab.app"],
          expectedNonce: "raw-nonce-value",
        }),
      ).rejects.toMatchObject({ code: "invalid_nonce" });
    });

    test("rejects a token with no nonce at all when one was expected", async () => {
      // Guards the replay hole: a missing claim must not read as a match.
      const token = await signIdentityToken({ sub: "001234.abcdef" });

      await expect(
        verifyAppleIdentityToken({
          identityToken: token,
          audiences: ["com.rxlab.app"],
          expectedNonce: "raw-nonce-value",
        }),
      ).rejects.toBeInstanceOf(AppleIdentityTokenError);
    });
  });
});

describe("parseAppleUserPayload", () => {
  test("parses the first-consent name payload", () => {
    expect(
      parseAppleUserPayload(
        '{"name":{"firstName":"Ada","lastName":"Lovelace"},"email":"ada@example.com"}',
      ),
    ).toEqual({
      name: { firstName: "Ada", lastName: "Lovelace" },
      email: "ada@example.com",
    });
  });

  test("returns null for missing or malformed JSON", () => {
    expect(parseAppleUserPayload(null)).toBeNull();
    expect(parseAppleUserPayload("not json")).toBeNull();
  });
});

describe("appleDisplayName", () => {
  test("joins the parts Apple sends separately", () => {
    expect(appleDisplayName({ firstName: "Ada", lastName: "Lovelace" })).toBe(
      "Ada Lovelace",
    );
  });

  test("tolerates a partial name", () => {
    expect(appleDisplayName({ firstName: "Ada" })).toBe("Ada");
  });

  test("is null when there's nothing usable", () => {
    expect(appleDisplayName(undefined)).toBeNull();
    expect(appleDisplayName({ firstName: "  " })).toBeNull();
  });
});
