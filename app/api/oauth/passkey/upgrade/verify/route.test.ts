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

const VALID_CHALLENGE = {
  challenge: "challenge-stub",
  userId: USER_ID,
  type: "passkey-upgrade" as const,
  clientId: "macos-test-app",
  createdAt: Date.now(),
};

const findUser = mock();
const findExistingPasskey = mock();
const insertValues = mock();
const getChallengeMock = mock();
const deleteChallengeMock = mock();
const verifyAccessTokenMock = mock();
const verifyRegistrationResponseMock = mock();

mock.module("@/lib/db", () => ({
  db: {
    query: {
      users: { findFirst: findUser },
      passkeys: { findFirst: findExistingPasskey },
    },
    insert: () => ({ values: insertValues }),
  },
}));

mock.module("@/lib/redis", () => ({
  getWebAuthnChallenge: getChallengeMock,
  deleteWebAuthnChallenge: deleteChallengeMock,
  storeWebAuthnChallenge: mock(),
  getOAuthCode: mock(),
  deleteOAuthCode: mock(),
  storeOAuthCode: mock(),
}));

mock.module("@simplewebauthn/server", () => ({
  verifyRegistrationResponse: verifyRegistrationResponseMock,
  verifyAuthenticationResponse: mock(),
  generateRegistrationOptions: mock(),
  generateAuthenticationOptions: mock(),
}));

mock.module("@/lib/oauth/jwt", () => ({
  verifyAccessToken: verifyAccessTokenMock,
  signAccessToken: mock(),
  signIdToken: mock(),
  generateRefreshToken: mock(),
}));

const { POST } = await import("./route");

const VALID_BODY = {
  session_id: "session-id",
  credential: {
    id: "new-cred-id",
    rawId: "new-cred-id",
    type: "public-key",
    response: {
      clientDataJSON: "abc",
      attestationObject: "def",
      transports: ["internal"],
    },
  },
};

function makeRequest(
  body: Record<string, unknown>,
  authHeader: string | null = "Bearer good-token",
): Request {
  return new Request(
    "https://auth.rxlab.app/api/oauth/passkey/upgrade/verify",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/oauth/passkey/upgrade/verify", () => {
  beforeEach(() => {
    findUser.mockReset();
    findExistingPasskey.mockReset();
    insertValues.mockReset();
    getChallengeMock.mockReset();
    deleteChallengeMock.mockReset();
    verifyAccessTokenMock.mockReset();
    verifyRegistrationResponseMock.mockReset();

    verifyAccessTokenMock.mockResolvedValue({
      sub: USER_ID,
      client_id: "macos-test-app",
      scope: "openid",
    });
    findUser.mockResolvedValue(VALID_USER);
    findExistingPasskey.mockResolvedValue(undefined);
    getChallengeMock.mockResolvedValue(VALID_CHALLENGE);
    deleteChallengeMock.mockResolvedValue(undefined);
    insertValues.mockResolvedValue(undefined);
    verifyRegistrationResponseMock.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: "new-cred-id",
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
        },
        credentialDeviceType: "platform",
        credentialBackedUp: true,
      },
    });
  });

  test("happy path: persists passkey against authenticated user and returns 201", async () => {
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.credential_id).toBe("new-cred-id");
    expect(insertValues).toHaveBeenCalledTimes(1);
    const inserted = insertValues.mock.calls[0][0];
    expect(inserted.userId).toBe(USER_ID);
    expect(inserted.id).toBe("new-cred-id");
    expect(deleteChallengeMock).toHaveBeenCalledWith("session-id");
  });

  test("invalid_token: missing Authorization header", async () => {
    const res = await POST(makeRequest(VALID_BODY, null) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_token");
  });

  test("invalid_token: access token verification fails", async () => {
    verifyAccessTokenMock.mockRejectedValue(new Error("expired"));
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_token");
  });

  test("invalid_grant: no challenge for session_id", async () => {
    getChallengeMock.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("invalid_grant: challenge type mismatch", async () => {
    getChallengeMock.mockResolvedValue({
      ...VALID_CHALLENGE,
      type: "native-registration",
    });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("invalid_grant: challenge bound to different user than token sub", async () => {
    getChallengeMock.mockResolvedValue({
      ...VALID_CHALLENGE,
      userId: "different-user",
    });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("invalid_grant: WebAuthn verification fails", async () => {
    verifyRegistrationResponseMock.mockResolvedValue({ verified: false });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("credential_exists: same credential ID already in passkeys table", async () => {
    findExistingPasskey.mockResolvedValue({ id: "new-cred-id" });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("credential_exists");
    expect(insertValues).not.toHaveBeenCalled();
    expect(deleteChallengeMock).toHaveBeenCalledWith("session-id");
  });

  test("invalid_request: body is not JSON", async () => {
    const req = new Request(
      "https://auth.rxlab.app/api/oauth/passkey/upgrade/verify",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: "Bearer good-token",
        },
        body: "not-json{",
      },
    );
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_request");
  });

  test("invalid_request: missing session_id", async () => {
    const res = await POST(
      makeRequest({ credential: VALID_BODY.credential }) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_request");
  });
});
