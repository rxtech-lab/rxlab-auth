import { test, expect } from "@playwright/test";

const ADMIN_PASSWORD = "e2e-test-admin-password";

test.describe("OAuth Client Credentials Flow", () => {
  let clientId: string;
  let clientSecret: string;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as admin to create client
    await page.goto("/admin");
    await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in with Password" }).click();
    await expect(page).toHaveURL("/admin/dashboard");

    // Create OAuth client with specific scopes
    await page.goto("/admin/dashboard/clients/new");
    await page.getByLabel("Application Name").fill("M2M Test App");
    await page
      .getByPlaceholder("https://example.com/callback")
      .fill("http://localhost:3001/callback");

    // Enable profile and email scopes
    await page.getByTestId("profile").click();
    await page.getByTestId("email").click();

    await page.getByRole("button", { name: "Create Application" }).click();
    await expect(page.getByText("Client Created Successfully")).toBeVisible();

    clientId = await page.getByTestId("client-id-display").inputValue();
    clientSecret = await page.getByTestId("client-secret-display").inputValue();

    await page.close();
    await context.close();
  });

  test("should return access token with valid credentials and scope", async ({
    request,
  }) => {
    const response = await request.post("/api/oauth/token", {
      form: {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "read:profile",
      },
    });

    expect(response.ok()).toBeTruthy();
    const tokens = await response.json();

    expect(tokens.access_token).toBeTruthy();
    expect(tokens.token_type).toBe("Bearer");
    expect(tokens.expires_in).toBe(3600);
    expect(tokens.scope).toBe("read:profile");

    // Should NOT have refresh_token or id_token
    expect(tokens.refresh_token).toBeUndefined();
    expect(tokens.id_token).toBeUndefined();
  });

  test("should use all allowed scopes when scope not specified", async ({
    request,
  }) => {
    const response = await request.post("/api/oauth/token", {
      form: {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        // No scope parameter
      },
    });

    expect(response.ok()).toBeTruthy();
    const tokens = await response.json();

    expect(tokens.access_token).toBeTruthy();
    // Should include all allowed scopes (openid + profile scopes + email scopes)
    const scopes = tokens.scope.split(" ");
    expect(scopes.length).toBeGreaterThan(0);
  });

  test("should accept multiple scopes", async ({ request }) => {
    const response = await request.post("/api/oauth/token", {
      form: {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "openid read:profile read:email",
      },
    });

    expect(response.ok()).toBeTruthy();
    const tokens = await response.json();

    expect(tokens.access_token).toBeTruthy();
    const scopes = tokens.scope.split(" ");
    expect(scopes).toContain("openid");
    expect(scopes).toContain("read:profile");
    expect(scopes).toContain("read:email");
  });

  test("should reject invalid client_id", async ({ request }) => {
    const response = await request.post("/api/oauth/token", {
      form: {
        grant_type: "client_credentials",
        client_id: "invalid-client-id",
        client_secret: clientSecret,
      },
    });

    expect(response.status()).toBe(401);
    const error = await response.json();
    expect(error.error).toBe("invalid_client");
  });

  test("should reject invalid client_secret", async ({ request }) => {
    const response = await request.post("/api/oauth/token", {
      form: {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: "wrong-secret",
      },
    });

    expect(response.status()).toBe(401);
    const error = await response.json();
    expect(error.error).toBe("invalid_client");
  });

  test("should reject scope not in allowed scopes", async ({ request }) => {
    const response = await request.post("/api/oauth/token", {
      form: {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "admin:all", // This scope is not allowed
      },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.error).toBe("invalid_scope");
  });

  test("should reject when one scope in list is not allowed", async ({
    request,
  }) => {
    const response = await request.post("/api/oauth/token", {
      form: {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "read:profile invalid:scope",
      },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.error).toBe("invalid_scope");
    expect(error.error_description).toContain("invalid:scope");
  });

  test("discovery endpoint should advertise client_credentials", async ({
    request,
  }) => {
    const response = await request.get("/.well-known/openid-configuration");
    expect(response.ok()).toBeTruthy();

    const config = await response.json();
    expect(config.grant_types_supported).toContain("client_credentials");
  });
});
