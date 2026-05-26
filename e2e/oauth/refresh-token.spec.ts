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

test.describe("OAuth Refresh Token Flow", () => {
  let testUser: { email: string; password: string; displayName: string };
  let clientId: string;
  let clientSecret: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testUser = {
      email: `refresh-test-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Refresh Token Test User",
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
    await page.getByRole("button", { name: "Avatar" }).click();
    await page.getByRole("button", { name: /sign out/i }).click();

    // Login as admin to create client
    await page.goto("/admin");
    await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in with Password" }).click();
    await expect(page).toHaveURL("/admin/dashboard");

    // Create OAuth client
    await page.goto("/admin/dashboard/clients/new");
    await page.getByLabel("Application Name").fill("Refresh Token Test App");
    await page
      .getByTestId("redirect-uri-0")
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

  test("should exchange authorization code for tokens including refresh_token", async ({
    page,
    request,
  }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    // Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = `state-${Date.now()}`;

    // Request authorization
    await page.goto(
      `/api/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
        `response_type=code&` +
        `scope=openid%20profile%20email&` +
        `state=${state}&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256`
    );

    // Handle account selection if shown
    await handleAccountSelection(page);

    // Wait for consent page or redirect
    const url = page.url();
    if (url.includes("/oauth/authorize")) {
      await page.getByRole("button", { name: "Allow" }).click();
    }

    // Should redirect to callback with code
    await page.waitForURL(/localhost:3001\/callback/);
    const callbackUrl = new URL(page.url());
    const code = callbackUrl.searchParams.get("code");
    expect(code).toBeTruthy();

    // Exchange code for tokens
    const tokenResponse = await request.post("/api/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: "http://localhost:3001/callback",
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clientSecret,
      },
    });

    expect(tokenResponse.ok()).toBeTruthy();
    const tokens = await tokenResponse.json();

    // Verify we got all expected tokens
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.token_type).toBe("Bearer");
    expect(tokens.id_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();

    console.log("Got refresh_token:", tokens.refresh_token.substring(0, 20) + "...");
  });

  test("should use refresh_token to get new access_token", async ({
    page,
    request,
  }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    // Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = `state-refresh-${Date.now()}`;

    // Request authorization
    await page.goto(
      `/api/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
        `response_type=code&` +
        `scope=openid%20profile&` +
        `state=${state}&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256`
    );

    // Handle account selection if shown
    await handleAccountSelection(page);

    // Wait for consent page or redirect (may auto-approve)
    const url = page.url();
    if (url.includes("/oauth/authorize")) {
      await page.getByRole("button", { name: "Allow" }).click();
    }

    // Get the authorization code
    await page.waitForURL(/localhost:3001\/callback/);
    const callbackUrl = new URL(page.url());
    const code = callbackUrl.searchParams.get("code");
    expect(code).toBeTruthy();

    // Exchange code for tokens
    const tokenResponse = await request.post("/api/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: "http://localhost:3001/callback",
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clientSecret,
      },
    });

    expect(tokenResponse.ok()).toBeTruthy();
    const tokens = await tokenResponse.json();
    expect(tokens.refresh_token).toBeTruthy();

    console.log("Initial refresh_token:", tokens.refresh_token.substring(0, 20) + "...");

    // Now use the refresh token to get a new access token
    const refreshResponse = await request.post("/api/oauth/token", {
      form: {
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      },
    });

    console.log("Refresh response status:", refreshResponse.status());
    const refreshResult = await refreshResponse.json();
    console.log("Refresh response body:", JSON.stringify(refreshResult, null, 2));

    // This should succeed
    expect(refreshResponse.ok()).toBeTruthy();
    expect(refreshResult.access_token).toBeTruthy();
    expect(refreshResult.refresh_token).toBeTruthy();

    // Verify the new access token works
    const userinfoResponse = await request.get("/api/oauth/userinfo", {
      headers: {
        Authorization: `Bearer ${refreshResult.access_token}`,
      },
    });

    expect(userinfoResponse.ok()).toBeTruthy();
    const userinfo = await userinfoResponse.json();
    expect(userinfo.sub).toBeTruthy();
  });

  test("should handle concurrent refresh requests with grace period", async ({
    page,
    request,
  }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    // Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = `state-concurrent-${Date.now()}`;

    // Request authorization
    await page.goto(
      `/api/oauth/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
        `response_type=code&` +
        `scope=openid&` +
        `state=${state}&` +
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

    // Exchange code for tokens
    const tokenResponse = await request.post("/api/oauth/token", {
      form: {
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: "http://localhost:3001/callback",
        code_verifier: codeVerifier,
        client_id: clientId,
        client_secret: clientSecret,
      },
    });

    const tokens = await tokenResponse.json();
    const originalRefreshToken = tokens.refresh_token;

    // Simulate concurrent refresh requests (like SSR + client + API calls)
    // With grace period, ALL should succeed
    const concurrentRefreshes = await Promise.all([
      request.post("/api/oauth/token", {
        form: {
          grant_type: "refresh_token",
          refresh_token: originalRefreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        },
      }),
      request.post("/api/oauth/token", {
        form: {
          grant_type: "refresh_token",
          refresh_token: originalRefreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        },
      }),
      request.post("/api/oauth/token", {
        form: {
          grant_type: "refresh_token",
          refresh_token: originalRefreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        },
      }),
    ]);

    // With grace period, all concurrent requests should succeed
    for (let i = 0; i < concurrentRefreshes.length; i++) {
      const response = concurrentRefreshes[i];
      const result = await response.json();
      console.log(`Concurrent request ${i + 1}:`, response.status(), result.error || "OK");
      expect(response.ok()).toBeTruthy();
      expect(result.access_token).toBeTruthy();
      expect(result.refresh_token).toBeTruthy();
    }
  });
});
