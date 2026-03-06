import { test, expect, Page, CDPSession } from "@playwright/test";

// Helper to set up WebAuthn virtual authenticator
async function setupWebAuthn(
  page: Page
): Promise<{ cdpSession: CDPSession; authenticatorId: string }> {
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

test.describe("Passkey Setup Prompt After Signup", () => {
  test("should show passkey setup prompt after registration", async (
    { page },
    testInfo
  ) => {
    const uniqueEmail = `setup-prompt-${Date.now()}-${testInfo.parallelIndex}@example.com`;

    await page.goto("/register");
    await page.getByLabel("Display Name").fill("Prompt Test User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();

    // Should redirect to account page with setup=passkey param
    await expect(page).toHaveURL("/account?setup=passkey");

    // Passkey setup prompt should be visible
    await expect(page.getByTestId("passkey-setup-prompt")).toBeVisible();
    await expect(page.getByText("Secure your account")).toBeVisible();
    await expect(
      page.getByText("Add a passkey for faster, more secure sign-in")
    ).toBeVisible();
    await expect(page.getByTestId("setup-passkey-name")).toBeVisible();
    await expect(page.getByTestId("skip-passkey-setup")).toBeVisible();
    await expect(page.getByTestId("register-passkey-setup")).toBeVisible();
  });

  test("should allow skipping passkey setup", async ({ page }, testInfo) => {
    const uniqueEmail = `setup-skip-${Date.now()}-${testInfo.parallelIndex}@example.com`;

    await page.goto("/register");
    await page.getByLabel("Display Name").fill("Skip Test User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL("/account?setup=passkey");
    await expect(page.getByTestId("passkey-setup-prompt")).toBeVisible();

    // Click skip
    await page.getByTestId("skip-passkey-setup").click();

    // Prompt should disappear and URL should change to /account
    await expect(page).toHaveURL("/account");
    await expect(page.getByTestId("passkey-setup-prompt")).not.toBeVisible();
  });

  test("should not show passkey setup prompt on normal login", async (
    { page },
    testInfo
  ) => {
    const uniqueEmail = `setup-login-${Date.now()}-${testInfo.parallelIndex}@example.com`;

    // Register first
    await page.goto("/register");
    await page.getByLabel("Display Name").fill("Login Test User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account?setup=passkey");

    // Skip the prompt
    await page.getByTestId("skip-passkey-setup").click();
    await expect(page).toHaveURL("/account");

    // Logout
    await page.getByRole("button", { name: "Avatar" }).click();
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL("/login");

    // Login again
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Should go to /account without setup param
    await expect(page).toHaveURL("/account");

    // Prompt should NOT be visible
    await expect(page.getByTestId("passkey-setup-prompt")).not.toBeVisible();
  });
});

test.describe("Passkey Setup with Virtual Authenticator", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "WebAuthn tests only run in Chromium"
  );

  test("should register passkey via setup prompt after signup", async (
    { browser },
    testInfo
  ) => {
    const testUser = {
      email: `setup-virtual-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Setup Passkey User",
    };

    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      const { cdpSession } = await setupWebAuthn(page);

      // Register user
      await page.goto("/register");
      await page.getByLabel("Display Name").fill(testUser.displayName);
      await page.getByLabel("Email").fill(testUser.email);
      await page.getByLabel("Password").fill("TestPassword123!");
      await page.getByRole("button", { name: "Create account" }).click();

      // Should show passkey setup prompt
      await expect(page).toHaveURL("/account?setup=passkey");
      await expect(page.getByTestId("passkey-setup-prompt")).toBeVisible();

      // Fill in passkey name and register
      await page.getByTestId("setup-passkey-name").fill("My First Passkey");
      await page.getByTestId("register-passkey-setup").click();

      // Should redirect to /account after successful registration
      await expect(page).toHaveURL("/account", { timeout: 10000 });
      await expect(
        page.getByTestId("passkey-setup-prompt")
      ).not.toBeVisible();

      // Verify passkey was registered by navigating to passkeys page
      await page.goto("/account/passkeys");
      await expect(page.getByText("My First Passkey")).toBeVisible({
        timeout: 10000,
      });

      await page.close();
    } finally {
      await context.close();
    }
  });
});
