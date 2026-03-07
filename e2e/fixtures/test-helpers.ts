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

  // Should redirect to account page with passkey setup prompt (email verification skipped in E2E)
  await expect(page).toHaveURL("/account?setup=passkey", { timeout: 20000 });

  // Dismiss the passkey setup prompt so subsequent interactions aren't blocked
  const skipButton = page.getByTestId("skip-passkey-setup");
  await skipButton.click();
  await expect(page).toHaveURL("/account", { timeout: 10000 });
}

export async function loginUser(page: Page, user = testUser) {
  await page.goto("/login");

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);

  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/account", { timeout: 20000 });
}

export async function logoutUser(page: Page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL("/login");
}

export async function adminLogin(page: Page) {
  await page.goto("/admin");

  // Use the admin password from environment (matches playwright.config.ts)
  await page.getByLabel("Admin Password").fill(process.env.ADMIN_PASSWORD || "e2e-test-admin-password");
  await page.getByTestId("admin-login-button").click();

  await expect(page).toHaveURL("/admin/dashboard", { timeout: 20000 });
}

export async function createOAuthClient(
  page: Page,
  options: {
    name: string;
    redirectUri: string;
    scopes?: string[];
    clientType?: "public" | "confidential";
  }
) {
  await page.goto("/admin/dashboard/clients/new");

  await page.getByTestId("client-name").fill(options.name);

  // Select client type if specified
  if (options.clientType === "public") {
    await page.getByTestId("client-type-public").click();
  } else {
    // Default to confidential
    await page.getByTestId("client-type-confidential").click();
  }

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

  // Wait for creation message
  if (options.clientType === "public") {
    await expect(page.getByText("Public Client Created")).toBeVisible();
  } else {
    await expect(page.getByText("Client Created Successfully")).toBeVisible();
  }

  // Extract credentials using data-testid
  const clientId = await page.getByTestId("client-id-display").inputValue();

  // Only confidential clients have secrets
  let clientSecret: string | undefined;
  if (options.clientType !== "public") {
    clientSecret = await page.getByTestId("client-secret-display").inputValue();
  }

  await page.getByTestId("done-button").click();

  return { clientId, clientSecret };
}
