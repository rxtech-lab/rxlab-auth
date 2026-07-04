import { describe, expect, test, mock, beforeEach } from "bun:test";

const VALID_CLIENT = {
  id: "macos-test-app",
  clientType: "public" as const,
  secret: null as string | null,
  name: "macOS Test App",
  description: null,
  iconUrl: null,
  redirectUris: JSON.stringify(["rxauthswift://callback"]),
  allowedScopes: JSON.stringify(["openid", "email", "profile"]),
  isFirstParty: true,
  signInPermission: "all" as const,
  permissions: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const findClient = mock();
const findExistingUser = mock();
const checkSignUpAllowedMock = mock();
const hashPasswordMock = mock();
const signAccessTokenMock = mock();
const signIdTokenMock = mock();
const generateRefreshTokenMock = mock();
const getUserRoleKeysMock = mock();
const generateAvatarSeedMock = mock();
const sendEmailMock = mock();
const insertValues = mock();
const transactionMock = mock();

mock.module("@/lib/db", () => ({
  db: {
    query: {
      oauthClients: { findFirst: findClient },
      users: { findFirst: findExistingUser },
    },
    insert: () => ({ values: insertValues }),
    transaction: transactionMock,
  },
}));

mock.module("@/lib/auth/password", () => ({
  hashPassword: hashPasswordMock,
  verifyPassword: mock(),
}));

mock.module("@/lib/oauth/jwt", () => ({
  signAccessToken: signAccessTokenMock,
  signIdToken: signIdTokenMock,
  generateRefreshToken: generateRefreshTokenMock,
}));

mock.module("@/lib/oauth/roles", () => ({
  getUserRoleKeys: getUserRoleKeysMock,
}));

mock.module("@/lib/settings/sign-up", () => ({
  checkSignUpAllowed: checkSignUpAllowedMock,
}));

mock.module("@/lib/identicon/generate", () => ({
  generateAvatarSeed: generateAvatarSeedMock,
}));

mock.module("@/lib/email/resend", () => ({
  sendEmail: sendEmailMock,
}));

mock.module("@/lib/email/templates", () => ({
  getVerificationEmailHtml: () => "<html/>",
  getVerificationEmailText: () => "text",
}));

const { POST } = await import("./route");

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("https://auth.rxlab.app/api/oauth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/oauth/signup", () => {
  beforeEach(() => {
    findClient.mockReset();
    findExistingUser.mockReset();
    checkSignUpAllowedMock.mockReset();
    hashPasswordMock.mockReset();
    signAccessTokenMock.mockReset();
    signIdTokenMock.mockReset();
    generateRefreshTokenMock.mockReset();
    getUserRoleKeysMock.mockReset();
    generateAvatarSeedMock.mockReset();
    sendEmailMock.mockReset();
    insertValues.mockReset();
    transactionMock.mockReset();

    findClient.mockResolvedValue(VALID_CLIENT);
    findExistingUser.mockResolvedValue(undefined);
    checkSignUpAllowedMock.mockResolvedValue({ allowed: true });
    hashPasswordMock.mockResolvedValue("argon2-hash");
    signAccessTokenMock.mockResolvedValue("access-token-stub");
    signIdTokenMock.mockResolvedValue("id-token-stub");
    generateRefreshTokenMock.mockReturnValue("refresh-token-stub");
    getUserRoleKeysMock.mockResolvedValue(["member"]);
    generateAvatarSeedMock.mockReturnValue("seed-stub");
    sendEmailMock.mockResolvedValue(undefined);
    insertValues.mockResolvedValue(undefined);
    // Make tx wrapper invoke the callback with a tx that proxies to insertValues.
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = { insert: () => ({ values: insertValues }) };
      await cb(tx);
    });

    process.env.E2E_SKIP_EMAIL_VERIFICATION = "true";
  });

  test("E2E mode happy path: creates verified user and returns tokens", async () => {
    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        username: "new@example.com",
        password: "correct-horse",
        name: "New User",
        scope: "openid email",
      }) as never,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.access_token).toBe("access-token-stub");
    expect(body.refresh_token).toBe("refresh-token-stub");
    expect(body.id_token).toBe("id-token-stub");
    expect(body.token_type).toBe("Bearer");
    expect(body.scope).toBe("openid email");
    expect(hashPasswordMock).toHaveBeenCalledWith("correct-horse");
    expect(signAccessTokenMock.mock.calls[0][0].roles).toEqual(["member"]);
    // 2 inserts: users + oauthRefreshTokens
    expect(insertValues).toHaveBeenCalledTimes(2);
  });

  test("non-E2E mode: creates unverified user, sends email, returns user_id", async () => {
    process.env.E2E_SKIP_EMAIL_VERIFICATION = "false";

    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        username: "new@example.com",
        password: "correct-horse",
      }) as never,
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email_verification_required).toBe(true);
    expect(body.email).toBe("new@example.com");
    expect(typeof body.user_id).toBe("string");
    expect(body.access_token).toBeUndefined();
    expect(sendEmailMock).toHaveBeenCalled();
    expect(transactionMock).toHaveBeenCalled();
  });

  test("invalid_request: rejects malformed JSON body", async () => {
    const res = await POST(
      new Request("https://auth.rxlab.app/api/oauth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }) as never,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
  });

  test("invalid_request: rejects non-email username", async () => {
    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        username: "not-an-email",
        password: "correct-horse",
      }) as never,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
  });

  test("invalid_client: rejects unknown client", async () => {
    findClient.mockResolvedValue(undefined);

    const res = await POST(
      makeRequest({
        client_id: "ghost-client",
        username: "new@example.com",
        password: "correct-horse",
      }) as never,
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("invalid_client");
  });

  test("unauthorized_client: rejects client with signInPermission != all", async () => {
    findClient.mockResolvedValue({
      ...VALID_CLIENT,
      signInPermission: "whitelist",
    });

    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        username: "new@example.com",
        password: "correct-horse",
      }) as never,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unauthorized_client");
  });

  test("user_exists: rejects duplicate email", async () => {
    findExistingUser.mockResolvedValue({ id: "existing", email: "new@example.com" });

    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        username: "new@example.com",
        password: "correct-horse",
      }) as never,
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("user_exists");
  });

  test("access_denied: rejects when sign-up disabled", async () => {
    checkSignUpAllowedMock.mockResolvedValue({
      allowed: false,
      reason: "disabled",
    });

    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        username: "new@example.com",
        password: "correct-horse",
      }) as never,
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("access_denied");
    expect(body.error_description).toContain("disabled");
  });

  test("access_denied: rejects when email not on whitelist", async () => {
    checkSignUpAllowedMock.mockResolvedValue({
      allowed: false,
      reason: "not_whitelisted",
    });

    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        username: "new@example.com",
        password: "correct-horse",
      }) as never,
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("access_denied");
    expect(body.error_description).toContain("approved list");
  });

  test("invalid_scope: rejects scopes outside client's allowed_scopes", async () => {
    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        username: "new@example.com",
        password: "correct-horse",
        scope: "openid admin:all",
      }) as never,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_scope");
  });
});
