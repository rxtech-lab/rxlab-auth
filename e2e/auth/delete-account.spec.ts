import { test, expect } from "@playwright/test";

test.describe("Account Deletion", () => {
  test("should delete account via API and invalidate session", async ({ page }, testInfo) => {
    const uniqueEmail = `delete-test-${Date.now()}-${testInfo.parallelIndex}@example.com`;

    // Register a new user
    await page.goto("/register");
    await page.getByLabel("Display Name").fill("Delete Test User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");

    // Verify session is active
    const sessionResponse = await page.request.get("/api/auth/session");
    const sessionData = await sessionResponse.json();
    expect(sessionData.user).not.toBeNull();
    expect(sessionData.user.email).toBe(uniqueEmail);

    // Delete account via API
    const deleteResponse = await page.request.delete("/api/auth/delete-account");
    expect(deleteResponse.status()).toBe(200);
    const deleteData = await deleteResponse.json();
    expect(deleteData.success).toBe(true);

    // Verify session is invalidated
    const postDeleteSession = await page.request.get("/api/auth/session");
    const postDeleteData = await postDeleteSession.json();
    expect(postDeleteData.user).toBeNull();

    // Verify user cannot access protected pages
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should return 401 when not authenticated", async ({ page }) => {
    // Try to delete without being logged in
    const deleteResponse = await page.request.delete("/api/auth/delete-account");
    expect(deleteResponse.status()).toBe(401);
    const deleteData = await deleteResponse.json();
    expect(deleteData.error).toBe("Unauthorized");
  });

  test("should not allow login after account deletion", async ({ page }, testInfo) => {
    const uniqueEmail = `delete-login-${Date.now()}-${testInfo.parallelIndex}@example.com`;

    // Register a new user
    await page.goto("/register");
    await page.getByLabel("Display Name").fill("Delete Login User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");

    // Delete account via API
    const deleteResponse = await page.request.delete("/api/auth/delete-account");
    expect(deleteResponse.status()).toBe(200);

    // Try to login with deleted account credentials
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Should show error
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });
});
