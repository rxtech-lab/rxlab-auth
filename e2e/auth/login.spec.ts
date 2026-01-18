import { test, expect } from "@playwright/test";

test.describe("User Login", () => {
  // Use test.info().parallelIndex to ensure unique emails per worker
  let testUser: { email: string; password: string; displayName: string };

  test.beforeAll(async ({ browser }, testInfo) => {
    testUser = {
      email: `login-test-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Login Test User",
    };

    // Register a user for login tests
    const page = await browser.newPage();
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(testUser.displayName);
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");
    await page.close();
  });

  test("should show login form", async ({ page }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true })
    ).toBeVisible();
  });

  test("should login successfully", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page).toHaveURL("/account");
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill("WrongPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("should show error for non-existent user", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("nonexistent@example.com");
    await page.getByLabel("Password").fill("AnyPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("should redirect to requested page after login", async ({ page }) => {
    // Try to access protected page
    await page.goto("/account/passkeys");

    // Should redirect to login with redirect param
    await expect(page).toHaveURL(/\/login\?redirect=/);

    // Login
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Should redirect to originally requested page
    await expect(page).toHaveURL("/account/passkeys");
  });

  test("should have link to registration page", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL("/register");
  });

  test("should have link to forgot password page", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL("/reset-password");
  });

  test("should logout successfully", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    // Logout
    await page.getByRole("button", { name: "Avatar" }).click();
    await page.getByRole("button", { name: /sign out/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL("/login");

    // Should not be able to access protected page
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });
});
