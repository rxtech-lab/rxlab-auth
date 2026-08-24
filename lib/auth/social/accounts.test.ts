import { describe, expect, test } from "bun:test";
import { getOAuthClientIdFromRedirect } from "./oauth-context";

describe("getOAuthClientIdFromRedirect", () => {
  test("reads the client ID only from the RxLab authorization path", () => {
    expect(
      getOAuthClientIdFromRedirect(
        "/api/oauth/authorize?client_id=macos-app&scope=openid",
      ),
    ).toBe("macos-app");
    expect(getOAuthClientIdFromRedirect("/account?client_id=macos-app")).toBe(
      undefined,
    );
    expect(
      getOAuthClientIdFromRedirect(
        "https://evil.example/api/oauth/authorize?client_id=macos-app",
      ),
    ).toBe(undefined);
  });
});
