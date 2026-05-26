import { test, expect } from "@playwright/test";
import { handleAccountSelection } from "../fixtures/test-helpers";
import * as crypto from "crypto";

const ADMIN_PASSWORD = "e2e-test-admin-password";

// PKCE helpers
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

test.describe("OAuth Public Client Flow", () => {
  let testUser: { email: string; password: string; displayName: string };
  let publicClientId: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testUser = {
      email: `public-client-test-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Public Client Test User",
    };

    const context = await browser.newContext();
    const page = await context.newPage();

    // Register test user
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(testUser.displayName);
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account?setup=passkey");

    // Dismiss passkey setup prompt
    await page.getByTestId("skip-passkey-setup").click();
    await expect(page).toHaveURL("/account");

    // Logout
    await page.getByRole("button", { name: /avatar/i }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // Login as admin
    await page.goto("/admin");
    await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in with Password", exact: true }).click();
    await expect(page).toHaveURL("/admin/dashboard");

    // Create public OAuth client
    await page.goto("/admin/dashboard/clients/new");
    await page.getByTestId("client-name").fill(`Public SPA App ${testInfo.parallelIndex}`);

    // Select public client type
    await page.getByTestId("client-type-public").click();

    await page.getByTestId("redirect-uri-0").fill("http://localhost:3001/callback");

    // Enable scopes
    await page.getByTestId("profile").click();
    await page.getByTestId("email").click();

    await page.getByTestId("submit-button").click();
    await expect(page.getByText("Public Client Created")).toBeVisible();

    // Should NOT show client secret input field
    await expect(page.getByTestId("client-secret-display")).not.toBeVisible();

    publicClientId = await page.getByTestId("client-id-display").inputValue();

    await page.close();
    await context.close();
  });

  test("should complete authorization code flow without client_secret", async ({ page, request }) => {
    // Login user
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = `state-${Date.now()}`;

    // Request authorization
    await page.goto(
      `/api/oauth/authorize?` +
        `client_id=${publicClientId}&` +
        `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
        `response_type=code&` +
        `scope=openid%20profile%20email&` +
        `state=${state}&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256`
    );

    // Handle account selection if shown
    await handleAccountSelection(page);

    // Approve consent if shown
    const url = page.url();
    if (url.includes("/oauth/authorize")) {
      await page.getByRole("button", { name: "Allow" }).click();
    }

    // Get authorization code
    await page.waitForURL(/localhost:3001\/callback/);
    const callbackUrl = new URL(page.url());
    const code = callbackUrl.searchParams.get("code");
    expect(code).toBeTruthy();

    // Exchange code for tokens WITHOUT client_secret
    const tokenResponse = await request.post("/api/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: "http://localhost:3001/callback",
        code_verifier: codeVerifier,
        client_id: publicClientId,
        // NO client_secret provided
      },
    });

    expect(tokenResponse.ok()).toBeTruthy();
    const tokens = await tokenResponse.json();

    expect(tokens.access_token).toBeTruthy();
    expect(tokens.id_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();
    expect(tokens.token_type).toBe("Bearer");
    expect(tokens.expires_in).toBe(3600);
  });

  test("should reject public client using client_credentials grant", async ({ request }) => {
    const response = await request.post("/api/oauth/token", {
      form: {
        grant_type: "client_credentials",
        client_id: publicClientId,
        // Even without secret, should be rejected
      },
    });

    expect(response.status()).toBe(400);
    const error = await response.json();
    expect(error.error).toBe("unauthorized_client");
  });

  test("should use refresh token without client_secret", async ({ page, request }) => {
    // Login user
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Get authorization code
    await page.goto(
      `/api/oauth/authorize?` +
        `client_id=${publicClientId}&` +
        `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
        `response_type=code&` +
        `scope=openid%20profile%20email&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256`
    );

    // Handle account selection if shown
    await handleAccountSelection(page);

    // Handle consent if needed
    const url = page.url();
    if (url.includes("/oauth/authorize")) {
      await page.getByRole("button", { name: "Allow" }).click();
    }

    await page.waitForURL(/localhost:3001\/callback/);
    const callbackUrl = new URL(page.url());
    const code = callbackUrl.searchParams.get("code");

    // Get initial tokens
    const initialResponse = await request.post("/api/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: "http://localhost:3001/callback",
        code_verifier: codeVerifier,
        client_id: publicClientId,
      },
    });

    expect(initialResponse.ok()).toBeTruthy();
    const initialTokens = await initialResponse.json();

    // Use refresh token WITHOUT client_secret
    const refreshResponse = await request.post("/api/oauth/token", {
      form: {
        grant_type: "refresh_token",
        refresh_token: initialTokens.refresh_token,
        client_id: publicClientId,
        // NO client_secret
      },
    });

    expect(refreshResponse.ok()).toBeTruthy();
    const newTokens = await refreshResponse.json();
    expect(newTokens.access_token).toBeTruthy();
    expect(newTokens.refresh_token).toBeTruthy();
    expect(newTokens.access_token).not.toBe(initialTokens.access_token);
  });

  test("should still enforce PKCE for public clients", async ({ request }) => {
    const response = await request.get("/api/oauth/authorize", {
      params: {
        client_id: publicClientId,
        redirect_uri: "http://localhost:3001/callback",
        response_type: "code",
        scope: "openid",
        // Missing code_challenge - should fail
      },
    });

    const json = await response.json();
    expect(response.status()).toBe(400);
    expect(json.error).toBe("invalid_request");
    expect(json.error_description).toContain("code_challenge");
  });

  test("should revoke tokens without client_secret for public clients", async ({ page, request }) => {
    // Login and get tokens
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    await page.goto(
      `/api/oauth/authorize?` +
        `client_id=${publicClientId}&` +
        `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
        `response_type=code&` +
        `scope=openid%20profile&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256`
    );

    // Handle account selection if shown
    await handleAccountSelection(page);

    const url = page.url();
    if (url.includes("/oauth/authorize")) {
      await page.getByRole("button", { name: "Allow" }).click();
    }

    await page.waitForURL(/localhost:3001\/callback/);
    const callbackUrl = new URL(page.url());
    const code = callbackUrl.searchParams.get("code");

    const tokenResponse = await request.post("/api/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: "http://localhost:3001/callback",
        code_verifier: codeVerifier,
        client_id: publicClientId,
      },
    });

    const tokens = await tokenResponse.json();

    // Revoke refresh token without client_secret
    const revokeResponse = await request.post("/api/oauth/revoke", {
      form: {
        token: tokens.refresh_token,
        client_id: publicClientId,
        // NO client_secret
      },
    });

    // Per RFC 7009, should always return 200
    expect(revokeResponse.status()).toBe(200);

    // Try to use the revoked refresh token
    const refreshResponse = await request.post("/api/oauth/token", {
      form: {
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: publicClientId,
      },
    });

    expect(refreshResponse.status()).toBe(400);
    const error = await refreshResponse.json();
    expect(error.error).toBe("invalid_grant");
  });
});
