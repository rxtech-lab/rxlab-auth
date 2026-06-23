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

const findClient = mock();
const findUser = mock();
const findManyPasskeys = mock();
const storeChallengeMock = mock();
const generateAuthenticationOptionsMock = mock();

mock.module("@/lib/db", () => ({
  db: {
    query: {
      oauthClients: { findFirst: findClient },
      users: { findFirst: findUser },
      passkeys: { findMany: findManyPasskeys },
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
  generateAuthenticationOptions: generateAuthenticationOptionsMock,
  generateRegistrationOptions: mock(),
  verifyAuthenticationResponse: mock(),
  verifyRegistrationResponse: mock(),
}));

const { POST } = await import("./route");

function makeRequest(body: Record<string, unknown>): Request {
  return new Request(
    "https://auth.rxlab.app/api/oauth/passkey/authenticate/options",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/oauth/passkey/authenticate/options", () => {
  beforeEach(() => {
    findClient.mockReset();
    findUser.mockReset();
    findManyPasskeys.mockReset();
    storeChallengeMock.mockReset();
    generateAuthenticationOptionsMock.mockReset();

    findClient.mockResolvedValue(VALID_CLIENT);
    findUser.mockResolvedValue(undefined);
    findManyPasskeys.mockResolvedValue([]);
    storeChallengeMock.mockResolvedValue(undefined);
    generateAuthenticationOptionsMock.mockResolvedValue({
      challenge: "challenge-stub",
      rpId: "auth.rxlab.app",
      allowCredentials: [],
      timeout: 60000,
      userVerification: "preferred",
    });
  });

  test("happy path: returns options + sessionId; persists redirect_uri on challenge", async () => {
    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        redirect_uri: "rxauthswift://callback",
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.challenge).toBe("challenge-stub");
    expect(typeof body.sessionId).toBe("string");
    expect(storeChallengeMock).toHaveBeenCalledTimes(1);
    const storedChallenge = storeChallengeMock.mock.calls[0][1];
    expect(storedChallenge.redirectUri).toBe("rxauthswift://callback");
    expect(storedChallenge.clientId).toBe(VALID_CLIENT.id);
    expect(storedChallenge.type).toBe("native-authentication");
  });

  test("invalid_request: missing redirect_uri", async () => {
    const res = await POST(
      makeRequest({ client_id: VALID_CLIENT.id }) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
  });

  test("invalid_request: redirect_uri not in client's allow-list", async () => {
    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        redirect_uri: "some://other-callback",
      }) as never,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_request");
    expect(body.error_description).toBe("Invalid redirect_uri for client");
    expect(storeChallengeMock).not.toHaveBeenCalled();
  });

  test("invalid_client: unknown client_id", async () => {
    findClient.mockResolvedValue(undefined);
    const res = await POST(
      makeRequest({
        client_id: "ghost",
        redirect_uri: "rxauthswift://callback",
      }) as never,
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("invalid_client");
  });

  test("happy path: no longer requires signInPermission === 'all'", async () => {
    findClient.mockResolvedValue({
      ...VALID_CLIENT,
      signInPermission: "whitelist",
    });
    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        redirect_uri: "rxauthswift://callback",
      }) as never,
    );
    expect(res.status).toBe(200);
  });
});
