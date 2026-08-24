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
const getEnabledSocialProvidersMock = mock();

mock.module("@/lib/db", () => ({
  db: {
    query: {
      oauthClients: { findFirst: findClient },
    },
  },
}));

mock.module("@/lib/auth/social/providers", () => ({
  getEnabledSocialProviders: getEnabledSocialProvidersMock,
}));

const { GET } = await import("./route");

function makeRequest(search: string = ""): Request {
  const url = `https://auth.rxlab.app/api/auth/ui-schema/signin${search ? `?${search}` : ""}`;
  return new Request(url);
}

describe("GET /api/auth/ui-schema/signin", () => {
  beforeEach(() => {
    findClient.mockReset();
    getEnabledSocialProvidersMock.mockReset();
    getEnabledSocialProvidersMock.mockReturnValue([
      {
        id: "github",
        label: "Continue with GitHub",
        iconPath: "/brand/github-invertocat-black.svg",
        darkIconPath: "/brand/github-invertocat-white.svg",
      },
      {
        id: "google",
        label: "Continue with Google",
        iconPath: "/brand/google-g.svg",
        darkIconPath: "/brand/google-g.svg",
      },
    ]);
  });

  test("first-party client returns password + passkey methods", async () => {
    findClient.mockResolvedValue(FIRST_PARTY_CLIENT);

    const res = await GET(makeRequest(`client_id=${FIRST_PARTY_CLIENT.id}`) as never);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.flow).toBe("signin");
    expect(body.title).toBe("Sign in to macOS Test App");
    expect(body.submitLabel).toBe("Sign in");

    const methodIds = body.supportedMethods.map((m: { id: string }) => m.id);
    expect(methodIds).toEqual(["password", "passkey"]);
    expect(body.identityProviders).toEqual([
      {
        id: "github",
        label: "Continue with GitHub",
        iconUrl: "https://auth.rxlab.app/brand/github-invertocat-black.svg",
        darkIconUrl:
          "https://auth.rxlab.app/brand/github-invertocat-white.svg",
        authorizationParameters: { identity_provider: "github" },
      },
      {
        id: "google",
        label: "Continue with Google",
        iconUrl: "https://auth.rxlab.app/brand/google-g.svg",
        darkIconUrl: "https://auth.rxlab.app/brand/google-g.svg",
        authorizationParameters: { identity_provider: "google" },
      },
    ]);

    const fieldKeys = body.fields.map((f: { key: string }) => f.key);
    expect(fieldKeys).toEqual(["email", "password"]);
  });

  test("unknown client_id returns 404 invalid_client", async () => {
    findClient.mockResolvedValue(undefined);

    const res = await GET(makeRequest("client_id=ghost") as never);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("invalid_client");
  });

  test("no client_id returns default schema (no methods)", async () => {
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Sign in to RxLab");
    expect(body.supportedMethods).toEqual([]);
    expect(body.identityProviders).toEqual([]);
    // findClient must not be invoked when client_id is absent.
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
    for (const field of body.fields) {
      expect(Object.keys(field).sort()).toEqual(
        [
          "autocomplete",
          "isPassword",
          "key",
          "label",
          "placeholder",
          "required",
          "type",
          "validation",
        ].sort(),
      );
    }
  });
});
