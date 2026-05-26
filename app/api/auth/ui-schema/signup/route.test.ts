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

  test("response shape is stable", async () => {
    findClient.mockResolvedValue(FIRST_PARTY_CLIENT);
    const res = await GET(makeRequest(`client_id=${FIRST_PARTY_CLIENT.id}`) as never);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual([
      "fields",
      "flow",
      "links",
      "submitLabel",
      "supportedMethods",
      "title",
    ]);
  });
});
