import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { adminLogin, createOAuthClient } from "../fixtures/test-helpers";

function accessTokenRoles(accessToken: string): string[] {
  const payload = accessToken.split(".")[1];
  if (!payload) throw new Error("Access token is not a JWT");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).roles;
}

async function addRole(page: Page, name: string, key: string) {
  await page.getByTestId("new-client-role-name").fill(name);
  await page.getByTestId("new-client-role-key").fill(key);
  await page.getByTestId("add-client-role").click();
  await expect(page.getByTestId(`client-role-${key}`)).toBeVisible();
}

async function signUp(
  request: APIRequestContext,
  clientId: string,
  email: string,
) {
  const response = await request.post("/api/oauth/signup", {
    data: {
      client_id: clientId,
      username: email,
      password: "TestPassword123!",
      name: "Default Role User",
      scope: "openid",
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

async function passwordGrant(
  request: APIRequestContext,
  clientId: string,
  email: string,
) {
  const response = await request.post("/api/oauth/token", {
    form: {
      grant_type: "password",
      client_id: clientId,
      username: email,
      password: "TestPassword123!",
      scope: "openid",
    },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

test.describe("OAuth client default role", () => {
  test("uses only the explicit nullable default instead of the first role", async ({
    page,
    request,
  }, testInfo) => {
    await adminLogin(page);
    const { clientId } = await createOAuthClient(page, {
      name: `Default Role App ${Date.now()}`,
      redirectUri: "http://localhost:3001/callback",
      clientType: "public",
    });

    await page.goto(`/admin/dashboard/clients/${clientId}`);
    await page.getByTestId("tab-permissions").click();

    // Admin is deliberately created first. It must not become the default.
    await addRole(page, "Admin", "admin");
    await addRole(page, "Member", "member");

    const unsetUser = await signUp(
      request,
      clientId,
      `default-unset-${Date.now()}-${testInfo.parallelIndex}@example.com`,
    );
    expect(accessTokenRoles(unsetUser.access_token)).toEqual([]);

    await page.getByTestId("set-default-client-role-member").click();
    await expect(page.getByTestId("set-default-client-role-member")).toHaveText(
      /Default/,
    );

    await page.reload();
    await page.getByTestId("tab-permissions").click();
    await expect(page.getByTestId("set-default-client-role-member")).toHaveText(
      /Default/,
    );

    const defaultedUser = await signUp(
      request,
      clientId,
      `default-member-${Date.now()}-${testInfo.parallelIndex}@example.com`,
    );
    expect(accessTokenRoles(defaultedUser.access_token)).toEqual(["member"]);

    const browserUserEmail =
      `default-browser-${Date.now()}-${testInfo.parallelIndex}@example.com`;
    const authorizeRedirect =
      `/api/oauth/authorize?client_id=${clientId}` +
      "&redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fcallback" +
      "&response_type=code&scope=openid&state=default-role" +
      "&code_challenge=test-challenge&code_challenge_method=S256";
    await page.goto(`/register?redirect=${encodeURIComponent(authorizeRedirect)}`);
    await page.getByLabel("Display Name").fill("Browser Default Role User");
    await page.getByLabel("Email").fill(browserUserEmail);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).not.toHaveURL(/\/register/);

    const browserUserToken = await passwordGrant(
      request,
      clientId,
      browserUserEmail,
    );
    expect(accessTokenRoles(browserUserToken.access_token)).toEqual(["member"]);

    await page.goto(`/admin/dashboard/clients/${clientId}`);
    await page.getByTestId("tab-permissions").click();
    await page.getByTestId("clear-default-client-role").click();
    await expect(page.getByTestId("clear-default-client-role")).not.toBeVisible();

    const clearedUser = await signUp(
      request,
      clientId,
      `default-cleared-${Date.now()}-${testInfo.parallelIndex}@example.com`,
    );
    expect(accessTokenRoles(clearedUser.access_token)).toEqual([]);
  });
});
