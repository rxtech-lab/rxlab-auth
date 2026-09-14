import { test, expect } from "@playwright/test";
import { adminLogin, createOAuthClient } from "../fixtures/test-helpers";

// Per-client sign-in methods. Everything is enabled by default; switching a
// method off must both stop advertising it (ui-schema, which native clients
// render from) and reject it server-side.

test.describe("Per-client sign-in methods", () => {
  test("defaults to every method enabled", async ({ page }) => {
    await adminLogin(page);
    const { clientId } = await createOAuthClient(page, {
      name: `Methods Default ${Date.now()}`,
      redirectUri: "http://localhost:3001/callback",
    });

    const schema = await (
      await page.request.get(`/api/auth/ui-schema/signin?client_id=${clientId}`)
    ).json();

    expect(schema.supportedMethods.map((m: { id: string }) => m.id)).toEqual([
      "password",
      "passkey",
    ]);
  });

  test("disabling password removes it from the schema and rejects the grant", async ({
    page,
  }) => {
    await adminLogin(page);
    const { clientId, clientSecret } = await createOAuthClient(page, {
      name: `Methods Password ${Date.now()}`,
      redirectUri: "http://localhost:3001/callback",
    });

    await page.goto(`/admin/dashboard/clients/${clientId}?tab=permissions`);
    await page.getByTestId("sign-in-method-password").click();
    await page.getByTestId("save-sign-in-methods").click();
    await expect(page.getByText("Sign-in methods saved successfully")).toBeVisible();

    // Advertised: password is gone, passkey is promoted to primary.
    const schema = await (
      await page.request.get(`/api/auth/ui-schema/signin?client_id=${clientId}`)
    ).json();
    expect(schema.supportedMethods).toEqual([
      { id: "passkey", label: "Sign in with passkey", primary: true },
    ]);

    // Enforced: the password grant is refused for this client.
    const token = await page.request.post("/api/oauth/token", {
      form: {
        grant_type: "password",
        username: "someone@example.com",
        password: "TestPassword123!",
        client_id: clientId,
        client_secret: clientSecret ?? "",
      },
    });
    expect(token.status()).toBe(400);
    expect((await token.json()).error).toBe("unauthorized_client");
  });

  test("disabling passkey removes it from the schema", async ({ page }) => {
    await adminLogin(page);
    const { clientId } = await createOAuthClient(page, {
      name: `Methods Passkey ${Date.now()}`,
      redirectUri: "http://localhost:3001/callback",
    });

    await page.goto(`/admin/dashboard/clients/${clientId}?tab=permissions`);
    await page.getByTestId("sign-in-method-passkey").click();
    await page.getByTestId("save-sign-in-methods").click();
    await expect(page.getByText("Sign-in methods saved successfully")).toBeVisible();

    const schema = await (
      await page.request.get(`/api/auth/ui-schema/signin?client_id=${clientId}`)
    ).json();
    expect(schema.supportedMethods.map((m: { id: string }) => m.id)).toEqual([
      "password",
    ]);
  });

  test("warns when every method is switched off", async ({ page }) => {
    await adminLogin(page);
    const { clientId } = await createOAuthClient(page, {
      name: `Methods Empty ${Date.now()}`,
      redirectUri: "http://localhost:3001/callback",
    });

    await page.goto(`/admin/dashboard/clients/${clientId}?tab=permissions`);
    await page.getByTestId("sign-in-method-password").click();
    await page.getByTestId("sign-in-method-passkey").click();

    // Any social provider with credentials on this server is still a usable way
    // in, so the warning must not fire until those are off too. Which providers
    // are configured depends on the environment (.env leaks into the E2E
    // server), so switch off whichever ones are actually enabled rather than
    // hard-coding a list.
    const socialSwitches = page.locator(
      '[data-testid^="sign-in-method-social-"]:not([data-disabled])',
    );
    for (let i = 0; i < (await socialSwitches.count()); i++) {
      const toggle = socialSwitches.nth(i);
      if ((await toggle.getAttribute("data-checked")) !== null) {
        await toggle.click();
      }
    }

    await expect(
      page.getByTestId("sign-in-methods-empty-warning"),
    ).toBeVisible();
  });

  test("the setting survives a reload", async ({ page }) => {
    await adminLogin(page);
    const { clientId } = await createOAuthClient(page, {
      name: `Methods Persist ${Date.now()}`,
      redirectUri: "http://localhost:3001/callback",
    });

    await page.goto(`/admin/dashboard/clients/${clientId}?tab=permissions`);
    await page.getByTestId("sign-in-method-password").click();
    await page.getByTestId("save-sign-in-methods").click();
    await expect(page.getByText("Sign-in methods saved successfully")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("sign-in-method-password")).toHaveAttribute(
      "data-unchecked",
      "",
    );
    await expect(page.getByTestId("sign-in-method-passkey")).toHaveAttribute(
      "data-checked",
      "",
    );
  });
});
