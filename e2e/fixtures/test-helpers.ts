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

  await page.getByTestId("client-name").fill(options.name);
  await page.getByTestId("redirect-uri-0").fill(options.redirectUri);

  // Select additional scopes if provided using data-testid
  // Scopes can be resource names (profile, email) or scope keys (read:profile, write:profile, read:email)
  if (options.scopes) {
    for (const scope of options.scopes) {
      if (scope !== "openid") {
        await page.getByTestId(scope).click();
      }
    }
  }

  await page.getByTestId("submit-button").click();

  // Wait for credentials to be shown
  await expect(page.getByText("Client Created Successfully")).toBeVisible();

  // Extract credentials using data-testid
  const clientId = await page.getByTestId("client-id-display").inputValue();
  const clientSecret = await page.getByTestId("client-secret-display").inputValue();

  await page.getByTestId("done-button").click();

  return { clientId, clientSecret };
}
