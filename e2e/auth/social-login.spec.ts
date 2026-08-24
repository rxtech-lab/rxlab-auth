import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";
import { registerUser } from "../fixtures/test-helpers";

async function setMockSocialProfile(
  page: Page,
  profile: { accountId: string; email: string; name: string },
) {
  await page.context().addCookies([
    {
      name: "rxlab-e2e-social-profile",
      value: Buffer.from(JSON.stringify(profile)).toString("base64url"),
      domain: "localhost",
      path: "/",
    },
  ]);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Avatar" }).click();
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL("/login");
}

test.describe("Social login", () => {
  test("renders configured GitHub and Google sign-in methods", async ({
    page,
  }) => {
    await page.goto("/login");

    const githubButton = page.getByTestId("social-signin-github");
    await expect(githubButton).toHaveAttribute(
      "href",
      "/api/auth/social/github?redirect=%2Faccount",
    );
    await expect(
      githubButton.locator(
        'img[src="/brand/github-invertocat-black.svg"]',
      ),
    ).toBeAttached();
    await expect(
      githubButton.locator(
        'img[src="/brand/github-invertocat-white.svg"]',
      ),
    ).toBeAttached();

    const googleButton = page.getByTestId("social-signin-google");
    await expect(googleButton).toHaveAttribute(
      "href",
      "/api/auth/social/google?redirect=%2Faccount",
    );
    await expect(
      googleButton.locator('img[src="/brand/google-g.svg"]'),
    ).toBeAttached();
  });

  test("asks before connecting a social identity to an existing account", async ({
    page,
  }, testInfo) => {
    const stamp = `${Date.now()}${testInfo.retry}`;
    const user = {
      email: `social-existing-${stamp}@example.com`,
      password: "TestPassword123!",
      displayName: "Existing Social User",
    };
    const profile = {
      accountId: stamp,
      email: user.email,
      name: user.displayName,
    };

    await registerUser(page, user);
    await signOut(page);
    await setMockSocialProfile(page, profile);

    await page.goto("/api/auth/social/github?redirect=%2Faccount");
    await expect(page).toHaveURL("/social/confirm");
    await expect(
      page.getByRole("heading", { name: "Connect your accounts?" }),
    ).toBeVisible();
    await expect(
      page.getByText(`An RxLab Auth account already uses ${user.email}.`),
    ).toBeVisible();

    await page.getByTestId("confirm-social-signin").click();
    await expect(page).toHaveURL("/account");
    await expect(page.getByTestId("connected-social-github")).toContainText(
      user.email,
    );

    await signOut(page);
    await setMockSocialProfile(page, profile);
    await page.goto("/api/auth/social/github?redirect=%2Faccount");
    await expect(page).toHaveURL("/account");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId("disconnect-social-github").click();
    await expect(page.getByTestId("connected-social-github")).toHaveCount(0);
  });

  test("explains account creation before creating a social-only account", async ({
    page,
  }, testInfo) => {
    const stamp = `${Date.now()}${testInfo.retry}`;
    const profile = {
      accountId: `google-${stamp}`,
      email: `social-new-${stamp}@example.com`,
      name: "New Social User",
    };
    await setMockSocialProfile(page, profile);

    await page.goto("/api/auth/social/google?redirect=%2Faccount");
    await expect(page).toHaveURL("/social/confirm");
    await expect(
      page.getByRole("heading", { name: "Create your account?" }),
    ).toBeVisible();
    await expect(
      page.getByText(`No RxLab Auth account exists for ${profile.email}.`),
    ).toBeVisible();

    await page.getByTestId("confirm-social-signin").click();
    await expect(page).toHaveURL("/account");
    await expect(page.getByTestId("connected-social-google")).toContainText(
      profile.email,
    );
    await expect(page.getByTestId("disconnect-social-google")).toBeDisabled();
    await expect(
      page.getByText("Add a passkey before disconnecting"),
    ).toBeVisible();
  });
});
