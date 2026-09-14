import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createPendingSocialSignin,
  verifyPendingSocialSignin,
} from "./pending";

const originalSecret = process.env.SESSION_SECRET;

beforeAll(() => {
  process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
});

afterAll(() => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
});

describe("pending social sign-in", () => {
  test("round-trips account-connection consent", async () => {
    const token = await createPendingSocialSignin({
      kind: "connect",
      userId: "existing-user",
      profile: {
        provider: "github",
        providerAccountId: "github-account",
        email: "person@example.com",
        name: "Person Example",
        avatarUrl: "https://example.com/avatar.png",
      },
      redirectTo: "/account/apps",
    });

    await expect(verifyPendingSocialSignin(token)).resolves.toEqual({
      kind: "connect",
      userId: "existing-user",
      profile: {
        provider: "github",
        providerAccountId: "github-account",
        email: "person@example.com",
        name: "Person Example",
        avatarUrl: "https://example.com/avatar.png",
      },
      redirectTo: "/account/apps",
    });
  });

  test("round-trips account-creation consent and sanitizes redirects", async () => {
    const token = await createPendingSocialSignin({
      kind: "create",
      profile: {
        provider: "google",
        providerAccountId: "google-account",
        email: "new@example.com",
        name: null,
        avatarUrl: null,
      },
      redirectTo: "https://evil.example/callback",
    });

    await expect(verifyPendingSocialSignin(token)).resolves.toMatchObject({
      kind: "create",
      redirectTo: "/account",
    });
  });

  test("rejects a modified token", async () => {
    const token = await createPendingSocialSignin({
      kind: "create",
      profile: {
        provider: "google",
        providerAccountId: "google-account",
        email: "new@example.com",
        name: null,
        avatarUrl: null,
      },
      redirectTo: "/account",
    });

    // Tamper with the payload rather than the signature's last character: the
    // final base64url character carries unused bits, so flipping it sometimes
    // decodes to the very same signature bytes and the token still verifies.
    // Any payload edit invalidates the signature deterministically.
    const [header, payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, "base64url").toString()),
        redirectTo: "/somewhere-else",
      }),
    ).toString("base64url");

    await expect(
      verifyPendingSocialSignin(`${header}.${tamperedPayload}.${signature}`),
    ).rejects.toThrow();
  });
});
