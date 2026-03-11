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

test.describe("User ID Consistency", () => {
  let testUser: { email: string; password: string; displayName: string };
  let clientId: string;
  let clientSecret: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    // Create unique test user
    testUser = {
      email: `userid-test-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "User ID Test User",
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
    await page.getByRole("button", { name: "Avatar" }).click();
    await page.getByRole("button", { name: /sign out/i }).click();

    // Login as admin to create OAuth client
    await page.goto("/admin");
    await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in with Password" }).click();
    await expect(page).toHaveURL("/admin/dashboard");

    // Create OAuth client
    await page.goto("/admin/dashboard/clients/new");
    await page.getByLabel("Application Name").fill("User ID Test App");
    await page
      .getByTestId("redirect-uri-0")
      .fill("http://localhost:3001/callback");
    await page.getByTestId("profile").click();
    await page.getByTestId("email").click();
    await page.getByRole("button", { name: "Create Application" }).click();
    await expect(page.getByText("Client Created Successfully")).toBeVisible();

    clientId = await page.getByTestId("client-id-display").inputValue();
    clientSecret = await page.getByTestId("client-secret-display").inputValue();

    await page.close();
    await context.close();
  });

  test("user ID from sign-in should equal user ID from refresh token", async ({
    page,
    request,
  }) => {
    // Step 1: Login user
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    // Step 2: Complete OAuth flow with PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = `state-userid-${Date.now()}`;

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

    // Handle consent if needed
    const url = page.url();
    if (url.includes("/oauth/authorize")) {
      await page.getByRole("button", { name: "Allow" }).click();
    }

    // Get authorization code
    await page.waitForURL(/localhost:3001\/callback/);
    const callbackUrl = new URL(page.url());
    const code = callbackUrl.searchParams.get("code");
    expect(code).toBeTruthy();

    // Step 3: Exchange code for initial tokens
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

    // Step 4: Get user ID from initial access token via userinfo
    const initialUserInfoResponse = await request.get("/api/oauth/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    expect(initialUserInfoResponse.ok()).toBeTruthy();
    const initialUserInfo = await initialUserInfoResponse.json();
    const initialUserId = initialUserInfo.sub;

    console.log("Initial user ID from sign-in:", initialUserId);

    // Step 5: Use refresh token to get new access token
    const refreshResponse = await request.post("/api/oauth/token", {
      form: {
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      },
    });
    expect(refreshResponse.ok()).toBeTruthy();
    const refreshedTokens = await refreshResponse.json();

    // Step 6: Get user ID from refreshed access token via userinfo
    const refreshedUserInfoResponse = await request.get("/api/oauth/userinfo", {
      headers: { Authorization: `Bearer ${refreshedTokens.access_token}` },
    });
    expect(refreshedUserInfoResponse.ok()).toBeTruthy();
    const refreshedUserInfo = await refreshedUserInfoResponse.json();
    const refreshedUserId = refreshedUserInfo.sub;

    console.log("User ID from refresh token:", refreshedUserId);

    // Step 7: CRITICAL ASSERTION - User IDs must be equal
    expect(refreshedUserId).toBe(initialUserId);
  });
});
