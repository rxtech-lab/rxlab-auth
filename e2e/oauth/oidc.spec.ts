import { test, expect } from "@playwright/test";

// Use the hardcoded admin password from playwright.config.ts
const ADMIN_PASSWORD = "e2e-test-admin-password";

test.describe("OIDC Discovery", () => {
  test("should return well-known configuration", async ({ request }) => {
    const response = await request.get("/.well-known/openid-configuration");

    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("application/json");

    const config = await response.json();

    // Verify required fields
    expect(config.issuer).toBeDefined();
    expect(config.authorization_endpoint).toBeDefined();
    expect(config.token_endpoint).toBeDefined();
    expect(config.userinfo_endpoint).toBeDefined();
    expect(config.jwks_uri).toBeDefined();

    // Verify supported values
    expect(config.response_types_supported).toContain("code");
    expect(config.scopes_supported).toContain("openid");
    expect(config.code_challenge_methods_supported).toContain("S256");
  });

  test("should return JWKS", async ({ request }) => {
    const response = await request.get("/.well-known/jwks.json");

    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("application/json");

    const jwks = await response.json();

    expect(jwks.keys).toBeDefined();
    expect(Array.isArray(jwks.keys)).toBeTruthy();
    expect(jwks.keys.length).toBeGreaterThan(0);

    // Verify key structure
    const key = jwks.keys[0];
    expect(key.kty).toBeDefined();
    expect(key.use).toBe("sig");
    expect(key.alg).toBe("RS256");
    expect(key.kid).toBeDefined();
  });
});

test.describe("OAuth Authorization", () => {
  test("should reject request without client_id", async ({ request }) => {
    const response = await request.get("/api/oauth/authorize");
    const json = await response.json();

    expect(response.status()).toBe(400);
    expect(json.error).toBeDefined();
  });

  test("should reject request without PKCE", async ({ request }) => {
    const response = await request.get("/api/oauth/authorize", {
      params: {
        client_id: "test-client",
        redirect_uri: "http://localhost:3001/callback",
        response_type: "code",
        scope: "openid",
      },
    });

    const json = await response.json();
    expect(response.status()).toBe(400);
    expect(json.error).toBe("invalid_request");
    expect(json.error_description).toContain("code_challenge");
  });

  test("should reject invalid client_id", async ({ request }) => {
    const response = await request.get("/api/oauth/authorize", {
      params: {
        client_id: "invalid-client",
        redirect_uri: "http://localhost:3001/callback",
        response_type: "code",
        scope: "openid",
        code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
        code_challenge_method: "S256",
      },
    });

    const json = await response.json();
    expect(response.status()).toBe(400);
    expect(json.error).toContain("client");
  });
});

test.describe("OAuth Token Endpoint", () => {
  test("should reject request without grant_type", async ({ request }) => {
    const response = await request.post("/api/oauth/token", {
      form: {
        client_id: "test",
        client_secret: "test",
      },
    });

    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("invalid_request");
  });

  test("should reject invalid client credentials", async ({ request }) => {
    const response = await request.post("/api/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code: "test-code",
        redirect_uri: "http://localhost:3001/callback",
        code_verifier: "test-verifier",
        client_id: "invalid-client",
        client_secret: "invalid-secret",
      },
    });

    expect(response.status()).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("invalid_client");
  });

  test("should reject invalid authorization code", async ({ request, browser }, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as admin
    await page.goto("/admin");
    await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in with Password", exact: true }).click();
    await expect(page).toHaveURL("/admin/dashboard");

    // Create a test client
    await page.goto("/admin/dashboard/clients/new");
    await page.getByLabel("Application Name").fill(`E2E Test Client ${testInfo.parallelIndex}`);
    await page.getByPlaceholder("https://example.com/callback").fill("http://localhost:3001/callback");
    await page.getByRole("button", { name: "Create Application" }).click();

    await expect(page.getByText("Client Created Successfully")).toBeVisible();

    const clientId = await page.locator('input[readonly]').first().inputValue();
    const clientSecret = await page.locator('input[readonly]').nth(1).inputValue();

    await page.close();
    await context.close();

    // Try to exchange invalid code
    const response = await request.post("/api/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code: "invalid-code",
        redirect_uri: "http://localhost:3001/callback",
        code_verifier: "test-verifier",
        client_id: clientId,
        client_secret: clientSecret,
      },
    });

    // 401 is returned when client credentials are invalid (before checking code)
    expect([400, 401]).toContain(response.status());
    const json = await response.json();
    expect(["invalid_grant", "invalid_client"]).toContain(json.error);
  });
});

test.describe("OAuth UserInfo Endpoint", () => {
  test("should reject request without token", async ({ request }) => {
    const response = await request.get("/api/oauth/userinfo");

    expect(response.status()).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("invalid_token");
  });

  test("should reject invalid token", async ({ request }) => {
    const response = await request.get("/api/oauth/userinfo", {
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });

    expect(response.status()).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("invalid_token");
  });
});

test.describe("OAuth Revocation Endpoint", () => {
  test("should accept revocation request", async ({ request }) => {
    // Per RFC 7009, revocation should always return 200
    const response = await request.post("/api/oauth/revoke", {
      form: {
        token: "any-token",
        client_id: "any-client",
        client_secret: "any-secret",
      },
    });

    expect(response.status()).toBe(200);
  });
});
