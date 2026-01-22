import { describe, expect, test } from "bun:test";
import { tokenRequestSchema, parseScopes, validateScopes } from "./oauth";

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
    if (result.success) {
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

  test("should reject client_credentials without client_secret", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "client_credentials",
      client_id: "test-client",
    });

    expect(result.success).toBe(false);
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
    if (result.success) {
      expect(result.data.scope).toBe("read:profile");
    }
  });
});

describe("tokenRequestSchema - unsupported grant types", () => {
  test("should reject unsupported grant type", () => {
    const result = tokenRequestSchema.safeParse({
      grant_type: "password",
      username: "test",
      password: "test",
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
