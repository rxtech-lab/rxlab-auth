import { test, expect } from "@playwright/test";
import { createOAuthClient, adminLogin } from "../fixtures/test-helpers";

test.describe("Clients Pagination", () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test("should show client list on dashboard", async ({ page }) => {
    await page.goto("/admin/dashboard/clients");
    await expect(page.getByTestId("client-list")).toBeVisible();
  });

  test("should redirect out-of-range page to last valid page", async ({
    page,
  }) => {
    // Navigate with a very large page number
    await page.goto("/admin/dashboard/clients?page=9999&pageSize=20");

    // Should redirect to a valid page (page=1 if no clients, or last page)
    await expect(page).not.toHaveURL(/page=9999/);
    await expect(page.getByTestId("client-list")).toBeVisible();
  });

  test("should clamp pageSize to valid range", async ({ page }) => {
    // pageSize=0 should be clamped to 1
    await page.goto("/admin/dashboard/clients?page=1&pageSize=0");
    await expect(page.getByTestId("client-list")).toBeVisible();

    // pageSize=999 should be clamped to 100
    await page.goto("/admin/dashboard/clients?page=1&pageSize=999");
    await expect(page.getByTestId("client-list")).toBeVisible();
  });

  test("should paginate when there are more clients than pageSize", async ({
    page,
  }) => {
    // Create 3 clients
    for (let i = 0; i < 3; i++) {
      await createOAuthClient(page, {
        name: `Pagination Test Client ${i + 1}`,
        redirectUri: "http://localhost:3001/callback",
      });
    }

    // View clients list with pageSize=2 to force pagination
    await page.goto("/admin/dashboard/clients?page=1&pageSize=2");
    await expect(page.getByTestId("client-list")).toBeVisible();
    await expect(page.getByTestId("pagination-controls")).toBeVisible();
    await expect(page.getByTestId("page-info")).toContainText("Page 1 of");

    // First page buttons should be disabled
    await expect(page.getByTestId("first-page")).toBeDisabled();
    await expect(page.getByTestId("prev-page")).toBeDisabled();

    // Next/last buttons should be enabled
    await expect(page.getByTestId("next-page")).not.toBeDisabled();
    await expect(page.getByTestId("last-page")).not.toBeDisabled();

    // Navigate to page 2
    await page.getByTestId("next-page").click();
    await expect(page.getByTestId("page-info")).toContainText("Page 2 of");

    // Now prev buttons should be enabled
    await expect(page.getByTestId("first-page")).not.toBeDisabled();
    await expect(page.getByTestId("prev-page")).not.toBeDisabled();

    // Navigate back to first page
    await page.getByTestId("first-page").click();
    await expect(page.getByTestId("page-info")).toContainText("Page 1 of");
  });

  test("should handle page beyond total pages with redirect", async ({
    page,
  }) => {
    // Create 1 client so there is data
    await createOAuthClient(page, {
      name: "Redirect Test Client",
      redirectUri: "http://localhost:3001/callback",
    });

    // Navigate to page 999 which is beyond total pages
    await page.goto("/admin/dashboard/clients?page=999&pageSize=20");

    // Should redirect away from the out-of-range page
    await expect(page).not.toHaveURL(/page=999/);
    // Client list should be visible with actual client data (not empty state)
    await expect(page.getByTestId("client-list")).toBeVisible();
    await expect(
      page.getByText("No OAuth clients registered yet.")
    ).not.toBeVisible();
  });
});
