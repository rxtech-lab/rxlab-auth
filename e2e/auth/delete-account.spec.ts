import { test, expect, type Page } from "@playwright/test";

// Deletion is scheduled, not immediate: ACCOUNT_DELETION_DELAY_SECONDS is set to
// a few seconds in playwright.config.ts so these specs can watch the grace
// period elapse. In production the same code path waits 7 days.

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

async function registerUser(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Display Name").fill("Delete Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("TestPassword123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/account?setup=passkey");
}

function uniqueEmail(prefix: string, parallelIndex: number) {
  return `${prefix}-${Date.now()}-${parallelIndex}@example.com`;
}

test.describe("Delayed account deletion", () => {
  test("schedules deletion instead of deleting immediately", async ({ page }, testInfo) => {
    const email = uniqueEmail("delete-schedule", testInfo.parallelIndex);
    await registerUser(page, email);

    const response = await page.request.delete("/api/auth/delete-account");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.pendingDeletion).toBe(true);
    expect(body.deletionScheduledAt).toMatch(ISO_UTC);
    expect(new Date(body.deletionScheduledAt).getTime()).toBeGreaterThan(Date.now());

    // The account still exists and the session survives — the whole point of a
    // grace period is that the user can still get back in and change their mind.
    const session = await (await page.request.get("/api/auth/session")).json();
    expect(session.user).not.toBeNull();
    expect(session.user.email).toBe(email);
    expect(session.user.pendingDeletion).toBe(true);
    expect(session.user.deletionScheduledAt).toBe(body.deletionScheduledAt);
  });

  test("lets the user sign in during the grace period", async ({ page }, testInfo) => {
    const email = uniqueEmail("delete-signin", testInfo.parallelIndex);
    await registerUser(page, email);

    await page.request.post("/api/auth/account-deletion");

    // Drop the session cookie rather than driving the header dropdown — this
    // spec is about whether a pending-deletion account can authenticate again,
    // not about the sign-out affordance.
    await page.context().clearCookies();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/account/);

    const session = await (await page.request.get("/api/auth/session")).json();
    expect(session.user.pendingDeletion).toBe(true);
  });

  test("reverts a pending deletion", async ({ page }, testInfo) => {
    const email = uniqueEmail("delete-cancel", testInfo.parallelIndex);
    await registerUser(page, email);

    await page.request.post("/api/auth/account-deletion");

    const cancel = await page.request.delete("/api/auth/account-deletion");
    expect(cancel.status()).toBe(200);
    const cancelBody = await cancel.json();
    expect(cancelBody.cancelled).toBe(true);
    expect(cancelBody.pendingDeletion).toBe(false);
    expect(cancelBody.deletionScheduledAt).toBeNull();

    const session = await (await page.request.get("/api/auth/session")).json();
    expect(session.user.pendingDeletion).toBe(false);
    expect(session.user.deletionScheduledAt).toBeNull();

    // And the reverted account must survive past the original deadline.
    await page.waitForTimeout(6000);
    const after = await (await page.request.get("/api/auth/session")).json();
    expect(after.user).not.toBeNull();
    expect(after.user.email).toBe(email);
  });

  test("re-posting keeps the original deadline", async ({ page }, testInfo) => {
    const email = uniqueEmail("delete-idempotent", testInfo.parallelIndex);
    await registerUser(page, email);

    const first = await (await page.request.post("/api/auth/account-deletion")).json();
    const second = await (await page.request.post("/api/auth/account-deletion")).json();

    expect(second.alreadyScheduled).toBe(true);
    expect(second.deletionScheduledAt).toBe(first.deletionScheduledAt);
  });

  test("actually deletes the account once the grace period elapses", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail("delete-fires", testInfo.parallelIndex);
    await registerUser(page, email);

    await page.request.post("/api/auth/account-deletion");

    await expect
      .poll(
        async () => {
          const body = await (await page.request.get("/api/auth/session")).json();
          return body.user;
        },
        { timeout: 30_000, intervals: [500] },
      )
      .toBeNull();

    // And the credentials are gone for good.
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("TestPassword123!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("returns 401 when not authenticated", async ({ page }) => {
    for (const request of [
      page.request.delete("/api/auth/delete-account"),
      page.request.get("/api/auth/account-deletion"),
      page.request.post("/api/auth/account-deletion"),
      page.request.delete("/api/auth/account-deletion"),
    ]) {
      const response = await request;
      expect(response.status()).toBe(401);
      expect((await response.json()).error).toBe("Unauthorized");
    }
  });
});
