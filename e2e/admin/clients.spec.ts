import { test, expect } from "@playwright/test";

const ADMIN_PASSWORD = "e2e-test-admin-password";

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/admin");
  await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in with Password" }).click();
  await expect(page).toHaveURL("/admin/dashboard");
}

test.describe("Client Form Scope Selection", () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });


  test("should create client with all scopes selected", async ({ page }) => {
    await page.goto("/admin/dashboard/clients/new");

    // Fill basic info
    await page.getByTestId("client-name").fill("All Scopes Test App");
    await page.getByTestId("redirect-uri-0").fill("http://localhost:3001/callback");

    // Verify openid is already selected (required)
    const openidButton = page.getByTestId("openid");
    await expect(openidButton).toHaveAttribute("class", /border-primary/);

    // Select all resource scopes by clicking resource toggles
    await page.getByTestId("profile").click();
    await page.getByTestId("email").click();

    // Verify all individual scopes are selected (checking for the selected state class)
    const readProfileButton = page.getByTestId("read:profile");
    const writeProfileButton = page.getByTestId("write:profile");
    const readEmailButton = page.getByTestId("read:email");

    await expect(readProfileButton).toHaveAttribute("class", /bg-primary\/5/);
    await expect(writeProfileButton).toHaveAttribute("class", /bg-primary\/5/);
    await expect(readEmailButton).toHaveAttribute("class", /bg-primary\/5/);

    // Submit the form
    await page.getByTestId("submit-button").click();

    // Wait for credentials display
    await expect(page.getByText("Client Created Successfully")).toBeVisible();

    // Get the client ID for later verification
    const clientId = await page.getByTestId("client-id-display").inputValue();
    expect(clientId).toBeTruthy();
    expect(clientId).toMatch(/^client_/);

    // Navigate directly to the edit page using the client ID to verify DB storage
    await page.goto(`/admin/dashboard/clients/${clientId}`);

    // Verify all scopes are still selected (DB verification via UI)
    await expect(page.getByTestId("openid")).toHaveAttribute("class", /border-primary/);
    await expect(page.getByTestId("read:profile")).toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("write:profile")).toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("read:email")).toHaveAttribute("class", /bg-primary\/5/);
  });

  test("should create client with partial scopes (profile read only)", async ({ page }) => {
    await page.goto("/admin/dashboard/clients/new");

    // Fill basic info
    await page.getByTestId("client-name").fill("Partial Scopes Test App");
    await page.getByTestId("redirect-uri-0").fill("http://localhost:3001/callback");

    // Select only read:profile (not write:profile)
    await page.getByTestId("read:profile").click();

    // Verify read:profile is selected but write:profile is not
    await expect(page.getByTestId("read:profile")).toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("write:profile")).not.toHaveAttribute("class", /bg-primary\/5/);

    // Submit the form
    await page.getByTestId("submit-button").click();

    // Wait for credentials display
    await expect(page.getByText("Client Created Successfully")).toBeVisible();

    const clientId = await page.getByTestId("client-id-display").inputValue();

    // Navigate directly to the edit page using the client ID to verify DB storage
    await page.goto(`/admin/dashboard/clients/${clientId}`);

    // Verify only read:profile is selected (DB verification via UI)
    await expect(page.getByTestId("openid")).toHaveAttribute("class", /border-primary/);
    await expect(page.getByTestId("read:profile")).toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("write:profile")).not.toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("read:email")).not.toHaveAttribute("class", /bg-primary\/5/);
  });

  test("should toggle resource to select/deselect all operations", async ({ page }) => {
    await page.goto("/admin/dashboard/clients/new");

    // Initially, profile scopes should not be selected
    await expect(page.getByTestId("read:profile")).not.toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("write:profile")).not.toHaveAttribute("class", /bg-primary\/5/);

    // Click profile resource toggle - should select all profile scopes
    await page.getByTestId("profile").click();

    // Verify both read and write profile scopes are now selected
    await expect(page.getByTestId("read:profile")).toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("write:profile")).toHaveAttribute("class", /bg-primary\/5/);

    // Click profile resource toggle again - should deselect all profile scopes
    await page.getByTestId("profile").click();

    // Verify both read and write profile scopes are now deselected
    await expect(page.getByTestId("read:profile")).not.toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("write:profile")).not.toHaveAttribute("class", /bg-primary\/5/);
  });

  test("should not allow deselecting openid scope (required)", async ({ page }) => {
    await page.goto("/admin/dashboard/clients/new");

    // Verify openid is selected and has the required indicator
    const openidButton = page.getByTestId("openid");
    await expect(openidButton).toHaveAttribute("class", /border-primary/);
    await expect(openidButton).toBeDisabled();

    // Try clicking openid - it should remain selected
    await openidButton.click({ force: true });

    // Verify openid is still selected
    await expect(openidButton).toHaveAttribute("class", /border-primary/);
  });

  test("should create client with email scope only", async ({ page }) => {
    await page.goto("/admin/dashboard/clients/new");

    // Fill basic info
    await page.getByTestId("client-name").fill("Email Only Test App");
    await page.getByTestId("redirect-uri-0").fill("http://localhost:3001/callback");

    // Select only email resource
    await page.getByTestId("email").click();

    // Verify email is selected but profile is not
    await expect(page.getByTestId("read:email")).toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("read:profile")).not.toHaveAttribute("class", /bg-primary\/5/);

    // Submit the form
    await page.getByTestId("submit-button").click();

    // Wait for credentials display
    await expect(page.getByText("Client Created Successfully")).toBeVisible();

    const clientId = await page.getByTestId("client-id-display").inputValue();

    // Navigate directly to the edit page using the client ID to verify DB storage
    await page.goto(`/admin/dashboard/clients/${clientId}`);

    // Verify only email scope is selected (DB verification via UI)
    await expect(page.getByTestId("openid")).toHaveAttribute("class", /border-primary/);
    await expect(page.getByTestId("read:email")).toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("read:profile")).not.toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("write:profile")).not.toHaveAttribute("class", /bg-primary\/5/);
  });

  test("should show partial selection indicator when some operations selected", async ({ page }) => {
    await page.goto("/admin/dashboard/clients/new");

    // Select only read:profile (partial selection for profile resource)
    await page.getByTestId("read:profile").click();

    // The profile resource header should show partial selection
    // (bg-primary/50 for partial vs bg-primary for full)
    const profileHeader = page.getByTestId("profile");

    // Verify partial selection state - the checkbox should have partial styling
    await expect(profileHeader).toHaveAttribute("class", /bg-primary\/5/);

    // Now select write:profile to make it fully selected
    await page.getByTestId("write:profile").click();

    // Both should now be selected
    await expect(page.getByTestId("read:profile")).toHaveAttribute("class", /bg-primary\/5/);
    await expect(page.getByTestId("write:profile")).toHaveAttribute("class", /bg-primary\/5/);
  });
});
