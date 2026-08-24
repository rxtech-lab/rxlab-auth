import { test, expect } from "@playwright/test";
import {
  adminLogin,
  createOAuthClient,
  registerUser,
} from "../fixtures/test-helpers";

test("admin can navigate between a user and their signed-in app", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const baseUiButtonErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("Base UI: A component that acts as a button")
    ) {
      baseUiButtonErrors.push(message.text());
    }
  });

  const testUser = {
    email: `sign-in-history-${Date.now()}@example.com`,
    password: "TestPassword123!",
    displayName: "Sign-in History User",
  };

  await registerUser(page, testUser);
  await adminLogin(page);

  const client = await createOAuthClient(page, {
    name: "Sign-in History App",
    redirectUri: "http://localhost:3001/callback",
  });

  const tokenResponse = await request.post("/api/oauth/token", {
    form: {
      grant_type: "password",
      username: testUser.email,
      password: testUser.password,
      client_id: client.clientId,
      client_secret: client.clientSecret!,
      scope: "openid",
    },
  });
  expect(tokenResponse.ok()).toBeTruthy();

  await page.goto("/admin/dashboard/users");
  await page.getByTestId("user-search-input").fill(testUser.email);

  const userRow = page
    .locator('[data-testid^="user-row-"]')
    .filter({ hasText: testUser.email });
  await expect(userRow).toBeVisible();
  const userLink = userRow.locator('[data-testid^="view-user-"]').last();
  await expect(userLink).toBeVisible();
  await userLink.click();

  await expect(page).toHaveURL(/\/admin\/dashboard\/users\/.+/);
  await expect(page.getByText("Signed-in applications")).toBeVisible();
  await expect(
    page.getByTestId(`signed-in-app-${client.clientId}`),
  ).toContainText("Sign-in History App");
  await expect(page.getByText("Last signed in")).toBeVisible();
  expect(baseUiButtonErrors).toEqual([]);

  await page.goto(`/admin/dashboard/clients/${client.clientId}`);
  await page.getByTestId("tab-users").click();

  const signedInUser = page.locator('a[data-testid^="signed-in-user-"]');
  await expect(signedInUser).toContainText(testUser.email);
  await expect(signedInUser).toContainText("Last signed in");
  await signedInUser.click();

  await expect(page).toHaveURL(/\/admin\/dashboard\/users\/.+/);
  await expect(page.getByText(testUser.email).first()).toBeVisible();
});
