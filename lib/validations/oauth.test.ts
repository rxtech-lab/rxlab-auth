import { describe, expect, test } from "bun:test";
import {
  tokenRequestSchema,
  signupRequestSchema,
  passkeyAuthOptionsRequestSchema,
  passkeyAuthVerifyRequestSchema,
  passkeyRegisterOptionsRequestSchema,
  passkeyRegisterVerifyRequestSchema,
  parseScopes,
  validateScopes,
} from "./oauth";

const VALID_ASSERTION = {
  id: "cred-id-base64url",
  rawId: "cred-id-base64url",
  type: "public-key" as const,
  response: {
    clientDataJSON: "abc",
    authenticatorData: "def",
    signature: "ghi",
    userHandle: "jkl",
  },
};

const VALID_ATTESTATION = {
  id: "cred-id-base64url",
  rawId: "cred-id-base64url",
  type: "public-key" as const,
  response: {
    clientDataJSON: "abc",
    attestationObject: "def",
    transports: ["internal"],
  },
};

describe("tokenRequestSchema - client_credentials", () => {
  test("should accept valid client_credentials request", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "client_credentials",
      client_id: "test-client",
      client_secret: "test-secret",
    });

    expect(result.success).toBe(true);
  });

  test("should accept client_credentials with scope", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "client_credentials",
      client_id: "test-client",
      client_secret: "test-secret",
      scope: "read:profile read:email",
    });

    expect(result.success).toBe(true);
    if (result.success && result.data.grant_type === "client_credentials") {
      expect(result.data.scope).toBe("read:profile read:email");
    }
  });

  test("should reject client_credentials without client_id", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "client_credentials",
      client_secret: "test-secret",
    });

    expect(result.success).toBe(false);
  });

  test("should accept client_credentials without client_secret (validated in route)", () => {
    // client_secret is optional at validation level to allow proper error handling
    // (public clients should get unauthorized_client error, not validation error)
    const result = tokenRequestSchema.safeParse({
      grant_type: "client_credentials",
      client_id: "test-client",
    });

    expect(result.success).toBe(true);
  });

  test("should reject empty client_id", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "client_credentials",
      client_id: "",
      client_secret: "test-secret",
    });

    expect(result.success).toBe(false);
  });

  test("should reject empty client_secret", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "client_credentials",
      client_id: "test-client",
      client_secret: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("tokenRequestSchema - authorization_code", () => {
  test("should accept valid authorization_code request", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "authorization_code",
      code: "test-code",
      redirect_uri: "https://example.com/callback",
      code_verifier: "test-verifier",
      client_id: "test-client",
      client_secret: "test-secret",
    });

    expect(result.success).toBe(true);
  });

  test("should reject authorization_code without code", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "authorization_code",
      redirect_uri: "https://example.com/callback",
      code_verifier: "test-verifier",
      client_id: "test-client",
      client_secret: "test-secret",
    });

    expect(result.success).toBe(false);
  });

  test("should accept authorization_code without client_secret (public client)", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "authorization_code",
      code: "test-code",
      redirect_uri: "https://example.com/callback",
      code_verifier: "test-verifier",
      client_id: "test-client",
      // No client_secret - for public clients
    });

    expect(result.success).toBe(true);
  });

  test("should require code_verifier for PKCE", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "authorization_code",
      code: "test-code",
      redirect_uri: "https://example.com/callback",
      client_id: "test-client",
      // Missing code_verifier
    });

    expect(result.success).toBe(false);
  });
});

describe("tokenRequestSchema - refresh_token", () => {
  test("should accept valid refresh_token request", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "refresh_token",
      refresh_token: "test-refresh-token",
      client_id: "test-client",
      client_secret: "test-secret",
    });

    expect(result.success).toBe(true);
  });

  test("should accept refresh_token with optional scope", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "refresh_token",
      refresh_token: "test-refresh-token",
      client_id: "test-client",
      client_secret: "test-secret",
      scope: "read:profile",
    });

    expect(result.success).toBe(true);
    if (result.success && result.data.grant_type === "refresh_token") {
      expect(result.data.scope).toBe("read:profile");
    }
  });

  test("should accept refresh_token without client_secret (public client)", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "refresh_token",
      refresh_token: "test-refresh-token",
      client_id: "test-client",
      // No client_secret - for public clients
    });

    expect(result.success).toBe(true);
  });
});

