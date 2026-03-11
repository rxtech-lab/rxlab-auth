import { describe, expect, test, mock, beforeEach } from "bun:test";

// Track calls for verification
const mockDestroySession = mock(() => Promise.resolve());
const mockRedirect = mock((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

// Mock modules
mock.module("@/lib/auth/session", () => ({
  destroySession: mockDestroySession,
}));

mock.module("next/navigation", () => ({
  redirect: mockRedirect,
}));

// Import after mocking
const { switchAccount } = await import("./account-select");

describe("switchAccount", () => {
  beforeEach(() => {
    mockDestroySession.mockClear();
    mockRedirect.mockClear();
    mockDestroySession.mockImplementation(() => Promise.resolve());
    mockRedirect.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });
  });

  test("should destroy session and redirect to login with OAuth params", async () => {
    const oauthParams = {
      client_id: "test-client",
      redirect_uri: "http://localhost:3001/callback",
      response_type: "code",
      scope: "openid profile",
      state: "test-state",
      code_challenge: "challenge123",
      code_challenge_method: "S256",
    };

    try {
      await switchAccount(oauthParams);
    } catch (e: unknown) {
      // redirect throws
      expect((e as Error).message).toContain("REDIRECT:");
    }

    expect(mockDestroySession).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalled();

    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl).toContain("/login?redirect=");
    expect(redirectUrl).toContain("/api/oauth/authorize");
    expect(redirectUrl).toContain("client_id=test-client");
    expect(redirectUrl).toContain("scope=openid+profile");
  });

  test("should handle params without optional state", async () => {
    const oauthParams = {
      client_id: "test-client",
      redirect_uri: "http://localhost:3001/callback",
      response_type: "code",
      scope: "openid",
      code_challenge: "challenge123",
      code_challenge_method: "S256",
    };

    try {
      await switchAccount(oauthParams);
    } catch {
      // redirect throws
    }

    expect(mockDestroySession).toHaveBeenCalled();

    const redirectUrl = mockRedirect.mock.calls[0][0];
    expect(redirectUrl).not.toContain("state=");
    expect(redirectUrl).toContain("client_id=test-client");
  });

  test("should call destroySession before redirect", async () => {
    const callOrder: string[] = [];

    mockDestroySession.mockImplementation(() => {
      callOrder.push("destroySession");
      return Promise.resolve();
    });

    mockRedirect.mockImplementation(() => {
      callOrder.push("redirect");
      throw new Error("REDIRECT");
    });

    try {
      await switchAccount({ client_id: "test" });
    } catch {
      // redirect throws
    }

    expect(callOrder[0]).toBe("destroySession");
    expect(callOrder[1]).toBe("redirect");
  });
});
