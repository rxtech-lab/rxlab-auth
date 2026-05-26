import { test, expect } from "@playwright/test";
import { adminLogin, createOAuthClient, handleAccountSelection } from "../fixtures/test-helpers";

const ADMIN_PASSWORD = "e2e-test-admin-password";
const CODE_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

test.describe("Client Sign-in Permission", () => {
  test.describe("Admin UI", () => {
    test.beforeEach(async ({ page }) => {
      await adminLogin(page);
    });

    test("should show sign-in permission section on client edit page", async ({
      page,
    }) => {
      // Create a client first
      const { clientId } = await createOAuthClient(page, {
        name: "Permission Test App",
        redirectUri: "http://localhost:3001/callback",
        scopes: ["profile"],
      });

      // Navigate to client edit page and click Permissions tab
      await page.goto(`/admin/dashboard/clients/${clientId}`);
      await page.getByTestId("tab-permissions").click();

      // Verify sign-in permission section is visible
      await expect(
        page.getByText("Sign-in Permission", { exact: true })
      ).toBeVisible();
      await expect(
        page.getByTestId("sign-in-permission-all")
      ).toBeVisible();
      await expect(
        page.getByTestId("sign-in-permission-none")
      ).toBeVisible();
      await expect(
        page.getByTestId("sign-in-permission-whitelist")
      ).toBeVisible();

      // Verify "All Users" is selected by default
      await expect(
        page.getByTestId("sign-in-permission-all")
      ).toBeChecked();
    });

    test("should save sign-in permission setting", async ({ page }) => {
      const { clientId } = await createOAuthClient(page, {
        name: "Permission Save Test App",
        redirectUri: "http://localhost:3001/callback",
        scopes: ["profile"],
      });

      await page.goto(`/admin/dashboard/clients/${clientId}`);
      await page.getByTestId("tab-permissions").click();

      // Change to "None"
      await page.getByTestId("sign-in-permission-none").click();
      await page.getByTestId("save-sign-in-permission").click();
      await expect(
        page.getByText("Sign-in permission saved successfully")
      ).toBeVisible();

      // Reload and verify persistence
      await page.reload();
      await page.getByTestId("tab-permissions").click();
      await expect(
        page.getByTestId("sign-in-permission-none")
      ).toBeChecked();
    });

    test("should show whitelist card when whitelist permission is selected", async ({
      page,
    }) => {
      const { clientId } = await createOAuthClient(page, {
        name: "Whitelist Card Test App",
        redirectUri: "http://localhost:3001/callback",
        scopes: ["profile"],
      });

      await page.goto(`/admin/dashboard/clients/${clientId}`);
      await page.getByTestId("tab-permissions").click();

      // Initially, whitelist card should be dimmed (opacity-60)
      const whitelistCard = page.getByText("Client Sign-in Whitelist").locator("..");
      await expect(page.getByText("Client Sign-in Whitelist")).toBeVisible();

      // Change to whitelist
      await page.getByTestId("sign-in-permission-whitelist").click();
      await page.getByTestId("save-sign-in-permission").click();
      await expect(
        page.getByText("Sign-in permission saved successfully")
      ).toBeVisible();

      // Whitelist input should now be enabled
      await expect(
        page.getByTestId("client-whitelist-email-input")
      ).toBeEnabled();
    });

    test("should add and remove emails from client whitelist", async ({
      page,
    }) => {
      const { clientId } = await createOAuthClient(page, {
        name: "Whitelist Manage Test App",
        redirectUri: "http://localhost:3001/callback",
        scopes: ["profile"],
      });

      await page.goto(`/admin/dashboard/clients/${clientId}`);
      await page.getByTestId("tab-permissions").click();

      // Set to whitelist mode
      await page.getByTestId("sign-in-permission-whitelist").click();
      await page.getByTestId("save-sign-in-permission").click();
      await expect(
        page.getByText("Sign-in permission saved successfully")
      ).toBeVisible();

      // Add an email
      const testEmail = "allowed@example.com";
      await page
        .getByTestId("client-whitelist-email-input")
        .fill(testEmail);
      await page.getByTestId("add-client-whitelist-email").click();

      // Verify email appears in list
      await expect(
        page.getByTestId(`client-whitelist-email-${testEmail}`)
      ).toBeVisible();

      // Remove the email
      await page
        .getByTestId(`remove-client-whitelist-${testEmail}`)
        .click();

      // Verify email is removed
      await expect(
        page.getByTestId(`client-whitelist-email-${testEmail}`)
      ).not.toBeVisible();
    });
  });

  test.describe("OAuth Flow Enforcement", () => {
    let testUser: { email: string; password: string; displayName: string };

    test.beforeAll(async ({ browser }, testInfo) => {
      testUser = {
        email: `signin-perm-${Date.now()}-${testInfo.parallelIndex}@example.com`,
        password: "TestPassword123!",
        displayName: "Sign-in Permission Test User",
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

      await page.close();
      await context.close();
    });

    test("should block sign-in when permission is set to none", async ({
      page,
    }, testInfo) => {
      // Login as admin and create a client with permission=none
      await adminLogin(page);
      const { clientId } = await createOAuthClient(page, {
        name: `None Permission App ${Date.now()}`,
        redirectUri: "http://localhost:3001/callback",
        scopes: ["profile"],
      });

      // Set permission to none
      await page.goto(`/admin/dashboard/clients/${clientId}`);
      await page.getByTestId("tab-permissions").click();
      await page.getByTestId("sign-in-permission-none").click();
      await page.getByTestId("save-sign-in-permission").click();
      await expect(
        page.getByText("Sign-in permission saved successfully")
      ).toBeVisible();

      // Log out of admin and log in as test user
      await page.goto("/login");
      await page.getByLabel("Email").fill(testUser.email);
      await page.getByLabel("Password").fill(testUser.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL("/account");

      // Try to authorize
      await page.goto(
        `/api/oauth/authorize?` +
          `client_id=${clientId}&` +
          `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
          `response_type=code&` +
          `scope=openid&` +
          `state=test-state&` +
          `code_challenge=${CODE_CHALLENGE}&` +
          `code_challenge_method=S256`
      );

      // Handle account selection step
      await handleAccountSelection(page);

      // Should redirect with access_denied error
      await page.waitForURL(/localhost:3001\/callback/);
      const finalUrl = new URL(page.url());
      expect(finalUrl.searchParams.get("error")).toBe("access_denied");
      expect(finalUrl.searchParams.get("error_description")).toContain(
        "disabled"
      );
    });

    test("should block non-whitelisted user when permission is whitelist", async ({
      page,
    }) => {
      // Login as admin and create a client with whitelist mode
      await adminLogin(page);
      const { clientId } = await createOAuthClient(page, {
        name: `Whitelist Block App ${Date.now()}`,
        redirectUri: "http://localhost:3001/callback",
        scopes: ["profile"],
      });

      // Set permission to whitelist (without adding user's email)
      await page.goto(`/admin/dashboard/clients/${clientId}`);
      await page.getByTestId("tab-permissions").click();
      await page.getByTestId("sign-in-permission-whitelist").click();
      await page.getByTestId("save-sign-in-permission").click();
      await expect(
        page.getByText("Sign-in permission saved successfully")
      ).toBeVisible();

      // Log in as test user
      await page.goto("/login");
      await page.getByLabel("Email").fill(testUser.email);
      await page.getByLabel("Password").fill(testUser.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL("/account");

      // Try to authorize
      await page.goto(
        `/api/oauth/authorize?` +
          `client_id=${clientId}&` +
          `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
          `response_type=code&` +
          `scope=openid&` +
          `state=test-state&` +
          `code_challenge=${CODE_CHALLENGE}&` +
          `code_challenge_method=S256`
      );

      // Handle account selection step
      await handleAccountSelection(page);

      // Should redirect with access_denied error
      await page.waitForURL(/localhost:3001\/callback/);
      const finalUrl = new URL(page.url());
      expect(finalUrl.searchParams.get("error")).toBe("access_denied");
      expect(finalUrl.searchParams.get("error_description")).toContain(
        "not authorized"
      );
    });

    test("should allow whitelisted user when permission is whitelist", async ({
      page,
    }) => {
      // Login as admin and create a client with whitelist mode
      await adminLogin(page);
      const { clientId } = await createOAuthClient(page, {
        name: `Whitelist Allow App ${Date.now()}`,
        redirectUri: "http://localhost:3001/callback",
        scopes: ["profile"],
      });

      // Set permission to whitelist and add user's email
      await page.goto(`/admin/dashboard/clients/${clientId}`);
      await page.getByTestId("tab-permissions").click();
      await page.getByTestId("sign-in-permission-whitelist").click();
      await page.getByTestId("save-sign-in-permission").click();
      await expect(
        page.getByText("Sign-in permission saved successfully")
      ).toBeVisible();

      // Add user's email to whitelist
      await page
        .getByTestId("client-whitelist-email-input")
        .fill(testUser.email);
      await page.getByTestId("add-client-whitelist-email").click();
      await expect(
        page.getByTestId(
          `client-whitelist-email-${testUser.email.toLowerCase()}`
        )
      ).toBeVisible();

      // Log in as test user
      await page.goto("/login");
      await page.getByLabel("Email").fill(testUser.email);
      await page.getByLabel("Password").fill(testUser.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL("/account");

      // Try to authorize
      const state = `whitelist-allow-${Date.now()}`;
      await page.goto(
        `/api/oauth/authorize?` +
          `client_id=${clientId}&` +
          `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
          `response_type=code&` +
          `scope=openid&` +
          `state=${state}&` +
          `code_challenge=${CODE_CHALLENGE}&` +
          `code_challenge_method=S256`
      );

      // Handle account selection step
      await handleAccountSelection(page);

      // Should show consent page or redirect with code (whitelisted user can proceed)
      const url = page.url();
      if (url.includes("/oauth/authorize")) {
        // Click Allow on consent screen
        await page.getByRole("button", { name: "Allow" }).click();
      }

      await page.waitForURL(/localhost:3001\/callback/);
      const finalUrl = new URL(page.url());
      expect(finalUrl.searchParams.get("code")).toBeTruthy();
      expect(finalUrl.searchParams.get("state")).toBe(state);
    });

    test("should allow all users when permission is set to all", async ({
      page,
    }) => {
      // Login as admin and create a client with default (all) permission
      await adminLogin(page);
      const { clientId } = await createOAuthClient(page, {
        name: `All Permission App ${Date.now()}`,
        redirectUri: "http://localhost:3001/callback",
        scopes: ["profile"],
      });

      // Log in as test user
      await page.goto("/login");
      await page.getByLabel("Email").fill(testUser.email);
      await page.getByLabel("Password").fill(testUser.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL("/account");

      // Try to authorize
      const state = `all-allow-${Date.now()}`;
      await page.goto(
        `/api/oauth/authorize?` +
          `client_id=${clientId}&` +
          `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
          `response_type=code&` +
          `scope=openid&` +
          `state=${state}&` +
          `code_challenge=${CODE_CHALLENGE}&` +
          `code_challenge_method=S256`
      );

      // Handle account selection step
      await handleAccountSelection(page);

      // Should show consent page or redirect with code
      const url = page.url();
      if (url.includes("/oauth/authorize")) {
        await page.getByRole("button", { name: "Allow" }).click();
      }

      await page.waitForURL(/localhost:3001\/callback/);
      const finalUrl = new URL(page.url());
      expect(finalUrl.searchParams.get("code")).toBeTruthy();
      expect(finalUrl.searchParams.get("state")).toBe(state);
    });
  });
});
