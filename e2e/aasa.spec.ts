import { test, expect } from "@playwright/test";
import { createOAuthClient, adminLogin } from "./fixtures/test-helpers";

const AASA_PATH = "/.well-known/apple-app-site-association";

async function clearAppIds(request: import("@playwright/test").APIRequestContext) {
  const res = await request.delete("/api/e2e/oauth-client-app-ids");
  expect(res.ok()).toBeTruthy();
}

async function seedAppIds(
  request: import("@playwright/test").APIRequestContext,
  clientId: string,
  appIds: string[]
) {
  const res = await request.post("/api/e2e/oauth-client-app-ids", {
    data: { clientId, appIds },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe("apple-app-site-association", () => {
  test("returns empty webcredentials.apps when no app IDs registered", async ({
    request,
  }) => {
    await clearAppIds(request);

    const res = await request.get(AASA_PATH);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/json");

    const body = await res.json();
    expect(body).toEqual({ webcredentials: { apps: [] } });
  });

  test("returns deduplicated, sorted app IDs across multiple clients", async ({
    page,
    request,
  }) => {
    await clearAppIds(request);

    await adminLogin(page);

    const { clientId: clientA } = await createOAuthClient(page, {
      name: `AASA Client A ${Date.now()}`,
      redirectUri: "http://localhost:3001/callback",
    });
    const { clientId: clientB } = await createOAuthClient(page, {
      name: `AASA Client B ${Date.now()}`,
      redirectUri: "http://localhost:3001/callback",
    });

    // Client A has two app IDs; Client B has one that overlaps with A
    // and one unique. Final union must be deduped and sorted.
    await seedAppIds(request, clientA, [
      "ABCDE12345.app.rxlab.macos",
      "ABCDE12345.app.rxlab.ios",
    ]);
    await seedAppIds(request, clientB, [
      "ABCDE12345.app.rxlab.ios", // duplicate of A
      "FGHIJ67890.app.rxlab.watch",
    ]);

    const res = await request.get(AASA_PATH);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/json");

    const body = await res.json();
    expect(body.webcredentials).toBeDefined();
    const apps = body.webcredentials.apps as string[];

    expect(apps).toEqual([
      "ABCDE12345.app.rxlab.ios",
      "ABCDE12345.app.rxlab.macos",
      "FGHIJ67890.app.rxlab.watch",
    ]);

    // no duplicates
    expect(new Set(apps).size).toBe(apps.length);

    // sorted ascending
    expect([...apps].sort()).toEqual(apps);
  });
});
