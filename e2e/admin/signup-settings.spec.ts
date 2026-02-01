import { test, expect } from "@playwright/test";
import { adminLogin } from "../fixtures/test-helpers";

const ADMIN_PASSWORD = "e2e-test-admin-password";

test.describe("Sign-up Settings", () => {
  test.beforeEach(async ({ page }) => {
    // Reset to default state before each test
    await adminLogin(page);
    await page.goto("/admin/dashboard/settings");

    // Enable public sign-up and disable whitelist by default
    const signUpSwitch = page.getByTestId("sign-up-enabled");
    const whitelistSwitch = page.getByTestId("whitelist-enabled");

    // Ensure public sign-up is enabled
    const isSignUpChecked = await signUpSwitch.isChecked();
    if (!isSignUpChecked) {
      await signUpSwitch.click();
    }

    // Ensure whitelist is disabled
    const isWhitelistChecked = await whitelistSwitch.isChecked();
    if (isWhitelistChecked) {
      await whitelistSwitch.click();
    }

    await page.getByTestId("save-settings").click();
    await expect(page.getByText("Settings saved successfully")).toBeVisible();
  });

  test("should show disabled message when public sign-up is disabled", async ({
    page,
  }) => {
    // Disable public sign-up
    await page.goto("/admin/dashboard/settings");
    const signUpSwitch = page.getByTestId("sign-up-enabled");
    await signUpSwitch.click();
    await page.getByTestId("save-settings").click();
    await expect(page.getByText("Settings saved successfully")).toBeVisible();

    // Check register page shows disabled message
    await page.goto("/register");
    await expect(page.getByTestId("signup-disabled-message")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Sign-up is disabled" })
    ).toBeVisible();
  });

  test("should allow sign-up when public sign-up is enabled", async ({
    page,
  }, testInfo) => {
    const uniqueEmail = `test-signup-enabled-${Date.now()}-${testInfo.parallelIndex}@example.com`;

    // Verify sign-up is enabled (set in beforeEach)
    await page.goto("/register");

    // Should show registration form, not disabled message
    await expect(page.getByTestId("signup-disabled-message")).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Create an account" })
    ).toBeVisible();

    // Register a new user
    await page.getByLabel("Display Name").fill("Test User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();

    // Should redirect to account page
    await expect(page).toHaveURL("/account");
  });

  test("should block non-whitelisted email when whitelist is enabled", async ({
    page,
  }, testInfo) => {
    const uniqueEmail = `test-not-whitelisted-${Date.now()}-${testInfo.parallelIndex}@example.com`;

    // Enable whitelist
    await page.goto("/admin/dashboard/settings");
    const whitelistSwitch = page.getByTestId("whitelist-enabled");
    await whitelistSwitch.click();
    await page.getByTestId("save-settings").click();
    await expect(page.getByText("Settings saved successfully")).toBeVisible();

    // Try to sign up with non-whitelisted email
    await page.goto("/register");

    // Form should be visible (whitelist mode shows form with message)
    await expect(
      page.getByRole("heading", { name: "Create an account" })
    ).toBeVisible();

    // Try to register
    await page.getByLabel("Display Name").fill("Test User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();

    // Should show error about not being whitelisted
    await expect(
      page.getByText(/not on the approved list|restricted/i)
    ).toBeVisible();
  });

  test("should allow whitelisted email to sign up even when public sign-up is disabled", async ({
    page,
  }, testInfo) => {
    const uniqueEmail = `test-whitelisted-${Date.now()}-${testInfo.parallelIndex}@example.com`;

    // Go to settings
    await page.goto("/admin/dashboard/settings");

    // Disable public sign-up
    const signUpSwitch = page.getByTestId("sign-up-enabled");
    await signUpSwitch.click();

    // Enable whitelist
    const whitelistSwitch = page.getByTestId("whitelist-enabled");
    await whitelistSwitch.click();

    await page.getByTestId("save-settings").click();
    await expect(page.getByText("Settings saved successfully")).toBeVisible();

    // Add email to whitelist
    await page.getByTestId("whitelist-email-input").fill(uniqueEmail);
    await page.getByTestId("add-whitelist-email").click();

    // Wait for email to appear in list
    await expect(
      page.getByTestId(`whitelist-email-${uniqueEmail.toLowerCase()}`)
    ).toBeVisible();

    // Try to sign up with whitelisted email
    await page.goto("/register");

    // Form should be visible (not the disabled message)
    await expect(page.getByTestId("signup-disabled-message")).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Create an account" })
    ).toBeVisible();

    // Register with whitelisted email
    await page.getByLabel("Display Name").fill("Whitelisted User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();

    // Should redirect to account page
    await expect(page).toHaveURL("/account");
  });

  test("should update register page immediately after settings change", async ({
    page,
  }) => {
    // First verify sign-up is enabled
    await page.goto("/register");
    await expect(page.getByTestId("signup-disabled-message")).not.toBeVisible();

    // Disable sign-up in admin
    await page.goto("/admin/dashboard/settings");
    const signUpSwitch = page.getByTestId("sign-up-enabled");
    await signUpSwitch.click();
    await page.getByTestId("save-settings").click();
    await expect(page.getByText("Settings saved successfully")).toBeVisible();

    // Immediately check register page - should now be disabled
    await page.goto("/register");
    await expect(page.getByTestId("signup-disabled-message")).toBeVisible();

    // Re-enable sign-up
    await page.goto("/admin/dashboard/settings");
    await signUpSwitch.click();
    await page.getByTestId("save-settings").click();
    await expect(page.getByText("Settings saved successfully")).toBeVisible();

    // Immediately check register page - should now be enabled
    await page.goto("/register");
    await expect(page.getByTestId("signup-disabled-message")).not.toBeVisible();
  });
});
