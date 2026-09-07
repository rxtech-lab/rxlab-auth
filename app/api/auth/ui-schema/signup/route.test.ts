import { describe, expect, test, mock, beforeEach } from "bun:test";

const FIRST_PARTY_CLIENT = {
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
const getSignUpStatusMock = mock();
const getEnabledSocialProvidersMock = mock();

mock.module("@/lib/auth/social/providers", () => ({
  getEnabledSocialProviders: getEnabledSocialProvidersMock,
}));

mock.module("@/lib/db", () => ({
  db: {
    query: {
      oauthClients: { findFirst: findClient },
    },
  },
}));

mock.module("@/lib/settings/sign-up", () => ({
  getSignUpStatus: getSignUpStatusMock,
}));

const { GET } = await import("./route");

function makeRequest(search: string = ""): Request {
  const url = `https://auth.rxlab.app/api/auth/ui-schema/signup${search ? `?${search}` : ""}`;
  return new Request(url);
}

describe("GET /api/auth/ui-schema/signup", () => {
  beforeEach(() => {
    findClient.mockReset();
    getEnabledSocialProvidersMock.mockReset();
    getEnabledSocialProvidersMock.mockReturnValue([
      {
        id: "google",
        label: "Continue with Google",
        iconPath: "/brand/google-g.svg",
        darkIconPath: "/brand/google-g.svg",
      },
      {
        id: "github",
        label: "Continue with GitHub",
        iconPath: "/brand/github-invertocat-black.svg",
        darkIconPath: "/brand/github-invertocat-white.svg",
      },
    ]);
    getSignUpStatusMock.mockReset();
    getSignUpStatusMock.mockResolvedValue({
      publicSignUpEnabled: true,
      whitelistEnabled: false,
      isCompletelyDisabled: false,
    });
    delete process.env.UI_SCHEMA_PASSKEY_ACCOUNT_CREATION;
  });

  test("sign-up allowed returns password + passkey_account_creation by default (legacy passkey suppressed)", async () => {
    findClient.mockResolvedValue(FIRST_PARTY_CLIENT);

    const res = await GET(makeRequest(`client_id=${FIRST_PARTY_CLIENT.id}`) as never);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.flow).toBe("signup");
    expect(body.title).toBe("Create your macOS Test App account");
    expect(body.submitLabel).toBe("Create account");
    expect(body.identityProviders).toEqual([
      {
        id: "google",
        label: "Continue with Google",
        iconUrl: "https://auth.rxlab.app/brand/google-g.svg",
        darkIconUrl: "https://auth.rxlab.app/brand/google-g.svg",
        authorizationParameters: { identity_provider: "google" },
      },
      {
        id: "github",
        label: "Continue with GitHub",
        iconUrl: "https://auth.rxlab.app/brand/github-invertocat-black.svg",
        darkIconUrl: "https://auth.rxlab.app/brand/github-invertocat-white.svg",
        authorizationParameters: { identity_provider: "github" },
      },
    ]);

    const methodIds = body.supportedMethods.map((m: { id: string }) => m.id);
    expect(methodIds).toEqual(["password", "passkey_account_creation"]);
    expect(methodIds).not.toContain("passkey");

    const fieldKeys = body.fields.map((f: { key: string }) => f.key);
    expect(fieldKeys).toEqual(["email", "password", "name"]);
  });

  test("UI_SCHEMA_PASSKEY_ACCOUNT_CREATION=false omits passkey_account_creation", async () => {
    process.env.UI_SCHEMA_PASSKEY_ACCOUNT_CREATION = "false";
    findClient.mockResolvedValue(FIRST_PARTY_CLIENT);

    const res = await GET(makeRequest(`client_id=${FIRST_PARTY_CLIENT.id}`) as never);
    const body = await res.json();
    const methodIds = body.supportedMethods.map((m: { id: string }) => m.id);
    expect(methodIds).toEqual(["password", "passkey"]);
  });

  test("sign-up disabled omits all methods", async () => {
    findClient.mockResolvedValue(FIRST_PARTY_CLIENT);
    getSignUpStatusMock.mockResolvedValue({
      publicSignUpEnabled: false,
      whitelistEnabled: false,
      isCompletelyDisabled: true,
    });

    const res = await GET(makeRequest(`client_id=${FIRST_PARTY_CLIENT.id}`) as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.supportedMethods).toEqual([]);
    expect(body.identityProviders).toEqual([]);
    // Fields still present so client can render the form layout for an
    // "invite-only / disabled" empty state.
    const fieldKeys = body.fields.map((f: { key: string }) => f.key);
    expect(fieldKeys).toEqual(["email", "password", "name"]);
  });

  test("whitelist-only mode still treats sign-up as form-level allowed", async () => {
    findClient.mockResolvedValue(FIRST_PARTY_CLIENT);
    getSignUpStatusMock.mockResolvedValue({
      publicSignUpEnabled: false,
      whitelistEnabled: true,
      isCompletelyDisabled: false,
    });

    const res = await GET(makeRequest(`client_id=${FIRST_PARTY_CLIENT.id}`) as never);
    const body = await res.json();
    const methodIds = body.supportedMethods.map((m: { id: string }) => m.id);
    expect(methodIds).toEqual(["password", "passkey_account_creation"]);
  });

  test("unknown client_id returns 404 invalid_client", async () => {
    findClient.mockResolvedValue(undefined);
    const res = await GET(makeRequest("client_id=ghost") as never);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("invalid_client");
  });

  test("no configured social providers returns an empty list", async () => {
    findClient.mockResolvedValue(FIRST_PARTY_CLIENT);
    getEnabledSocialProvidersMock.mockReturnValue([]);
    const res = await GET(makeRequest(`client_id=${FIRST_PARTY_CLIENT.id}`) as never);
    expect((await res.json()).identityProviders).toEqual([]);
  });

  test.each(["none", "whitelist"])("%s client hides social providers", async (signInPermission) => {
    findClient.mockResolvedValue({ ...FIRST_PARTY_CLIENT, signInPermission });
    const res = await GET(makeRequest(`client_id=${FIRST_PARTY_CLIENT.id}`) as never);
    expect((await res.json()).identityProviders).toEqual([]);
  });

  test("missing client hides social providers", async () => {
    const res = await GET(makeRequest() as never);
    expect((await res.json()).identityProviders).toEqual([]);
    expect(findClient).not.toHaveBeenCalled();
  });

  test("response shape is stable", async () => {
    findClient.mockResolvedValue(FIRST_PARTY_CLIENT);
    const res = await GET(makeRequest(`client_id=${FIRST_PARTY_CLIENT.id}`) as never);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual([
      "fields",
      "flow",
      "identityProviders",
      "links",
      "submitLabel",
      "supportedMethods",
      "title",
    ]);
  });
});
