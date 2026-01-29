import { test, expect } from "@playwright/test";

test.describe("OAuth Error Page", () => {
  test.describe("Browser requests (Accept: text/html)", () => {
    test("should show HTML error page for invalid client_id", async ({ page }) => {
      await page.goto(
        `/api/oauth/authorize?` +
          `client_id=invalid-client-id&` +
          `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
          `response_type=code&` +
          `scope=openid&` +
          `code_challenge=test&` +
          `code_challenge_method=S256`
      );

      // Should be redirected to error page
      await expect(page).toHaveURL(/\/oauth\/error/);
      expect(page.url()).toContain("error=invalid_client");

      // Should display error message
      await expect(page.getByText("Authorization Error")).toBeVisible();
      await expect(page.getByText("Client not found")).toBeVisible();
      await expect(page.getByText("invalid_client")).toBeVisible();

      // Should have go back button
      await expect(page.getByRole("button", { name: /go back/i })).toBeVisible();
    });

    test("should show HTML error page for invalid redirect_uri", async ({
      page,
      browser,
    }) => {
      // First create a valid client to test with
      const context = await browser.newContext();
      const adminPage = await context.newPage();

      // Login as admin
      await adminPage.goto("/admin");
      await adminPage.getByLabel("Admin Password").fill("e2e-test-admin-password");
      await adminPage.getByRole("button", { name: "Sign in with Password", exact: true }).click();
      await expect(adminPage).toHaveURL("/admin/dashboard");

      // Create OAuth client
      await adminPage.goto("/admin/dashboard/clients/new");
      await adminPage.getByTestId("client-name").fill("Error Page Test Client");
      await adminPage.getByTestId("redirect-uri-0").fill("http://localhost:3001/callback");
      // openid is already selected by default
      await adminPage.getByTestId("submit-button").click();
      await expect(adminPage.getByText("Client Created")).toBeVisible();

      const clientId = await adminPage.getByTestId("client-id-display").inputValue();
      await adminPage.close();
      await context.close();

      // Now test with valid client but invalid redirect URI
      await page.goto(
        `/api/oauth/authorize?` +
          `client_id=${clientId}&` +
          `redirect_uri=${encodeURIComponent("http://evil.com/callback")}&` +
          `response_type=code&` +
          `scope=openid&` +
          `code_challenge=test&` +
          `code_challenge_method=S256`
      );

      // Should be redirected to error page
      await expect(page).toHaveURL(/\/oauth\/error/);
      expect(page.url()).toContain("error=invalid_redirect_uri");

      // Should display error message
      await expect(page.getByText("Authorization Error")).toBeVisible();
      await expect(
        page.getByText("redirect URI does not match", { exact: false })
      ).toBeVisible();
    });

    test("should show HTML error page for missing required params", async ({ page }) => {
      // Missing code_challenge
      await page.goto(
        `/api/oauth/authorize?` +
          `client_id=some-client&` +
          `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
          `response_type=code&` +
          `scope=openid`
      );

      // Should be redirected to error page
      await expect(page).toHaveURL(/\/oauth\/error/);
      expect(page.url()).toContain("error=invalid_request");

      // Should display error message
      await expect(page.getByText("Authorization Error")).toBeVisible();
    });

    test("go back button should navigate away from error page", async ({ page }) => {
      // First navigate to a page so we have history
      await page.goto("/login");

      // Then navigate to the error page
      await page.goto(
        `/api/oauth/authorize?` +
          `client_id=invalid&` +
          `redirect_uri=http://test.com&` +
          `response_type=code&` +
          `scope=openid&` +
          `code_challenge=test&` +
          `code_challenge_method=S256`
      );

      await expect(page).toHaveURL(/\/oauth\/error/);

      // Click go back button - should go to previous page in history
      await page.getByRole("button", { name: /go back/i }).click();
      // Should navigate away from error page
      await expect(page).not.toHaveURL(/\/oauth\/error/);
    });
  });

  test.describe("API requests (no Accept: text/html)", () => {
    test("should return JSON for invalid client_id", async ({ request }) => {
      const response = await request.get("/api/oauth/authorize", {
        params: {
          client_id: "invalid-client-id",
          redirect_uri: "http://localhost:3001/callback",
          response_type: "code",
          scope: "openid",
          code_challenge: "test",
          code_challenge_method: "S256",
        },
      });

      expect(response.status()).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("invalid_client");
      expect(json.error_description).toBe("Client not found");
    });

    test("should return JSON for missing required params", async ({ request }) => {
      const response = await request.get("/api/oauth/authorize", {
        params: {
          client_id: "some-client",
          redirect_uri: "http://localhost:3001/callback",
          response_type: "code",
          scope: "openid",
          // Missing code_challenge
        },
      });

      expect(response.status()).toBe(400);
      const json = await response.json();
      expect(json.error).toBe("invalid_request");
      expect(json.error_description).toContain("code_challenge");
    });
  });

  test.describe("Error page direct access", () => {
    test("should display error from query params", async ({ page }) => {
      await page.goto("/oauth/error?error=access_denied&error_description=User%20denied%20access");

      await expect(page.getByText("Authorization Error")).toBeVisible();
      await expect(page.getByText("User denied access")).toBeVisible();
      await expect(page.getByText("access_denied")).toBeVisible();
    });

    test("should display default message for unknown error", async ({ page }) => {
      await page.goto("/oauth/error?error=some_custom_error");

      await expect(page.getByText("Authorization Error")).toBeVisible();
      await expect(page.getByText("An unexpected error occurred")).toBeVisible();
      await expect(page.getByText("some_custom_error")).toBeVisible();
    });
  });
});
