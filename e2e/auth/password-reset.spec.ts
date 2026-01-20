import { test, expect } from "@playwright/test";


test.describe("Password Reset - Single Use Token", () => {
  let testUser: { email: string; password: string; displayName: string };

  test.beforeAll(async ({ browser }, testInfo) => {
    testUser = {
      email: `reset-test-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Reset Test User",
    };

    // Register a user for password reset tests
    const page = await browser.newPage();
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(testUser.displayName);
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");
    await page.close();
  });

  test("should show forgot password form", async ({ page }) => {
    await page.goto("/reset-password");

    await expect(
      page.getByRole("heading", { name: /forgot your password/i })
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send reset link" })
    ).toBeVisible();
  });

  test("should request password reset successfully", async ({ page }) => {
    await page.goto("/reset-password");

    await page.getByLabel("Email").fill(testUser.email);
    await page.getByTestId("send-reset-link").click();

    // Should show success message
    await expect(page.getByTestId("check-email-heading")).toBeVisible();
  });

  test("should show reset form with valid token", async ({ page, request }) => {
    // Request password reset
    await page.goto("/reset-password");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByTestId("check-email-heading")).toBeVisible();

    // Get the token via E2E API
    const tokenResponse = await request.get(
      `/api/e2e/password-reset-token?email=${encodeURIComponent(testUser.email)}`
    );

    // check response status
    expect(tokenResponse.ok()).toBeTruthy();
    const { token } = await tokenResponse.json();
  
    // Visit reset page with token
    await page.goto(`/reset-password?token=${token}`);

    // Should show password reset form
    await expect(
      page.getByRole("heading", { name: /reset your password/i })
    ).toBeVisible();
    await expect(page.getByLabel("New Password")).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).toBeVisible();
  });

  test("should expire token after first visit - prevent reuse", async ({
    page,
    request,
    browser,
  }) => {
    // Request a fresh password reset
    await page.goto("/reset-password");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByTestId("check-email-heading")).toBeVisible();

    // Get the token via E2E API
    const tokenResponse = await request.get(
      `/api/e2e/password-reset-token?email=${encodeURIComponent(testUser.email)}`
    );
    expect(tokenResponse.ok()).toBeTruthy();
    const { token } = await tokenResponse.json();

    // First visit - should show the reset form
    await page.goto(`/reset-password?token=${token}`);
    await expect(
      page.getByRole("heading", { name: /reset your password/i })
    ).toBeVisible();

    // Second visit in a new page - token should be expired/used
    const newPage = await browser.newPage();
    await newPage.goto(`/reset-password?token=${token}`);

    // Should show link expired/already used message
    await expect(
      newPage.getByRole("heading", { name: /link expired/i })
    ).toBeVisible();
    await expect(
      newPage.getByText(/already been used/i)
    ).toBeVisible();

    await newPage.close();
  });

  test("should successfully reset password with valid token", async ({
    page,
    request,
  }) => {
    const newPassword = "NewPassword456!";

    // Request a fresh password reset
    await page.goto("/reset-password");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByTestId("check-email-heading")).toBeVisible();

    // Get the token via E2E API
    const tokenResponse = await request.get(
      `/api/e2e/password-reset-token?email=${encodeURIComponent(testUser.email)}`
    );
    expect(tokenResponse.ok()).toBeTruthy();
    const { token } = await tokenResponse.json();

    // Visit reset page with token
    await page.goto(`/reset-password?token=${token}`);
    await expect(
      page.getByRole("heading", { name: /reset your password/i })
    ).toBeVisible();

    // Fill in new password
    await page.getByLabel("New Password").fill(newPassword);
    await page.getByLabel("Confirm Password").fill(newPassword);
    await page.getByRole("button", { name: "Reset password" }).click();

    // Should redirect to login with success message
    await expect(page).toHaveURL(/\/login\?reset=true/);

    // Verify can login with new password
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/account");

    // Update testUser password for potential future tests
    testUser.password = newPassword;
  });

  test("should show error for expired token", async ({ page }) => {
    // Use a random invalid/expired token
    await page.goto("/reset-password?token=invalid-token-12345");

    // Should show link expired message
    await expect(
      page.getByRole("heading", { name: /link expired/i })
    ).toBeVisible();
  });

  test("should show error for mismatched passwords", async ({
    page,
    request,
  }) => {
    // Request a fresh password reset
    await page.goto("/reset-password");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByTestId("check-email-heading")).toBeVisible();

    // Get the token via E2E API
    const tokenResponse = await request.get(
      `/api/e2e/password-reset-token?email=${encodeURIComponent(testUser.email)}`
    );
    expect(tokenResponse.ok()).toBeTruthy();
    const { token } = await tokenResponse.json();

    // Visit reset page with token
    await page.goto(`/reset-password?token=${token}`);

    // Fill in mismatched passwords
    await page.getByLabel("New Password").fill("Password123!");
    await page.getByLabel("Confirm Password").fill("DifferentPassword456!");
    await page.getByRole("button", { name: "Reset password" }).click();

    // Should show error
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });
});
