import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { exportPKCS8, generateKeyPair, jwtVerify } from "jose";
import {
  APPLE_ISSUER,
  AppleClientSecretError,
  createAppleClientSecret,
  getAppleNativeAudiences,
  decodeApplePrivateKey,
  getAppleSigningCredentials,
  resetAppleClientSecretCache,
} from "./apple-client-secret";

const APPLE_ENV_KEYS = [
  "APPLE_OAUTH_TEAM_ID",
  "APPLE_OAUTH_KEY_ID",
  "APPLE_OAUTH_PRIVATE_KEY",
  "APPLE_OAUTH_SERVICES_ID",
  "APPLE_OAUTH_BUNDLE_IDS",
] as const;

const originalEnv = Object.fromEntries(
  APPLE_ENV_KEYS.map((key) => [key, process.env[key]]),
);

const keyPair = await generateKeyPair("ES256", { extractable: true });
const privateKeyPem = await exportPKCS8(keyPair.privateKey);
// What `base64 -i AuthKey_XXX.p8` produces: base64 of the whole PEM file.
const privateKeyBase64 = Buffer.from(privateKeyPem, "utf8").toString("base64");

beforeEach(() => {
  for (const key of APPLE_ENV_KEYS) delete process.env[key];
  resetAppleClientSecretCache();
});

afterAll(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetAppleClientSecretCache();
});

function configure(overrides: Record<string, string> = {}) {
  process.env.APPLE_OAUTH_TEAM_ID = "TEAM123456";
  process.env.APPLE_OAUTH_KEY_ID = "KEY7890";
  process.env.APPLE_OAUTH_PRIVATE_KEY = privateKeyPem;
  process.env.APPLE_OAUTH_SERVICES_ID = "com.rxlab.auth.web";
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

describe("getAppleSigningCredentials", () => {
  test("returns null unless the whole credential set is present", () => {
    configure();
    delete process.env.APPLE_OAUTH_KEY_ID;
    expect(getAppleSigningCredentials()).toBeNull();
  });

  test("returns the credentials once all four are set", () => {
    configure();
    expect(getAppleSigningCredentials()).toEqual({
      teamId: "TEAM123456",
      keyId: "KEY7890",
      privateKey: privateKeyPem,
      clientId: "com.rxlab.auth.web",
    });
  });
});

describe("createAppleClientSecret", () => {
  test("signs an ES256 JWT with the claims Apple's token endpoint requires", async () => {
    configure();
    const secret = await createAppleClientSecret();

    const { payload, protectedHeader } = await jwtVerify(
      secret,
      keyPair.publicKey,
      { issuer: "TEAM123456", audience: APPLE_ISSUER },
    );

    expect(protectedHeader.alg).toBe("ES256");
    // Apple looks the signing key up by `kid`, so it has to be in the header.
    expect(protectedHeader.kid).toBe("KEY7890");
    expect(payload.sub).toBe("com.rxlab.auth.web");
    expect(payload.exp! - payload.iat!).toBe(3600);
  });

  test("overrides the subject so a native bundle ID can be used as client_id", async () => {
    configure();
    const secret = await createAppleClientSecret("com.rxlab.app");
    const { payload } = await jwtVerify(secret, keyPair.publicKey);
    expect(payload.sub).toBe("com.rxlab.app");
  });

  test("reuses a cached secret for the same credentials", async () => {
    configure();
    const first = await createAppleClientSecret();
    const second = await createAppleClientSecret();
    expect(second).toBe(first);
  });

  test("re-mints when the subject changes", async () => {
    configure();
    const web = await createAppleClientSecret();
    const native = await createAppleClientSecret("com.rxlab.app");
    expect(native).not.toBe(web);
  });

  test("rejects when Apple is not configured", async () => {
    await expect(createAppleClientSecret()).rejects.toBeInstanceOf(
      AppleClientSecretError,
    );
  });

  test("rejects a private key that isn't a PKCS#8 ES256 key", async () => {
    configure({ APPLE_OAUTH_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nnope\n-----END PRIVATE KEY-----" });
    await expect(createAppleClientSecret()).rejects.toBeInstanceOf(
      AppleClientSecretError,
    );
  });

  test("accepts a base64-encoded .p8", async () => {
    // The recommended form: one opaque line, nothing for a shell or dashboard
    // to mangle.
    configure({ APPLE_OAUTH_PRIVATE_KEY: privateKeyBase64 });
    const secret = await createAppleClientSecret();
    await expect(jwtVerify(secret, keyPair.publicKey)).resolves.toBeDefined();
  });

  test("accepts a base64 value wrapped in stray whitespace", async () => {
    configure({ APPLE_OAUTH_PRIVATE_KEY: `  ${privateKeyBase64}\n` });
    const secret = await createAppleClientSecret();
    await expect(jwtVerify(secret, keyPair.publicKey)).resolves.toBeDefined();
  });

  test("accepts a PEM stored with literal \\n escapes", async () => {
    // How Vercel and most dashboards round-trip a multi-line secret.
    configure({ APPLE_OAUTH_PRIVATE_KEY: privateKeyPem.replace(/\n/g, "\\n") });
    const secret = await createAppleClientSecret();
    await expect(jwtVerify(secret, keyPair.publicKey)).resolves.toBeDefined();
  });

  test("accepts a raw multi-line PEM", async () => {
    configure({ APPLE_OAUTH_PRIVATE_KEY: privateKeyPem });
    const secret = await createAppleClientSecret();
    await expect(jwtVerify(secret, keyPair.publicKey)).resolves.toBeDefined();
  });

  test("rejects base64 that decodes to something other than a PEM", async () => {
    configure({
      APPLE_OAUTH_PRIVATE_KEY: Buffer.from("just some text", "utf8").toString("base64"),
    });
    await expect(createAppleClientSecret()).rejects.toBeInstanceOf(
      AppleClientSecretError,
    );
  });
});

describe("decodeApplePrivateKey", () => {
  test("decodes a base64-encoded .p8 back to its PEM", () => {
    expect(decodeApplePrivateKey(privateKeyBase64)).toBe(privateKeyPem.trim());
  });

  test("leaves a real multi-line PEM untouched", () => {
    expect(decodeApplePrivateKey(privateKeyPem)).toBe(privateKeyPem.trim());
  });

  test("expands literal escapes into newlines", () => {
    const flattened = privateKeyPem.trim().replace(/\n/g, "\\n");
    expect(decodeApplePrivateKey(flattened)).toBe(privateKeyPem.trim());
  });

  test("throws when the value decodes to something that isn't a PEM", () => {
    expect(() => decodeApplePrivateKey("bm90IGEga2V5")).toThrow(
      AppleClientSecretError,
    );
  });
});

describe("getAppleNativeAudiences", () => {
  test("is empty when no bundle IDs are configured", () => {
    expect(getAppleNativeAudiences()).toEqual([]);
  });

  test("splits, trims, and drops blanks", () => {
    process.env.APPLE_OAUTH_BUNDLE_IDS = " com.rxlab.app , ,com.rxlab.mac ";
    expect(getAppleNativeAudiences()).toEqual(["com.rxlab.app", "com.rxlab.mac"]);
  });
});