describe("tokenRequestSchema - password", () => {
  test("should accept valid password grant request", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "password",
      username: "user@example.com",
      password: "hunter2",
      client_id: "test-client",
    });

    expect(result.success).toBe(true);
  });

  test("should accept password grant with optional scope and client_secret", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "password",
      username: "user@example.com",
      password: "hunter2",
      client_id: "test-client",
      client_secret: "test-secret",
      scope: "openid email",
    });

    expect(result.success).toBe(true);
    if (result.success && result.data.grant_type === "password") {
      expect(result.data.scope).toBe("openid email");
    }
  });

  test("should reject password grant missing username", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "password",
      password: "hunter2",
      client_id: "test-client",
    });

    expect(result.success).toBe(false);
  });

  test("should reject password grant missing password", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "password",
      username: "user@example.com",
      client_id: "test-client",
    });

    expect(result.success).toBe(false);
  });

  test("should reject password grant missing client_id", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "password",
      username: "user@example.com",
      password: "hunter2",
    });

    expect(result.success).toBe(false);
  });
});

describe("tokenRequestSchema - unsupported grant types", () => {
  test("should reject unknown grant type", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "device_code",
      client_id: "test-client",
    });

    expect(result.success).toBe(false);
  });
});

describe("signupRequestSchema", () => {
  test("should accept valid signup request", () => {
    const result = signupRequestSchema.safeParse({
      client_id: "macos-test-app",
      username: "user@example.com",
      password: "correct-horse",
    });
    expect(result.success).toBe(true);
  });

  test("should accept optional name and scope", () => {
    const result = signupRequestSchema.safeParse({
      client_id: "macos-test-app",
      username: "user@example.com",
      password: "correct-horse",
      name: "Test User",
      scope: "openid email",
    });
    expect(result.success).toBe(true);
  });

  test("should reject non-email username", () => {
    const result = signupRequestSchema.safeParse({
      client_id: "macos-test-app",
      username: "not-an-email",
      password: "correct-horse",
    });
    expect(result.success).toBe(false);
  });

  test("should reject password shorter than 8 chars", () => {
    const result = signupRequestSchema.safeParse({
      client_id: "macos-test-app",
      username: "user@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  test("should reject missing client_id", () => {
    const result = signupRequestSchema.safeParse({
      username: "user@example.com",
      password: "correct-horse",
    });
    expect(result.success).toBe(false);
  });
});

describe("passkeyAuthOptionsRequestSchema", () => {
  test("accepts minimal body", () => {
    const result = passkeyAuthOptionsRequestSchema.safeParse({
      client_id: "macos-test-app",
      redirect_uri: "rxauthswift://callback",
    });
    expect(result.success).toBe(true);
  });

  test("accepts optional username (email)", () => {
    const result = passkeyAuthOptionsRequestSchema.safeParse({
      client_id: "macos-test-app",
      redirect_uri: "rxauthswift://callback",
      username: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  test("rejects non-email username", () => {
    const result = passkeyAuthOptionsRequestSchema.safeParse({
      client_id: "macos-test-app",
      redirect_uri: "rxauthswift://callback",
      username: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing client_id", () => {
    const result = passkeyAuthOptionsRequestSchema.safeParse({
      redirect_uri: "rxauthswift://callback",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing redirect_uri", () => {
    const result = passkeyAuthOptionsRequestSchema.safeParse({
      client_id: "macos-test-app",
    });
    expect(result.success).toBe(false);
  });
});

describe("passkeyAuthVerifyRequestSchema", () => {
  test("accepts valid request", () => {
    const result = passkeyAuthVerifyRequestSchema.safeParse({
      client_id: "macos-test-app",
      session_id: "session-id",
      credential: VALID_ASSERTION,
      scope: "openid",
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing session_id", () => {
    const result = passkeyAuthVerifyRequestSchema.safeParse({
      client_id: "macos-test-app",
      credential: VALID_ASSERTION,
    });
    expect(result.success).toBe(false);
  });

  test("rejects credential missing assertion fields", () => {
    const result = passkeyAuthVerifyRequestSchema.safeParse({
      client_id: "macos-test-app",
      session_id: "session-id",
      credential: { id: "x", rawId: "x", type: "public-key", response: {} },
    });
    expect(result.success).toBe(false);
  });
});

describe("passkeyRegisterOptionsRequestSchema", () => {
  test("accepts minimal body", () => {
    const result = passkeyRegisterOptionsRequestSchema.safeParse({
      client_id: "macos-test-app",
      redirect_uri: "rxauthswift://callback",
      username: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  test("rejects non-email username", () => {
    const result = passkeyRegisterOptionsRequestSchema.safeParse({
      client_id: "macos-test-app",
      redirect_uri: "rxauthswift://callback",
      username: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing client_id", () => {
    const result = passkeyRegisterOptionsRequestSchema.safeParse({
      redirect_uri: "rxauthswift://callback",
      username: "user@example.com",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing redirect_uri", () => {
    const result = passkeyRegisterOptionsRequestSchema.safeParse({
      client_id: "macos-test-app",
      username: "user@example.com",
    });
    expect(result.success).toBe(false);
  });
});

describe("passkeyRegisterVerifyRequestSchema", () => {
  test("accepts valid request", () => {
    const result = passkeyRegisterVerifyRequestSchema.safeParse({
      client_id: "macos-test-app",
      session_id: "session-id",
      credential: VALID_ATTESTATION,
    });
    expect(result.success).toBe(true);
  });

  test("rejects credential missing attestation fields", () => {
    const result = passkeyRegisterVerifyRequestSchema.safeParse({
      client_id: "macos-test-app",
      session_id: "session-id",
      credential: { id: "x", rawId: "x", type: "public-key", response: {} },
    });
    expect(result.success).toBe(false);
  });
});

describe("parseScopes", () => {
  test("should parse space-separated scopes", () => {
    const scopes = parseScopes("openid read:profile read:email");
    expect(scopes).toContain("openid");
    expect(scopes).toContain("read:profile");
    expect(scopes).toContain("read:email");
  });

  test("should filter out invalid scopes", () => {
    const scopes = parseScopes("openid invalid_scope read:profile");
    expect(scopes).toContain("openid");
    expect(scopes).toContain("read:profile");
    expect(scopes).not.toContain("invalid_scope");
  });

  test("should handle empty string", () => {
    const scopes = parseScopes("");
    expect(scopes).toEqual([]);
  });

  test("should handle multiple spaces", () => {
    const scopes = parseScopes("openid  read:profile   read:email");
    expect(scopes.length).toBe(3);
  });
});

describe("validateScopes", () => {
  test("should return true when all requested scopes are allowed", () => {
    const allowed = ["read:profile", "read:email", "openid"];
    const requested = ["read:profile", "openid"];
    expect(validateScopes(requested, allowed)).toBe(true);
  });

  test("should return false when requested scope is not allowed", () => {
    const allowed = ["read:profile", "openid"];
    const requested = ["read:profile", "write:profile"];
    expect(validateScopes(requested, allowed)).toBe(false);
  });

  test("should return true for empty requested scopes", () => {
    const allowed = ["read:profile", "openid"];
    const requested: string[] = [];
    expect(validateScopes(requested, allowed)).toBe(true);
  });

  test("should return false when requesting scope not in allowed list", () => {
    const allowed = ["read:profile"];
    const requested = ["write:profile"];
    expect(validateScopes(requested, allowed)).toBe(false);
  });
});
