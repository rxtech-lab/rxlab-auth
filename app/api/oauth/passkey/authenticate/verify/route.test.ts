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
  permissions: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const VALID_USER = {
  id: "user-1",
  email: "user@example.com",
  emailVerified: true,
  passwordHash: null,
  username: null,
  displayName: "Test User",
  avatarSeed: null,
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const VALID_PASSKEY = {
  id: "cred-id",
  userId: "user-1",
  name: "MacBook",
  publicKey: "base64url-pubkey",
  counter: 0,
  deviceType: "platform" as const,
  backedUp: true,
  transports: null,
  createdAt: new Date(),
  lastUsedAt: null,
};

const VALID_REDIRECT_URI = "rxauthswift://callback";

const VALID_CHALLENGE = {
  challenge: "challenge-stub",
  type: "native-authentication" as const,
  clientId: VALID_CLIENT.id,
  redirectUri: VALID_REDIRECT_URI,
  createdAt: Date.now(),
};

const findClient = mock();
const findUser = mock();
const findPasskey = mock();
const getChallengeMock = mock();
const deleteChallengeMock = mock();
const verifyAuthenticationResponseMock = mock();
const signAccessTokenMock = mock();
const signIdTokenMock = mock();
const generateRefreshTokenMock = mock();
const insertValues = mock();
const updateSet = mock();

mock.module("@/lib/db", () => ({
  db: {
    query: {
      oauthClients: { findFirst: findClient },
      users: { findFirst: findUser },
      passkeys: { findFirst: findPasskey },
    },
    insert: () => ({ values: insertValues }),
    update: () => ({ set: updateSet }),
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
  verifyAuthenticationResponse: verifyAuthenticationResponseMock,
  generateAuthenticationOptions: mock(),
  generateRegistrationOptions: mock(),
  verifyRegistrationResponse: mock(),
}));

mock.module("@/lib/oauth/jwt", () => ({
  signAccessToken: signAccessTokenMock,
  signIdToken: signIdTokenMock,
  generateRefreshToken: generateRefreshTokenMock,
}));

const { POST } = await import("./route");

function makeRequest(body: Record<string, unknown>): Request {
  return new Request(
    "https://auth.rxlab.app/api/oauth/passkey/authenticate/verify",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

const VALID_BODY = {
  client_id: VALID_CLIENT.id,
  session_id: "session-id",
  credential: {
    id: "cred-id",
    rawId: "cred-id",
    type: "public-key",
    response: {
      clientDataJSON: "abc",
      authenticatorData: "def",
      signature: "ghi",
      userHandle: "user-handle",
    },
  },
  scope: "openid read:email",
};

describe("POST /api/oauth/passkey/authenticate/verify", () => {
  beforeEach(() => {
    findClient.mockReset();
    findUser.mockReset();
    findPasskey.mockReset();
    getChallengeMock.mockReset();
    deleteChallengeMock.mockReset();
    verifyAuthenticationResponseMock.mockReset();
    signAccessTokenMock.mockReset();
    signIdTokenMock.mockReset();
    generateRefreshTokenMock.mockReset();
    insertValues.mockReset();
    updateSet.mockReset();

    findClient.mockResolvedValue(VALID_CLIENT);
    findUser.mockResolvedValue(VALID_USER);
    findPasskey.mockResolvedValue(VALID_PASSKEY);
    getChallengeMock.mockResolvedValue(VALID_CHALLENGE);
    deleteChallengeMock.mockResolvedValue(undefined);
    verifyAuthenticationResponseMock.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    });
    signAccessTokenMock.mockResolvedValue("access-token-stub");
    signIdTokenMock.mockResolvedValue("id-token-stub");
    generateRefreshTokenMock.mockReturnValue("refresh-token-stub");
    insertValues.mockResolvedValue(undefined);
    updateSet.mockReturnValue({ where: () => Promise.resolve() });
  });

  test("happy path: issues tokens matching /api/oauth/token shape", async () => {
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.access_token).toBe("access-token-stub");
    expect(body.refresh_token).toBe("refresh-token-stub");
    expect(body.id_token).toBe("id-token-stub");
    expect(body.token_type).toBe("Bearer");
    expect(body.expires_in).toBe(3600);
    expect(body.scope).toBe("openid read:email");
    expect(deleteChallengeMock).toHaveBeenCalledWith("session-id");
  });

  test("invalid_client: rejects unknown client_id", async () => {
    findClient.mockResolvedValue(undefined);
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_client");
  });

  test("invalid_request: stored redirect_uri no longer in client's allow-list", async () => {
    // Simulates admin removing the URI from the client between options & verify.
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

  test("invalid_request: challenge has no redirectUri (older / corrupt)", async () => {
    getChallengeMock.mockResolvedValue({ ...VALID_CHALLENGE, redirectUri: undefined });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
  });

  test("invalid_grant: no challenge stored for session_id", async () => {
    getChallengeMock.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("invalid_grant: challenge belongs to different client", async () => {
    getChallengeMock.mockResolvedValue({
      ...VALID_CHALLENGE,
      clientId: "different-client",
    });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("invalid_grant: challenge has wrong type (e.g. browser registration)", async () => {
    getChallengeMock.mockResolvedValue({
      ...VALID_CHALLENGE,
      type: "registration",
    });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("invalid_grant: unknown credential id", async () => {
    findPasskey.mockResolvedValue(undefined);
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("invalid_grant: WebAuthn verification fails", async () => {
    verifyAuthenticationResponseMock.mockResolvedValue({ verified: false });
    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_grant");
  });

  test("happy path: native macOS assertion with bare-rpId origin verifies", async () => {
    // Simulate iOS/macOS native flow where ASAuthorizationServices sets the
    // WebAuthn origin in clientDataJSON to the bare rpId origin
    // (e.g. https://auth.rxlab.app) rather than the server's subdomain.
    // The route should pass an array of expected origins to SimpleWebAuthn,
    // so the bare-rpId origin is accepted.
    let capturedExpectedOrigin: unknown;
    verifyAuthenticationResponseMock.mockImplementation(
      async (args: { expectedOrigin: unknown }) => {
        capturedExpectedOrigin = args.expectedOrigin;
        return {
          verified: true,
          authenticationInfo: { newCounter: 1 },
        };
      },
    );

    const res = await POST(makeRequest(VALID_BODY) as never);
    expect(res.status).toBe(200);
    expect(Array.isArray(capturedExpectedOrigin)).toBe(true);
    expect(capturedExpectedOrigin as string[]).toContain(
      "http://localhost:3000",
    );
  });

  test("invalid_scope: scope outside client's allowed_scopes", async () => {
    const res = await POST(
      makeRequest({ ...VALID_BODY, scope: "openid admin:all" }) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_scope");
  });
});
