import { describe, expect, test, mock, beforeEach } from "bun:test";

const USER_ID = "user-1";
const USER_EMAIL = "user@example.com";

const VALID_USER = {
  id: USER_ID,
  email: USER_EMAIL,
  displayName: "User One",
  passwordHash: "hash",
  username: null,
  avatarSeed: "seed",
  avatarUrl: null,
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const findUser = mock();
const findPasskeys = mock();
const storeChallengeMock = mock();
const verifyAccessTokenMock = mock();
const generateRegistrationOptionsMock = mock();

mock.module("@/lib/db", () => ({
  db: {
    query: {
      users: { findFirst: findUser },
      passkeys: { findMany: findPasskeys },
    },
  },
}));

mock.module("@/lib/redis", () => ({
  storeWebAuthnChallenge: storeChallengeMock,
  getWebAuthnChallenge: mock(),
  deleteWebAuthnChallenge: mock(),
  getOAuthCode: mock(),
  deleteOAuthCode: mock(),
  storeOAuthCode: mock(),
}));

mock.module("@simplewebauthn/server", () => ({
  generateRegistrationOptions: generateRegistrationOptionsMock,
  generateAuthenticationOptions: mock(),
  verifyAuthenticationResponse: mock(),
  verifyRegistrationResponse: mock(),
}));

mock.module("@/lib/oauth/jwt", () => ({
  verifyAccessToken: verifyAccessTokenMock,
  signAccessToken: mock(),
  signIdToken: mock(),
  generateRefreshToken: mock(),
}));

const { POST } = await import("./route");

function makeRequest(
  body: Record<string, unknown> | undefined,
  authHeader: string | null = "Bearer good-token",
): Request {
  return new Request(
    "https://auth.rxlab.app/api/oauth/passkey/upgrade/options",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: body === undefined ? "" : JSON.stringify(body),
    },
  );
}

describe("POST /api/oauth/passkey/upgrade/options", () => {
  beforeEach(() => {
    findUser.mockReset();
    findPasskeys.mockReset();
    storeChallengeMock.mockReset();
    verifyAccessTokenMock.mockReset();
    generateRegistrationOptionsMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({
      sub: USER_ID,
      client_id: "macos-test-app",
      scope: "openid read:email",
    });
    findUser.mockResolvedValue(VALID_USER);
    findPasskeys.mockResolvedValue([]);
    storeChallengeMock.mockResolvedValue(undefined);
    generateRegistrationOptionsMock.mockResolvedValue({
      challenge: "challenge-stub",
      rp: { id: "auth.rxlab.app", name: "RxLab Auth" },
      user: { id: "uid", name: USER_EMAIL, displayName: "User One" },
      pubKeyCredParams: [],
      attestation: "none",
      excludeCredentials: [],
    });
  });

  test("happy path: returns options + sessionId and stores passkey-upgrade challenge", async () => {
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.sessionId).toBe("string");
    expect(body.challenge).toBe("challenge-stub");
    expect(storeChallengeMock).toHaveBeenCalledTimes(1);
    const stored = storeChallengeMock.mock.calls[0][1];
    expect(stored.type).toBe("passkey-upgrade");
    expect(stored.userId).toBe(USER_ID);
    expect(stored.clientId).toBe("macos-test-app");
  });

  test("accepts empty body", async () => {
    const res = await POST(makeRequest(undefined) as never);
    expect(res.status).toBe(200);
  });

  test("includes excludeCredentials from user's existing passkeys", async () => {
    findPasskeys.mockResolvedValue([
      { id: "cred-1", transports: JSON.stringify(["internal"]) },
      { id: "cred-2", transports: null },
    ]);
    await POST(makeRequest({}) as never);
    const optsArg = generateRegistrationOptionsMock.mock.calls[0][0];
    expect(optsArg.excludeCredentials).toEqual([
      { id: "cred-1", transports: ["internal"] },
      { id: "cred-2", transports: [] },
    ]);
  });

  test("invalid_token: missing Authorization header", async () => {
    const res = await POST(makeRequest({}, null) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_token");
  });

  test("invalid_token: malformed Authorization header", async () => {
    const res = await POST(makeRequest({}, "Basic abc") as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_token");
  });

  test("invalid_token: access token verification fails", async () => {
    verifyAccessTokenMock.mockRejectedValue(new Error("expired"));
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_token");
  });

  test("invalid_token: user row missing for token sub", async () => {
    findUser.mockResolvedValue(undefined);
    const res = await POST(makeRequest({}) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_token");
  });
});
