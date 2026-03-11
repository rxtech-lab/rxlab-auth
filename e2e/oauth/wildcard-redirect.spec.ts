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

test.describe("OAuth Wildcard Redirect URI", () => {
  let testUser: { email: string; password: string; displayName: string };
  let clientId: string;
  let clientSecret: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testUser = {
      email: `wildcard-redirect-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Wildcard Redirect Test User",
    };

    const context = await browser.newContext();
    const page = await context.newPage();

    // Register test user
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(testUser.displayName);
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");

    // Logout
    await page.getByRole("button", { name: /avatar/i }).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    // Login as admin and create OAuth client with wildcard redirect URI
    await page.goto("/admin");
    await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
    await page
      .getByRole("button", { name: "Sign in with Password", exact: true })
      .click();
    await expect(page).toHaveURL("/admin/dashboard");

    await page.goto("/admin/dashboard/clients/new");
    await page
      .getByTestId("client-name")
      .fill(`Wildcard Client ${testInfo.parallelIndex}`);
    await page.getByTestId("client-type-confidential").click();

    // Enter wildcard redirect URI pattern
    await page
      .getByTestId("redirect-uri-0")
      .fill("http://*.localhost:3001/callback");

    // Enable scopes
    await page.getByTestId("profile").click();
    await page.getByTestId("email").click();

    await page.getByTestId("submit-button").click();
    await expect(page.getByText("Client Created")).toBeVisible();

    clientId = await page.getByTestId("client-id-display").inputValue();
    clientSecret = await page
      .getByTestId("client-secret-display")
      .inputValue();

    await page.close();
    await context.close();
  });

  test("should accept matching wildcard redirect URI via API", async ({
    request,
  }) => {
    // The authorize endpoint should NOT return invalid_redirect_uri error
    // for a URI matching the wildcard pattern.
    // Without a browser session, we expect a redirect to login (302) not an error (400).
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const response = await request.get("/api/oauth/authorize", {
      params: {
        client_id: clientId,
        redirect_uri: "http://app.localhost:3001/callback",
        response_type: "code",
        scope: "openid",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      },
      maxRedirects: 0,
    });

    // Should NOT be a 400 error — the redirect URI is valid
    // Without a session, the endpoint redirects to login (302)
    expect(response.status()).not.toBe(400);
  });

  test("should reject non-matching redirect URI via API", async ({
    request,
  }) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const response = await request.get("/api/oauth/authorize", {
      params: {
        client_id: clientId,
        redirect_uri: "http://evil.com/callback",
        response_type: "code",
        scope: "openid",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      },
    });

    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("invalid_redirect_uri");
  });

  test("should reject redirect URI that does not match wildcard path", async ({
    request,
  }) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const response = await request.get("/api/oauth/authorize", {
      params: {
        client_id: clientId,
        redirect_uri: "http://app.localhost:3001/other-path",
        response_type: "code",
        scope: "openid",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      },
    });

    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("invalid_redirect_uri");
  });

  test("should complete full authorization code flow with wildcard redirect URI", async ({
    page,
    request,
  }) => {
    // Login user
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(page).toHaveURL("/account");

    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = `wildcard-state-${Date.now()}`;

    // Initiate authorization with a URI matching the wildcard pattern.
    // Chromium resolves *.localhost to 127.0.0.1, so the mock server
    // on port 3001 will handle the callback.
    await page.goto(
      `/api/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent("http://app.localhost:3001/callback")}&` +
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

    // Wait for redirect to the wildcard-matched callback URL
    await page.waitForURL(/app\.localhost:3001\/callback/);
    const callbackUrl = new URL(page.url());
    const code = callbackUrl.searchParams.get("code");
    expect(code).toBeTruthy();
    expect(callbackUrl.searchParams.get("state")).toBe(state);

    // Exchange code for tokens
    const tokenResponse = await request.post("/api/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: "http://app.localhost:3001/callback",
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clientSecret,
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
});

test.describe("OAuth Wildcard Port Redirect URI", () => {
  let portWildcardClientId: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as admin and create OAuth client with wildcard port redirect URI
    await page.goto("/admin");
    await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
    await page
      .getByRole("button", { name: "Sign in with Password", exact: true })
      .click();
    await expect(page).toHaveURL("/admin/dashboard");

    await page.goto("/admin/dashboard/clients/new");
    await page
      .getByTestId("client-name")
      .fill(`Port Wildcard Client ${testInfo.parallelIndex}`);
    await page.getByTestId("client-type-public").click();

    // Enter wildcard port redirect URI pattern — this was previously rejected
    await page
      .getByTestId("redirect-uri-0")
      .fill("http://localhost:*/oauth/callback");

    // Enable scopes
    await page.getByTestId("profile").click();
    await page.getByTestId("email").click();

    await page.getByTestId("submit-button").click();
    await expect(page.getByText("Client Created")).toBeVisible();

    portWildcardClientId = await page
      .getByTestId("client-id-display")
      .inputValue();

    await page.close();
    await context.close();
  });

  test("should accept redirect URI with matching port", async ({
    request,
  }) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const response = await request.get("/api/oauth/authorize", {
      params: {
        client_id: portWildcardClientId,
        redirect_uri: "http://localhost:3000/oauth/callback",
        response_type: "code",
        scope: "openid",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      },
      maxRedirects: 0,
    });

    // Should NOT be a 400 error — the redirect URI matches the port wildcard
    expect(response.status()).not.toBe(400);
  });

  test("should reject redirect URI with non-matching path", async ({
    request,
  }) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const response = await request.get("/api/oauth/authorize", {
      params: {
        client_id: portWildcardClientId,
        redirect_uri: "http://localhost:3000/other-path",
        response_type: "code",
        scope: "openid",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      },
    });

    expect(response.status()).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("invalid_redirect_uri");
  });
});
