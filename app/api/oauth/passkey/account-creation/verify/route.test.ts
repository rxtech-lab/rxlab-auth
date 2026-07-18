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
const VALID_REDIRECT_URI = "rxauthswift://callback";

const VALID_CHALLENGE = {
  challenge: "challenge-stub",
  userId: PENDING_USER_ID,
  type: "passkey-account-creation" as const,
  clientId: VALID_CLIENT.id,
  redirectUri: VALID_REDIRECT_URI,
  createdAt: Date.now(),
};

const findClient = mock();
const findExistingUser = mock();
const getChallengeMock = mock();
const deleteChallengeMock = mock();
const checkSignUpAllowedMock = mock();
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
  verifyAccessToken: mock(),
}));

mock.module("@/lib/oauth/roles", () => ({
  getUserRoleKeys: getUserRoleKeysMock,
}));

mock.module("@/lib/identicon/generate", () => ({
  generateAvatarSeed: generateAvatarSeedMock,
  generateIdenticon: mock(),
  generateIdenticonDataUrl: mock(),
}));

mock.module("@/lib/settings/sign-up", () => ({
  checkSignUpAllowed: checkSignUpAllowedMock,
}));

const { POST } = await import("./route");

const CREDENTIAL = {
  id: "new-cred-id",
  rawId: "new-cred-id",
  type: "public-key",
  response: {
    clientDataJSON: "abc",
    attestationObject: "def",
    transports: ["internal"],
  },
};

const VALID_EMAIL_BODY = {
  client_id: VALID_CLIENT.id,
  session_id: "session-id",
  credential: CREDENTIAL,
  contact_identifier: "newbie@example.com",
  contact_identifier_type: "email",
  name: "Newbie",
  scope: "openid read:email",
};

const VALID_PHONE_BODY = {
  client_id: VALID_CLIENT.id,
  session_id: "session-id",
  credential: CREDENTIAL,
  contact_identifier: "+1 (415) 555-0100",
  contact_identifier_type: "phone_number",
  name: "Newbie",
  scope: "openid",
};

function makeRequest(body: Record<string, unknown>): Request {
  return new Request(
    "https://auth.rxlab.app/api/oauth/passkey/account-creation/verify",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/oauth/passkey/account-creation/verify", () => {
  beforeEach(() => {
    findClient.mockReset();
    findExistingUser.mockReset();
    getChallengeMock.mockReset();
    deleteChallengeMock.mockReset();
    checkSignUpAllowedMock.mockReset();
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
    checkSignUpAllowedMock.mockResolvedValue({ allowed: true });
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

  test("happy path (email): creates user with verified email + passkey, returns tokens", async () => {
    const res = await POST(makeRequest(VALID_EMAIL_BODY) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.access_token).toBe("access-token-stub");
    expect(body.refresh_token).toBe("refresh-token-stub");
    expect(body.id_token).toBe("id-token-stub");
    expect(body.scope).toBe("openid read:email");

    expect(transactionMock).toHaveBeenCalled();
    // 2 tx inserts (user + passkey) + 1 refresh-token insert.
    expect(insertValues).toHaveBeenCalledTimes(3);
    const userInsert = insertValues.mock.calls[0][0];
    expect(userInsert.email).toBe("newbie@example.com");
    expect(userInsert.emailVerified).toBe(true);
    expect(userInsert.displayName).toBe("Newbie");
    expect(userInsert.passwordHash).toBeNull();
    expect(deleteChallengeMock).toHaveBeenCalledWith("session-id");
  });

  test("happy path (phone): stores synthetic email, emailVerified=false", async () => {
    const res = await POST(makeRequest(VALID_PHONE_BODY) as never);
    expect(res.status).toBe(201);
    const userInsert = insertValues.mock.calls[0][0];
    expect(userInsert.email).toBe("14155550100@phone.rxlab.local");
    expect(userInsert.emailVerified).toBe(false);
  });

  test("assigns the client's explicit default role in the creation transaction", async () => {
    findClient.mockResolvedValue({
      ...VALID_CLIENT,
      defaultRoleId: "member-role-id",
    });

    const res = await POST(makeRequest(VALID_EMAIL_BODY) as never);

    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledTimes(4);
    expect(insertValues.mock.calls[2][0]).toMatchObject({
      clientId: VALID_CLIENT.id,
      userId: PENDING_USER_ID,
      roleId: "member-role-id",
    });
  });

  test("invalid_grant: expired/missing session", async () => {
    getChallengeMock.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_EMAIL_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("invalid_grant: challenge type mismatch", async () => {
    getChallengeMock.mockResolvedValue({
      ...VALID_CHALLENGE,
      type: "native-registration",
    });
    const res = await POST(makeRequest(VALID_EMAIL_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("user_exists: identifier already claimed", async () => {
    findExistingUser.mockResolvedValue({
      id: "x",
      email: "newbie@example.com",
    });
    const res = await POST(makeRequest(VALID_EMAIL_BODY) as never);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("user_exists");
    expect(insertValues).not.toHaveBeenCalled();
    expect(deleteChallengeMock).toHaveBeenCalledWith("session-id");
  });

  test("invalid_request: malformed email identifier", async () => {
    const res = await POST(
      makeRequest({
        ...VALID_EMAIL_BODY,
        contact_identifier: "not-an-email",
      }) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
    expect(body.error_description).toContain("email");
  });

  test("invalid_request: malformed phone identifier (too few digits)", async () => {
    const res = await POST(
      makeRequest({
        ...VALID_PHONE_BODY,
        contact_identifier: "12",
      }) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
    expect(body.error_description).toContain("phone");
  });

  test("invalid_grant: WebAuthn registration verification fails", async () => {
    verifyRegistrationResponseMock.mockResolvedValue({ verified: false });
    const res = await POST(makeRequest(VALID_EMAIL_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("invalid_scope: scope outside client's allowed_scopes", async () => {
    const res = await POST(
      makeRequest({ ...VALID_EMAIL_BODY, scope: "openid admin:all" }) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_scope");
  });

  test("invalid_client: unknown client_id at verify time", async () => {
    findClient.mockResolvedValue(undefined);
    const res = await POST(makeRequest(VALID_EMAIL_BODY) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_client");
  });
});
