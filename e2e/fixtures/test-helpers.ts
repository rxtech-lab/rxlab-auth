import { Page, expect } from "@playwright/test";

export const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: "TestPassword123!",
  displayName: "Test User",
};

export async function registerUser(page: Page, user = testUser) {
  await page.goto("/register");

  await page.getByLabel("Display Name").fill(user.displayName);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);

  await page.getByRole("button", { name: "Create account" }).click();

  // Should redirect to account page (email verification skipped in E2E)
  await expect(page).toHaveURL("/account");
}

export async function loginUser(page: Page, user = testUser) {
  await page.goto("/login");

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/account");
}

export async function logoutUser(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL("/login");
}

export async function adminLogin(page: Page) {
  await page.goto("/admin");

  // Use the admin password from environment
  await page.getByLabel("Admin Password").fill(process.env.ADMIN_PASSWORD || "test-admin-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/admin/dashboard");
}

export async function createOAuthClient(
  page: Page,
  options: {
    name: string;
    redirectUri: string;
    scopes?: string[];
  }
) {
  await page.goto("/admin/dashboard/clients/new");

  await page.getByLabel("Application Name").fill(options.name);
  await page.getByPlaceholder("https://example.com/callback").fill(options.redirectUri);

  // Select additional scopes if provided
  if (options.scopes) {
    for (const scope of options.scopes) {
      if (scope !== "openid") {
        await page.getByRole("button", { name: scope }).click();
      }
    }
  }

  await page.getByRole("button", { name: "Create Application" }).click();

  // Wait for credentials to be shown
  await expect(page.getByText("Client Created Successfully")).toBeVisible();

  // Extract credentials
  const clientId = await page.locator('input[readonly]').first().inputValue();
  const clientSecret = await page.locator('input[readonly]').nth(1).inputValue();

  await page.getByRole("button", { name: "Done" }).click();

  return { clientId, clientSecret };
}
