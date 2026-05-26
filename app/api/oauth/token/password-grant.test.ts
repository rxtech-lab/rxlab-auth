import { describe, expect, test, mock, beforeEach } from "bun:test";

// Test fixtures
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

const VALID_USER = {
  id: "user-1",
  email: "user@example.com",
  emailVerified: true,
  passwordHash: "argon2-hash-stub",
  username: "user1",
  displayName: "Test User",
  avatarSeed: null,
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mocks
const findClient = mock();
const findUser = mock();
const findConsent = mock();
const findWhitelistEntry = mock();
const verifyPasswordMock = mock();
const signAccessTokenMock = mock();
const signIdTokenMock = mock();
const generateRefreshTokenMock = mock();
const insertValues = mock();

mock.module("@/lib/db", () => ({
  db: {
    query: {
      oauthClients: { findFirst: findClient },
      users: { findFirst: findUser },
      oauthConsents: { findFirst: findConsent },
      oauthClientEmailWhitelist: { findFirst: findWhitelistEntry },
    },
    insert: () => ({ values: insertValues }),
  },
}));

mock.module("@/lib/auth/password", () => ({
  verifyPassword: verifyPasswordMock,
  hashPassword: mock(),
}));

mock.module("@/lib/oauth/jwt", () => ({
  signAccessToken: signAccessTokenMock,
  signIdToken: signIdTokenMock,
  generateRefreshToken: generateRefreshTokenMock,
}));

mock.module("@/lib/redis", () => ({
  getOAuthCode: mock(),
  deleteOAuthCode: mock(),
  storeOAuthCode: mock(),
  getWebAuthnChallenge: mock(),
  deleteWebAuthnChallenge: mock(),
  storeWebAuthnChallenge: mock(),
}));

const { POST } = await import("./route");

function makeRequest(body: Record<string, string>): Request {
  const form = new URLSearchParams(body);
  return new Request("https://auth.rxlab.app/api/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
}

describe("POST /api/oauth/token - grant_type=password", () => {
  beforeEach(() => {
    findClient.mockReset();
    findUser.mockReset();
    findConsent.mockReset();
    findWhitelistEntry.mockReset();
    verifyPasswordMock.mockReset();
    signAccessTokenMock.mockReset();
    signIdTokenMock.mockReset();
    generateRefreshTokenMock.mockReset();
    insertValues.mockReset();

    findClient.mockResolvedValue(VALID_CLIENT);
    findUser.mockResolvedValue(VALID_USER);
    findConsent.mockResolvedValue(null);
    findWhitelistEntry.mockResolvedValue(null);
    verifyPasswordMock.mockResolvedValue(true);
    signAccessTokenMock.mockResolvedValue("access-token-stub");
    signIdTokenMock.mockResolvedValue("id-token-stub");
    generateRefreshTokenMock.mockReturnValue("refresh-token-stub");
    insertValues.mockResolvedValue(undefined);
  });

  test("happy path: issues access + refresh tokens for valid credentials", async () => {
    const res = await POST(
      makeRequest({
        grant_type: "password",
        username: "user@example.com",
        password: "correct-horse",
        client_id: VALID_CLIENT.id,
        scope: "openid email",
      }) as never,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBe("access-token-stub");
    expect(body.refresh_token).toBe("refresh-token-stub");
    expect(body.id_token).toBe("id-token-stub");
    expect(body.token_type).toBe("Bearer");
    expect(body.scope).toBe("openid email");
    expect(verifyPasswordMock).toHaveBeenCalledWith(
      VALID_USER.passwordHash,
      "correct-horse",
    );
    expect(insertValues).toHaveBeenCalled();
  });

  test("happy path: omits id_token when openid scope not requested", async () => {
    const res = await POST(
      makeRequest({
        grant_type: "password",
        username: "user@example.com",
        password: "correct-horse",
        client_id: VALID_CLIENT.id,
        scope: "email",
      }) as never,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBe("access-token-stub");
    expect(body.id_token).toBeUndefined();
    expect(signIdTokenMock).not.toHaveBeenCalled();
  });

  test("invalid_grant: returns 400 when password does not match", async () => {
    verifyPasswordMock.mockResolvedValue(false);

    const res = await POST(
      makeRequest({
        grant_type: "password",
        username: "user@example.com",
        password: "wrong",
        client_id: VALID_CLIENT.id,
      }) as never,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
    expect(body.error_description).toBe("Invalid username or password");
    expect(insertValues).not.toHaveBeenCalled();
  });

  test("invalid_grant: returns 400 when user does not exist", async () => {
    findUser.mockResolvedValue(undefined);

    const res = await POST(
      makeRequest({
        grant_type: "password",
        username: "ghost@example.com",
        password: "whatever",
        client_id: VALID_CLIENT.id,
      }) as never,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
    expect(body.error_description).toBe("Invalid username or password");
  });

  test("invalid_grant: returns 400 when account is passkey-only (no passwordHash)", async () => {
    findUser.mockResolvedValue({ ...VALID_USER, passwordHash: null });

    const res = await POST(
      makeRequest({
        grant_type: "password",
        username: "user@example.com",
        password: "anything",
        client_id: VALID_CLIENT.id,
      }) as never,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
  });

  test("unauthorized_client: rejects client with signInPermission != all", async () => {
    findClient.mockResolvedValue({
      ...VALID_CLIENT,
      signInPermission: "whitelist",
    });

    const res = await POST(
      makeRequest({
        grant_type: "password",
        username: "user@example.com",
        password: "correct-horse",
        client_id: VALID_CLIENT.id,
      }) as never,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("unauthorized_client");
  });

  test("invalid_grant: rejects user with unverified email", async () => {
    delete process.env.E2E_SKIP_EMAIL_VERIFICATION;
    findUser.mockResolvedValue({ ...VALID_USER, emailVerified: false });

    const res = await POST(
      makeRequest({
        grant_type: "password",
        username: "user@example.com",
        password: "correct-horse",
        client_id: VALID_CLIENT.id,
      }) as never,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_grant");
    expect(body.error_description).toContain("not verified");
  });

  test("invalid_scope: rejects scopes outside client's allowed_scopes", async () => {
    const res = await POST(
      makeRequest({
        grant_type: "password",
        username: "user@example.com",
        password: "correct-horse",
        client_id: VALID_CLIENT.id,
        scope: "openid admin:all",
      }) as never,
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_scope");
  });
});
