import { test, expect, Page, CDPSession } from "@playwright/test";

// Helper to set up WebAuthn virtual authenticator
async function setupWebAuthn(page: Page): Promise<{ cdpSession: CDPSession; authenticatorId: string }> {
  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send("WebAuthn.enable");
  const result = await cdpSession.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  return { cdpSession, authenticatorId: result.authenticatorId };
}

test.describe("Passkey Authentication", () => {
  let testUser: { email: string; password: string; displayName: string };

  test.beforeAll(async ({ browser }, testInfo) => {
    testUser = {
      email: `passkey-test-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Passkey Test User",
    };

    // Register a user for passkey tests
    const page = await browser.newPage();
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(testUser.displayName);
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");
    await page.close();
  });

  test("should show passkey management page", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    // Navigate to passkeys
    await page.getByRole("link", { name: "Passkeys" }).click();
    await expect(page).toHaveURL("/account/passkeys");

    await expect(page.getByRole("heading", { name: "Passkeys" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Passkey" })).toBeVisible();
  });

  test("should show add passkey dialog", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Navigate to passkeys and wait for hydration
    await page.waitForTimeout(3000)
    await page.goto("/account/passkeys", { waitUntil: "networkidle" });

    // Wait for the button to be visible and interactive (hydration complete)
    const addButton = page.getByRole("button", { name: "Add Passkey" });
    await addButton.waitFor({ state: "visible" });

    // Click add passkey
    await addButton.click();

    // Dialog should appear
    await expect(page.getByRole("heading", { name: "Add a Passkey" })).toBeVisible();
    await expect(page.getByLabel("Passkey Name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Register Passkey" })).toBeVisible();
  });

  test("should show passkey button on login page", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("button", { name: /sign in with passkey/i })).toBeVisible();
  });

  // Note: Full passkey registration/authentication tests require CDP WebAuthn support
  // which may not work in all environments. These tests verify the UI is correct.
});

test.describe("Passkey with Virtual Authenticator", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "WebAuthn tests only run in Chromium"
  );

  test("should register and use passkey", async ({ browser }, testInfo) => {
    const testUser = {
      email: `passkey-virtual-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Virtual Passkey User",
    };

    const context = await browser.newContext();

    try {
      // Create the page FIRST
      const page = await context.newPage();

      // Set up virtual authenticator on the SAME page we'll use for testing
      const { cdpSession, authenticatorId } = await setupWebAuthn(page);

      // Register user
      await page.goto("/register");
      await page.getByLabel("Display Name").fill(testUser.displayName);
      await page.getByLabel("Email").fill(testUser.email);
      await page.getByLabel("Password").fill(testUser.password);
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL("/account");

      // Navigate to passkeys
      await page.goto("/account/passkeys");

      // Add passkey
      await page.getByRole("button", { name: "Add Passkey" }).click();
      await page.getByLabel("Passkey Name").fill("Test Virtual Authenticator");
      await page.getByRole("button", { name: "Register Passkey" }).click();

      // Wait for registration to complete
      await expect(page.getByText("Test Virtual Authenticator")).toBeVisible({ timeout: 10000 });

      // Logout
      await page.getByRole("button", { name: "Avatar" }).click();
      await page.getByRole("button", { name: /sign out/i }).click();
      await expect(page).toHaveURL("/login");

      // Login with passkey
      await page.getByLabel("Email").fill(testUser.email);
      await page.getByRole("button", { name: /sign in with passkey/i }).click();

      // Should login successfully
      await expect(page).toHaveURL("/account", { timeout: 10000 });

      await page.close();
    } finally {
      await context.close();
    }
  });
});
