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
const storeChallengeMock = mock();
const checkSignUpAllowedMock = mock();
const generateRegistrationOptionsMock = mock();

mock.module("@/lib/db", () => ({
  db: {
    query: {
      oauthClients: { findFirst: findClient },
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

mock.module("@/lib/settings/sign-up", () => ({
  checkSignUpAllowed: checkSignUpAllowedMock,
}));

const { POST } = await import("./route");

function makeRequest(body: Record<string, unknown>): Request {
  return new Request(
    "https://auth.rxlab.app/api/oauth/passkey/account-creation/options",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("POST /api/oauth/passkey/account-creation/options", () => {
  beforeEach(() => {
    findClient.mockReset();
    storeChallengeMock.mockReset();
    checkSignUpAllowedMock.mockReset();
    generateRegistrationOptionsMock.mockReset();

    findClient.mockResolvedValue(VALID_CLIENT);
    storeChallengeMock.mockResolvedValue(undefined);
    checkSignUpAllowedMock.mockResolvedValue({ allowed: true });
    generateRegistrationOptionsMock.mockResolvedValue({
      challenge: "challenge-stub",
      rp: { id: "rxlab.app", name: "RxLab Auth" },
      user: { id: "uid", name: "", displayName: "" },
      pubKeyCredParams: [],
      attestation: "none",
    });
  });

  test("happy path: returns options + sessionId, stores passkey-account-creation challenge with no identifier yet", async () => {
    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        redirect_uri: "rxauthswift://callback",
      }) as never,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.sessionId).toBe("string");
    expect(body.challenge).toBe("challenge-stub");

    expect(storeChallengeMock).toHaveBeenCalledTimes(1);
    const stored = storeChallengeMock.mock.calls[0][1];
    expect(stored.type).toBe("passkey-account-creation");
    expect(stored.clientId).toBe(VALID_CLIENT.id);
    expect(stored.redirectUri).toBe("rxauthswift://callback");
    expect(typeof stored.userId).toBe("string");
    expect(stored.pendingEmail).toBeUndefined();
  });

  test("invalid_request: missing redirect_uri", async () => {
    const res = await POST(
      makeRequest({ client_id: VALID_CLIENT.id }) as never,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_request");
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

  test("access_denied: global sign-up disabled", async () => {
    checkSignUpAllowedMock.mockResolvedValue({
      allowed: false,
      reason: "disabled",
    });
    const res = await POST(
      makeRequest({
        client_id: VALID_CLIENT.id,
        redirect_uri: "rxauthswift://callback",
      }) as never,
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("access_denied");
  });
});
