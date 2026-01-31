import { test, expect } from "@playwright/test";
import { registerUser } from "../fixtures/test-helpers";

const ADMIN_PASSWORD = "e2e-test-admin-password";

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in with Password" }).click();
  await expect(page).toHaveURL("/admin/dashboard");
}

// Create unique test users for each test run
function createTestUser(testId: string) {
  return {
    email: `search-test-${testId}-${Date.now()}@example.com`,
    password: "TestPassword123!",
    displayName: `Search Test User ${testId}`,
  };
}

test.describe("User Search", () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/dashboard/users");
  });

  test("should display search input", async ({ page }) => {
    await expect(page.getByTestId("user-search")).toBeVisible();
    await expect(page.getByTestId("user-search-input")).toBeVisible();
  });

  test("should show clear button when search has value", async ({ page }) => {
    const searchInput = page.getByTestId("user-search-input");

    // Clear button should not be visible initially
    await expect(page.getByTestId("user-search-clear")).not.toBeVisible();

    // Type in search
    await searchInput.fill("test");

    // Clear button should now be visible
    await expect(page.getByTestId("user-search-clear")).toBeVisible();
  });

  test("should clear search when clear button clicked", async ({ page }) => {
    const searchInput = page.getByTestId("user-search-input");

    // Type in search
    await searchInput.fill("test");
    await expect(searchInput).toHaveValue("test");

    // Click clear button
    await page.getByTestId("user-search-clear").click();

    // Input should be cleared
    await expect(searchInput).toHaveValue("");
  });

  test("should show no results message for non-matching search", async ({
    page,
  }) => {
    const searchInput = page.getByTestId("user-search-input");

    // Search for a non-existent user
    await searchInput.fill("nonexistent_user_xyz_12345_really_unique");

    // Wait for debounce and search results
    await page.waitForTimeout(500);

    // Verify empty state message
    await expect(
      page.getByText("No users found matching your search."),
    ).toBeVisible();
  });

  test("should filter users by email", async ({ page, context }) => {
    // Create a test user to search for
    const testUser = createTestUser("email");
    const newPage = await context.newPage();
    await registerUser(newPage, testUser);
    await newPage.close();

    // Refresh the users page
    await page.reload();

    const searchInput = page.getByTestId("user-search-input");

    // Search for the test user by email
    await searchInput.fill(testUser.email.split("@")[0]);

    // Wait for debounce and search results
    await page.waitForTimeout(500);

    // Should find the user (use last() to get desktop layout which is visible)
    await expect(page.getByText(testUser.email).last()).toBeVisible();
  });

  test("should filter users by display name", async ({ page, context }) => {
    // Create a test user to search for
    const testUser = createTestUser("displayname");
    const newPage = await context.newPage();
    await registerUser(newPage, testUser);
    await newPage.close();

    // Refresh the users page
    await page.reload();

    const searchInput = page.getByTestId("user-search-input");

    // Search for the test user by display name
    await searchInput.fill(testUser.displayName);

    // Wait for debounce and search results
    await page.waitForTimeout(500);

    // Should find the user (use last() to get desktop layout which is visible)
    await expect(page.getByText(testUser.email).last()).toBeVisible();
  });
});

test.describe("Toggle User Verification", () => {
  let testUser: { email: string; password: string; displayName: string };

  test.beforeAll(async ({ browser }) => {
    // Create a test user for verification toggle tests
    testUser = createTestUser("verify");
    const page = await browser.newPage();
    await registerUser(page, testUser);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/dashboard/users");

    // Search for our test user to find them easily
    const searchInput = page.getByTestId("user-search-input");
    await searchInput.fill(testUser.email);
    await page.waitForTimeout(500);
  });

  test("should show toggle verified option in actions menu", async ({
    page,
  }) => {
    // Find the test user's row (use last() to get desktop layout which is visible)
    const userRow = page.locator(`[data-testid^="user-row-"]`).last();
    const userId = (await userRow.getAttribute("data-testid"))?.replace(
      "user-row-",
      "",
    );

    // Open actions menu (use last() to get desktop layout which is visible)
    await page.getByTestId(`user-actions-${userId}`).last().click();

    await page.waitForTimeout(2000);

    // Should show either "Mark Verified" or "Unmark Verified" based on current state
    const markVerified = page.getByTestId(`mark-verified-${userId}`);
    const unmarkVerified = page.getByTestId(`unmark-verified-${userId}`);

    const hasMarkVerified = await markVerified.isVisible().catch(() => false);
    const hasUnmarkVerified = await unmarkVerified
      .isVisible()
      .catch(() => false);

    // One of them should be visible
    expect(hasMarkVerified || hasUnmarkVerified).toBe(true);
  });

  test("should toggle verification status", async ({ page }) => {
    // Find the test user's row (use last() to get desktop layout which is visible)
    const userRow = page.locator(`[data-testid^="user-row-"]`).last();
    const userId = (await userRow.getAttribute("data-testid"))?.replace(
      "user-row-",
      "",
    );

    // Accept the confirmation dialog before clicking
    page.on("dialog", (dialog) => dialog.accept());

    // Open actions menu (use last() to get desktop layout which is visible)
    await page.getByTestId(`user-actions-${userId}`).last().click();

    // Click the toggle action

    await page.getByTestId(`unmark-verified-${userId}`).click();

    // Wait for the action to complete
    await page.waitForTimeout(2000);

    // Should now show Unverified badge
    await expect(page.getByText("Unverified").nth(1)).toBeVisible();
  });

  test("should update actions menu after toggle", async ({ page }) => {
    // Find the test user's row (use last() to get desktop layout which is visible)
    const userRow = page.locator(`[data-testid^="user-row-"]`).last();
    const userId = (await userRow.getAttribute("data-testid"))?.replace(
      "user-row-",
      "",
    );

    const unmarkVerified = page.getByTestId(`unmark-verified-${userId}`);
    const isCurrentlyVerified = await unmarkVerified
      .isVisible()
      .catch(() => false);

    // Accept the confirmation dialog before clicking
    page.on("dialog", (dialog) => dialog.accept());

    // Open actions menu (use last() to get desktop layout which is visible)
    await page.getByTestId(`user-actions-${userId}`).last().click();

    if (!isCurrentlyVerified) {
      // If currently unverified, click "Mark Verified"
      await page.getByTestId(`mark-verified-${userId}`).click();
    } else {
      // Click the toggle action
      await page.getByTestId(`unmark-verified-${userId}`).click();
    }
    // Wait for the action to complete
    await page.waitForTimeout(2000);

    // Open actions menu again (use last() to get desktop layout which is visible)
    await page.getByTestId(`user-actions-${userId}`).last().click();

    if (isCurrentlyVerified) {
      // The toggle action should now show "Mark Verified"
      await expect(page.getByTestId(`mark-verified-${userId}`)).toBeVisible();
    } else {
      // The toggle action should now show "Unmark Verified"
      await expect(page.getByTestId(`unmark-verified-${userId}`)).toBeVisible();
    }
  });
});
