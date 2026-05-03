import { test, expect } from "@playwright/test";

const ADMIN_PASSWORD = "e2e-test-admin-password";

test.describe("OAuth Account Selection", () => {
  let clientId: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login as admin to create OAuth client
    await page.goto("/admin");
    await page.getByLabel("Admin Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in with Password" }).click();
    await expect(page).toHaveURL("/admin/dashboard");

    // Create OAuth client
    await page.goto("/admin/dashboard/clients/new");
    await page.getByLabel("Application Name").fill("Account Select Test App");
    await page.getByTestId("redirect-uri-0").fill("http://localhost:3001/callback");
    await page.getByTestId("profile").click();
    await page.getByTestId("email").click();

    await page.getByRole("button", { name: "Create Application" }).click();
    await expect(page.getByText("Client Created Successfully")).toBeVisible();

    clientId = await page.getByTestId("client-id-display").inputValue();

    await page.close();
    await context.close();
  });

  function buildAuthorizeUrl(clientId: string, state?: string) {
    const codeChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    return (
      `/api/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent("http://localhost:3001/callback")}&` +
      `response_type=code&` +
      `scope=openid%20profile%20email&` +
      `state=${state || "test-state"}&` +
      `code_challenge=${codeChallenge}&` +
      `code_challenge_method=S256`
    );
  }

  test("should NOT show account selection on first-time sign-in", async ({
    page,
  }, testInfo) => {
    // Create a new user for this test
    const user = {
      email: `acct-sel-first-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "First Sign In User",
    };

    // Register the user
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(user.displayName);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");

    // Logout and wait for redirect to login page
    await page.getByRole("button", { name: "Avatar" }).click();
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL("/login");

    // Now start OAuth flow without being logged in
    await page.goto(buildAuthorizeUrl(clientId));

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);

    // Login
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Should go directly to consent page WITHOUT showing account selection
    await expect(page).toHaveURL(/\/oauth\/authorize/);
    // Verify it's the consent page, not the account select page
    expect(page.url()).not.toContain("/oauth/account-select");
    await expect(
      page.getByRole("heading", { name: "Account Select Test App" })
    ).toBeVisible();
  });

  test("should show account selection when user is already signed in", async ({
    page,
  }, testInfo) => {
    // Create a new user for this test
    const user = {
      email: `acct-sel-existing-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Already Signed In User",
    };

    // Register the user (auto-logs in)
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(user.displayName);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");

    // Now start OAuth flow while already logged in
    await page.goto(buildAuthorizeUrl(clientId));

    // Should show account selection page
    await expect(page).toHaveURL(/\/oauth\/account-select/);
    await expect(page.getByText("Choose an account")).toBeVisible();
    await expect(page.getByText(user.email)).toBeVisible();

    // Click continue with current account
    await page.getByTestId("continue-as-current").click();

    // Should proceed to consent page
    await expect(page).toHaveURL(/\/oauth\/authorize/);
    expect(page.url()).not.toContain("/oauth/account-select");
  });

  test("preserves OAuth params through 'use different account' → re-login", async ({
    page,
  }, testInfo) => {
    const user = {
      email: `acct-sel-switch-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Switch Account User",
    };

    // Register the user (auto-logs in)
    await page.goto("/register");
    await page.getByLabel("Display Name").fill(user.displayName);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL("/account");

    // Start OAuth flow while logged in
    await page.goto(buildAuthorizeUrl(clientId));
    await expect(page).toHaveURL(/\/oauth\/account-select/);

    // Click "Use a different account" - should sign out and redirect to login
    // with the OAuth params preserved in `redirect`
    await page.getByTestId("use-different-account").click();

    // Should land on /login
    await expect(page).toHaveURL(/\/login\?/);

    // The login URL must have a single `redirect` param whose value (when
    // URL-decoded) contains all OAuth params. If the inner `&` chars were not
    // encoded, the outer URL parser will only see `client_id` in `redirect`
    // and the rest will leak as top-level query params on /login.
    const loginUrl = new URL(page.url());
    const redirectParam = loginUrl.searchParams.get("redirect");
    expect(redirectParam).not.toBeNull();
    // Outer URL must not have top-level OAuth params (regression check).
    expect(loginUrl.searchParams.get("redirect_uri")).toBeNull();
    expect(loginUrl.searchParams.get("response_type")).toBeNull();

    const redirectUrl = new URL(redirectParam!, "http://localhost:3000");
    expect(redirectUrl.pathname).toBe("/api/oauth/authorize");
    expect(redirectUrl.searchParams.get("client_id")).toBe(clientId);
    expect(redirectUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3001/callback"
    );
    expect(redirectUrl.searchParams.get("response_type")).toBe("code");
    expect(redirectUrl.searchParams.get("scope")).toBe("openid profile email");
    expect(redirectUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(redirectUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(redirectUrl.searchParams.get("fresh_login")).toBe("true");

    // Sign in
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    // Should leave /login and reach the consent page (NOT the OAuth error page).
    await page.waitForURL((url) => !url.toString().includes("/login"));
    expect(page.url()).not.toContain("/oauth/error");
    await expect(
      page.getByText("redirect_uri must be a valid URL")
    ).not.toBeVisible();

    // fresh_login=true should skip account selection
    expect(page.url()).not.toContain("/oauth/account-select");
  });

  test("preserves OAuth params through /login → 'Sign up' link → register", async ({
    page,
  }, testInfo) => {
    const user = {
      email: `acct-sel-signup-${Date.now()}-${testInfo.parallelIndex}@example.com`,
      password: "TestPassword123!",
      displayName: "Signup From OAuth User",
    };

    // Hit OAuth authorize while logged out → should redirect to /login with
    // `redirect` param holding the full authorize URL.
    await page.goto(buildAuthorizeUrl(clientId));
    await expect(page).toHaveURL(/\/login\?redirect=/);

    const loginRedirectParam = new URL(page.url()).searchParams.get("redirect");
    expect(loginRedirectParam).not.toBeNull();

    // Click the "Sign up" link from the login page.
    await page.getByRole("link", { name: "Sign up" }).click();

    // /register must preserve the same `redirect` param so the user ends up
    // back in the OAuth flow after creating an account. If the link drops it,
    // OAuth context is silently lost (and any browser-back path can resurface
    // a malformed URL → "redirect_uri must be a valid URL").
    await expect(page).toHaveURL(/\/register/);
    const registerRedirectParam = new URL(page.url()).searchParams.get(
      "redirect"
    );
    expect(registerRedirectParam).toBe(loginRedirectParam);

    // Fill out the register form.
    await page.getByLabel("Display Name").fill(user.displayName);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();

    // After sign-up, the user must land in the OAuth flow (consent page or
    // callback), NOT silently dumped on /account with the OAuth context lost.
    await page.waitForURL(
      (url) => !url.toString().includes("/register"),
      { timeout: 20000 }
    );
    expect(page.url()).not.toContain("/oauth/error");
    await expect(
      page.getByText("redirect_uri must be a valid URL")
    ).not.toBeVisible();
    expect(page.url()).not.toMatch(/\/account(?:$|\?|#)/);
  });
});
