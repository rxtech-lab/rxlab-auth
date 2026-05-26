import { test, expect } from "@playwright/test";

test.describe("User Registration", () => {
  test("should show registration form", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await expect(page.getByLabel("Display Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("should register a new user", async ({ page }, testInfo) => {
    const uniqueEmail = `test-${Date.now()}-${testInfo.parallelIndex}@example.com`;

    await page.goto("/register");

    await page.getByLabel("Display Name").fill("Test User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");

    await page.getByRole("button", { name: "Create account" }).click();

    // Should redirect to account page with passkey setup prompt (email verification skipped in E2E)
    await expect(page).toHaveURL("/account?setup=passkey");
  
  });

  test("should show error for existing email", async ({ page }, testInfo) => {
    const uniqueEmail = `test-existing-${Date.now()}-${testInfo.parallelIndex}@example.com`;

    // Register first user
    await page.goto("/register");
    await page.getByLabel("Display Name").fill("Test User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account?setup=passkey");

    // Dismiss passkey setup prompt
    await page.getByTestId("skip-passkey-setup").click();
    await expect(page).toHaveURL("/account");

    // Logout and wait for redirect to login
    await page.getByRole("button", { name: "Avatar" }).click();
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL("/login");

    // Navigate to register page
    await page.goto("/register");
    await expect(page).toHaveURL("/register");

    // Try to register with same email
    await page.getByLabel("Display Name").fill("Test User 2");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();

    // Should show error
    await expect(page.getByText(/already exists/i)).toBeVisible();
  });

  test("should validate password length", async ({ page }) => {
    await page.goto("/register");

    await page.getByLabel("Display Name").fill("Test User");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password").fill("short"); // Less than 8 characters

    await page.getByRole("button", { name: "Create account" }).click();

    // Should show validation error
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test("should have link to login page", async ({ page }) => {
    await page.goto("/register");

    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");
  });
});
