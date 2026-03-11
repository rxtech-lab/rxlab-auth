import { test, expect } from "@playwright/test";

const ADMIN_PASSWORD = "e2e-test-admin-password";

test.describe("OAuth Account Selection", () => {
  let clientId: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as admin to create OAuth client
    await page.goto("/admin");
    await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in with Password" }).click();
    await expect(page).toHaveURL("/admin/dashboard");

    // Create OAuth client
    await page.goto("/admin/dashboard/clients/new");
    await page.getByLabel("Application Name").fill("Account Select Test App");
    await page.getByTestId("redirect-uri-0").fill("http://localhost:3001/callback");
    await page.getByTestId("profile").click();
    await page.getByTestId("email").click();

    await page.getByRole("button", { name: "Create Application" }).click();
    await expect(page.getByText("Client Created Successfully")).toBeVisible();

    clientId = await page.getByTestId("client-id-display").inputValue();

    await page.close();
    await context.close();
  });

  function buildAuthorizeUrl(clientId: string, state?: string) {
    const codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    return (
      `/api/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
      `response_type=code&` +
      `scope=openid%20profile%20email&` +
      `state=${state || "test-state"}&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`
    );
  }

  test("should NOT show account selection on first-time sign-in", async ({
    page,
  }, testInfo) => {
    // Create a new user for this test
    const user = {
      email: `acct-sel-first-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "First Sign In User",
    };

    // Register the user
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(user.displayName);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");

    // Logout and wait for redirect to login page
    await page.getByRole("button", { name: "Avatar" }).click();
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL("/login");

    // Now start OAuth flow without being logged in
    await page.goto(buildAuthorizeUrl(clientId));

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);

    // Login
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Should go directly to consent page WITHOUT showing account selection
    await expect(page).toHaveURL(/\/oauth\/authorize/);
    // Verify it's the consent page, not the account select page
    expect(page.url()).not.toContain("/oauth/account-select");
    await expect(
      page.getByRole("heading", { name: "Account Select Test App" })
    ).toBeVisible();
  });

  test("should show account selection when user is already signed in", async ({
    page,
  }, testInfo) => {
    // Create a new user for this test
    const user = {
      email: `acct-sel-existing-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Already Signed In User",
    };

    // Register the user (auto-logs in)
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(user.displayName);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");

    // Now start OAuth flow while already logged in
    await page.goto(buildAuthorizeUrl(clientId));

    // Should show account selection page
    await expect(page).toHaveURL(/\/oauth\/account-select/);
    await expect(page.getByText("Choose an account")).toBeVisible();
    await expect(page.getByText(user.email)).toBeVisible();

    // Click continue with current account
    await page.getByTestId("continue-as-current").click();

    // Should proceed to consent page
    await expect(page).toHaveURL(/\/oauth\/authorize/);
    expect(page.url()).not.toContain("/oauth/account-select");
  });
});
