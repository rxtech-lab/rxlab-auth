import { describe, expect, test, mock, beforeEach } from "bun:test";

const VALID_CLIENT = {
  id: "macos-test-app",
  clientType: "public" as const,
  secret: null as string | null,
  name: "macOS Test App",
  description: null,
  iconUrl: null,
  redirectUris: JSON.stringify(["rxauthswift://callback"]),
  allowedScopes: JSON.stringify(["openid", "read:profile", "read:email"]),
  isFirstParty: true,
  signInPermission: "all" as const,
  defaultRoleId: null as string | null,
  permissions: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PENDING_USER_ID = "pending-user-id";
const PENDING_EMAIL = "newbie@example.com";

const VALID_REDIRECT_URI = "rxauthswift://callback";

const VALID_CHALLENGE = {
  challenge: "challenge-stub",
  userId: PENDING_USER_ID,
  type: "native-registration" as const,
  clientId: VALID_CLIENT.id,
  redirectUri: VALID_REDIRECT_URI,
  pendingEmail: PENDING_EMAIL,
  pendingDisplayName: "Newbie",
  createdAt: Date.now(),
};

const findClient = mock();
const findExistingUser = mock();
const getChallengeMock = mock();
const deleteChallengeMock = mock();
const verifyRegistrationResponseMock = mock();
const signAccessTokenMock = mock();
const signIdTokenMock = mock();
const generateRefreshTokenMock = mock();
const getUserRoleKeysMock = mock();
const generateAvatarSeedMock = mock();
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
  generateAuthenticationOptions: mock(),
  generateRegistrationOptions: mock(),
}));

mock.module("@/lib/oauth/jwt", () => ({
  signAccessToken: signAccessTokenMock,
  signIdToken: signIdTokenMock,
  generateRefreshToken: generateRefreshTokenMock,
}));

mock.module("@/lib/oauth/roles", () => ({
  getUserRoleKeys: getUserRoleKeysMock,
}));

mock.module("@/lib/identicon/generate", () => ({
  generateAvatarSeed: generateAvatarSeedMock,
  generateIdenticon: mock(),
  generateIdenticonDataUrl: mock(),
}));

const { POST } = await import("./route");

const VALID_BODY = {
  client_id: VALID_CLIENT.id,
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
  scope: "openid read:email",
};

function makeRequest(body: Record<string, unknown>): Request {
  return new Request(
    "https://auth.rxlab.app/api/oauth/passkey/register/verify",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/oauth/passkey/register/verify", () => {
  beforeEach(() => {
    findClient.mockReset();
    findExistingUser.mockReset();
    getChallengeMock.mockReset();
    deleteChallengeMock.mockReset();
    verifyRegistrationResponseMock.mockReset();
    signAccessTokenMock.mockReset();
    signIdTokenMock.mockReset();
    generateRefreshTokenMock.mockReset();
    getUserRoleKeysMock.mockReset();
    generateAvatarSeedMock.mockReset();
    insertValues.mockReset();
    transactionMock.mockReset();

    findClient.mockResolvedValue(VALID_CLIENT);
    findExistingUser.mockResolvedValue(undefined);
    getChallengeMock.mockResolvedValue(VALID_CHALLENGE);
    deleteChallengeMock.mockResolvedValue(undefined);
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
    signAccessTokenMock.mockResolvedValue("access-token-stub");
    signIdTokenMock.mockResolvedValue("id-token-stub");
    generateRefreshTokenMock.mockReturnValue("refresh-token-stub");
    getUserRoleKeysMock.mockResolvedValue(["member"]);
    generateAvatarSeedMock.mockReturnValue("seed-stub");
    insertValues.mockResolvedValue(undefined);
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const tx = { insert: () => ({ values: insertValues }) };
      await cb(tx);
    });
  });

  test("happy path: creates user + passkey and returns tokens", async () => {
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.access_token).toBe("access-token-stub");
    expect(body.refresh_token).toBe("refresh-token-stub");
    expect(body.id_token).toBe("id-token-stub");
    expect(body.token_type).toBe("Bearer");
    expect(body.scope).toBe("openid read:email");
    expect(transactionMock).toHaveBeenCalled();
    // 2 tx inserts + 1 refresh-token insert from issueOAuthTokenResponse
    expect(insertValues).toHaveBeenCalledTimes(3);
    expect(deleteChallengeMock).toHaveBeenCalledWith("session-id");
  });

  test("assigns the client's explicit default role in the creation transaction", async () => {
    findClient.mockResolvedValue({
      ...VALID_CLIENT,
      defaultRoleId: "member-role-id",
    });

    const res = await POST(makeRequest(VALID_BODY) as never);

    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledTimes(4);
    expect(insertValues.mock.calls[2][0]).toMatchObject({
      clientId: VALID_CLIENT.id,
      userId: PENDING_USER_ID,
      roleId: "member-role-id",
    });
  });

  test("invalid_client: rejects unknown client_id", async () => {
    findClient.mockResolvedValue(undefined);
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_client");
  });

  test("invalid_request: stored redirect_uri no longer in client's allow-list", async () => {
    findClient.mockResolvedValue({
      ...VALID_CLIENT,
      redirectUris: JSON.stringify(["some://other-callback"]),
    });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
    expect(body.error_description).toBe("Invalid redirect_uri for client");
  });

  test("invalid_grant: missing challenge for session_id", async () => {
    getChallengeMock.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("invalid_grant: challenge type mismatch (browser registration)", async () => {
    getChallengeMock.mockResolvedValue({
      ...VALID_CHALLENGE,
      type: "registration",
    });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("invalid_grant: WebAuthn registration verification fails", async () => {
    verifyRegistrationResponseMock.mockResolvedValue({ verified: false });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("user_exists: email taken between options and verify", async () => {
    findExistingUser.mockResolvedValue({ id: "x", email: PENDING_EMAIL });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("user_exists");
    expect(deleteChallengeMock).toHaveBeenCalledWith("session-id");
  });

  test("invalid_scope: scope outside client's allowed_scopes", async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, scope: "openid admin:all" }) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_scope");
  });
});
