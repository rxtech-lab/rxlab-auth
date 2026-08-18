import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { adminLogin, createOAuthClient } from "../fixtures/test-helpers";

const USER_PASSWORD = "TestPassword123!";

interface TestUser {
  email: string;
  password: string;
}

interface OAuthClientListResponse {
  clients: Array<{
    id: string;
    name: string;
  }>;
  pagination: {
    totalCount: number;
  };
}

async function createAdminApiUser(
  page: Page,
  user: TestUser,
  permission:
    | { scope: "all" }
    | { scope: "selected"; clientIds: string[] }
    | { scope: "none" },
) {
  await page.goto("/admin/dashboard/users");
  await page.getByTestId("user-actions-button").click();
  await page.getByTestId("create-user-button").click();

  await expect(page.getByTestId("user-sheet")).toBeVisible();
  await page.getByTestId("user-email-input").fill(user.email);
  await page.getByTestId("user-password-input").fill(user.password);
  await page
    .getByTestId("user-displayname-input")
    .fill(`OAuth API ${permission.scope} user`);

  if (permission.scope !== "none") {
    await page.getByTestId("read-oauth-clients-toggle").click();

    if (permission.scope === "selected") {
      await page
        .getByTestId("read-oauth-clients-scope")
        .selectOption("selected");

      for (const clientId of permission.clientIds) {
        const option = page.getByTestId(
          `read-oauth-client-option-${clientId}`,
        );
        if (!(await option.isVisible())) {
          await page.getByTestId("read-oauth-clients-picker").click();
        }
        await option.click();
      }
    }
  }

  await page.getByTestId("user-submit-button").click();
  await expect(page.getByTestId("user-sheet")).not.toBeVisible();
}

async function issueAccessToken(
  request: APIRequestContext,
  clientId: string,
  user: TestUser,
): Promise<string> {
  const response = await request.post("/api/oauth/token", {
    form: {
      grant_type: "password",
      client_id: clientId,
      username: user.email,
      password: user.password,
      scope: "openid",
    },
  });

  expect(response.status()).toBe(200);
  const body: { access_token: string } = await response.json();
  expect(body.access_token).toBeTruthy();
  return body.access_token;
}

async function listOAuthClients(
  request: APIRequestContext,
  accessToken: string,
) {
  return request.get("/api/admin/oauth-clients?page=1&pageSize=100", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

test.describe("OAuth client admin API permissions", () => {
  let grantedClientIds: string[];
  let ungrantedClientId: string;
  let tokenClientId: string;
  let scopedUser: TestUser;
  let allUser: TestUser;
  let unprivilegedUser: TestUser;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(90_000);
    const suffix = `${Date.now()}`;
    scopedUser = {
      email: `oauth-api-scoped-${suffix}@example.com`,
      password: USER_PASSWORD,
    };
    allUser = {
      email: `oauth-api-all-${suffix}@example.com`,
      password: USER_PASSWORD,
    };
    unprivilegedUser = {
      email: `oauth-api-none-${suffix}@example.com`,
      password: USER_PASSWORD,
    };

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await adminLogin(page);

      const firstGrantedClient = await createOAuthClient(page, {
        name: `Granted Project One ${suffix}`,
        redirectUri: "http://localhost:3001/callback",
        clientType: "public",
      });
      const secondGrantedClient = await createOAuthClient(page, {
        name: `Granted Project Two ${suffix}`,
        redirectUri: "http://localhost:3001/callback",
        clientType: "public",
      });
      const ungrantedClient = await createOAuthClient(page, {
        name: `Ungranted Project ${suffix}`,
        redirectUri: "http://localhost:3001/callback",
        clientType: "public",
      });

      grantedClientIds = [
        firstGrantedClient.clientId,
        secondGrantedClient.clientId,
      ];
      ungrantedClientId = ungrantedClient.clientId;
      tokenClientId = ungrantedClient.clientId;

      await createAdminApiUser(page, scopedUser, {
        scope: "selected",
        clientIds: grantedClientIds,
      });
      await createAdminApiUser(page, allUser, { scope: "all" });
      await createAdminApiUser(page, unprivilegedUser, { scope: "none" });
    } finally {
      await context.close();
    }
  });

  test("read:oauth_clients:id1,id2 returns only the granted clients", async ({
    request,
  }) => {
    const accessToken = await issueAccessToken(
      request,
      tokenClientId,
      scopedUser,
    );
    const response = await listOAuthClients(request, accessToken);

    expect(response.status()).toBe(200);
    const body: OAuthClientListResponse = await response.json();
    expect(body.clients.map((client) => client.id).sort()).toEqual(
      [...grantedClientIds].sort(),
    );
    expect(body.clients.map((client) => client.id)).not.toContain(
      ungrantedClientId,
    );
    expect(body.pagination.totalCount).toBe(2);
  });

  test("read:oauth_clients:all can list every OAuth client", async ({
    request,
  }) => {
    const accessToken = await issueAccessToken(
      request,
      tokenClientId,
      allUser,
    );
    const response = await listOAuthClients(request, accessToken);

    expect(response.status()).toBe(200);
    const body: OAuthClientListResponse = await response.json();
    const returnedClientIds = body.clients.map((client) => client.id);
    expect(returnedClientIds).toEqual(
      expect.arrayContaining([...grantedClientIds, ungrantedClientId]),
    );
    expect(body.pagination.totalCount).toBeGreaterThanOrEqual(3);
  });

  test("a user without OAuth client permissions gets a JSON error", async ({
    request,
  }) => {
    const accessToken = await issueAccessToken(
      request,
      tokenClientId,
      unprivilegedUser,
    );
    const response = await listOAuthClients(request, accessToken);

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({
      error: "insufficient_permission",
      error_description:
        "Requires read:oauth_clients:all or selected OAuth client IDs",
      required_permission: "read:oauth_clients",
    });
  });
});
