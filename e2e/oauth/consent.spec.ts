import { test, expect } from "@playwright/test";

// Use the hardcoded admin password from playwright.config.ts
const ADMIN_PASSWORD = "e2e-test-admin-password";

test.describe("OAuth Consent Flow", () => {
  let testUser: { email: string; password: string; displayName: string };
  let clientId: string;
  let clientSecret: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    testUser = {
      email: `consent-test-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Consent Test User",
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

    // Login as admin to create client
    await page.goto("/admin");
    await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in with Password' }).click();
    await expect(page).toHaveURL("/admin/dashboard");

    // Create OAuth client
    await page.goto("/admin/dashboard/clients/new");
    await page.getByLabel("Application Name").fill("Consent Test App");
    await page.getByPlaceholder("https://example.com/callback").fill("http://localhost:3001/callback");

    // Enable profile and email scopes
    await page.getByTestId('profile').click();
    await page.getByTestId('email').click();

    await page.getByRole("button", { name: "Create Application" }).click();
    await expect(page.getByText("Client Created Successfully")).toBeVisible();

    clientId = await page.getByTestId("client-id-display").inputValue();
    clientSecret = await page.getByTestId("client-secret-display").inputValue();

    await page.close();
    await context.close();
  });

  test("should redirect to login when not authenticated", async ({ page }) => {
    // Generate PKCE
    const codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    await page.goto(
      `/api/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
      `response_type=code&` +
      `scope=openid%20profile%20email&` +
      `state=test-state&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`
    );

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("should show consent screen for new authorization", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    // Generate PKCE
    const codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    // Request authorization
    await page.goto(
      `/api/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
      `response_type=code&` +
      `scope=openid%20profile%20email&` +
      `state=test-state&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`
    );

    // Should show consent page
    await expect(page).toHaveURL(/\/oauth\/authorize/);
    await expect(page.getByRole('heading', { name: 'Consent Test App' })).toBeVisible();
    await expect(page.getByText(/wants to access your account/i)).toBeVisible();

    // Should have Allow and Deny buttons
    await expect(page.getByRole("button", { name: "Allow" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Deny" })).toBeVisible();
  });

  test("should redirect with code after approving consent", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    // Request authorization with new unique state
    const state = `state-${Date.now()}`;
    const codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

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

    // Wait for consent page or redirect (might auto-approve if already consented)
    const url = page.url();
    if (url.includes("/oauth/authorize")) {
      // Click Allow
      await page.getByRole("button", { name: "Allow" }).click();
    }

    // Should redirect to callback with code
    await page.waitForURL(/localhost:3001\/callback/);
    const finalUrl = new URL(page.url());
    expect(finalUrl.searchParams.get("code")).toBeTruthy();
    expect(finalUrl.searchParams.get("state")).toBe(state);
  });

  test("should redirect with error after denying consent", async ({ page }, testInfo) => {
    // Create a new user for this test
    const denyUser = {
      email: `deny-test-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Deny Test User",
    };

    // Register
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(denyUser.displayName);
    await page.getByLabel("Email").fill(denyUser.email);
    await page.getByLabel("Password").fill(denyUser.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");

    // Request authorization
    const state = `deny-state-${Date.now()}`;
    const codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

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

    // Should show consent page
    await expect(page).toHaveURL(/\/oauth\/authorize/);

    // Click Deny
    await page.getByRole("button", { name: "Deny" }).click();

    // Should redirect with error
    await page.waitForURL(/localhost:3001\/callback/);
    const finalUrl = new URL(page.url());
    expect(finalUrl.searchParams.get("error")).toBe("access_denied");
    expect(finalUrl.searchParams.get("state")).toBe(state);
  });

  test("should revoke app access", async ({ page }, testInfo) => {
    // Create a new user for this test
    const revokeUser = {
      email: `revoke-test-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Revoke Test User",
    };

    // Register
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(revokeUser.displayName);
    await page.getByLabel("Email").fill(revokeUser.email);
    await page.getByLabel("Password").fill(revokeUser.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");

    // Request authorization and approve
    const codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    await page.goto(
      `/api/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
      `response_type=code&` +
      `scope=openid&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`
    );

    await expect(page).toHaveURL(/\/oauth\/authorize/);
    await page.getByRole("button", { name: "Allow" }).click();
    await page.waitForURL(/localhost:3001\/callback/);

    // Go back and check connected apps
    await page.goto("/account/apps");
    await expect(page.getByText("Consent Test App")).toBeVisible();

    // Accept confirm dialog
    page.on("dialog", (dialog) => dialog.accept());

    // Revoke access
    await page.getByRole("button", { name: "Revoke" }).click();

    // App should be removed
    await expect(page.getByText("No connected applications")).toBeVisible();
  });
});
