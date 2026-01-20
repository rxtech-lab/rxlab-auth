import { describe, expect, test, mock, beforeEach } from "bun:test";

// Mock the database module
const mockFindFirst = mock(() => Promise.resolve(null));
const mockDb = {
  query: {
    appSettings: {
      findFirst: mockFindFirst,
    },
    emailWhitelist: {
      findFirst: mock(() => Promise.resolve(null)),
    },
  },
};

// Mock drizzle-orm eq function
mock.module("drizzle-orm", () => ({
  eq: (field: unknown, value: unknown) => ({ field, value }),
}));

// Mock the db module
mock.module("@/lib/db", () => ({
  db: mockDb,
}));

// Mock the schema module
mock.module("@/lib/db/schema", () => ({
  appSettings: { id: "id" },
  emailWhitelist: { email: "email" },
}));

// Import after mocking
const { checkSignUpAllowed } = await import("./sign-up");

describe("checkSignUpAllowed", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockDb.query.appSettings.findFirst = mock(() => Promise.resolve(null));
    mockDb.query.emailWhitelist.findFirst = mock(() => Promise.resolve(null));
  });

  test("should allow sign-up by default when no settings exist", async () => {
    mockDb.query.appSettings.findFirst = mock(() => Promise.resolve(null));

    const result = await checkSignUpAllowed("test@example.com");

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("should block sign-up when disabled and whitelist not enabled", async () => {
    mockDb.query.appSettings.findFirst = mock(() =>
      Promise.resolve({
        id: "global",
        signUpEnabled: false,
        signUpWhitelistEnabled: false,
        updatedAt: new Date(),
      })
    );

    const result = await checkSignUpAllowed("test@example.com");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("disabled");
  });

  test("should allow sign-up when enabled and whitelist disabled", async () => {
    mockDb.query.appSettings.findFirst = mock(() =>
      Promise.resolve({
        id: "global",
        signUpEnabled: true,
        signUpWhitelistEnabled: false,
        updatedAt: new Date(),
      })
    );

    const result = await checkSignUpAllowed("test@example.com");

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("should block non-whitelisted email when whitelist enabled", async () => {
    mockDb.query.appSettings.findFirst = mock(() =>
      Promise.resolve({
        id: "global",
        signUpEnabled: true,
        signUpWhitelistEnabled: true,
        updatedAt: new Date(),
      })
    );
    mockDb.query.emailWhitelist.findFirst = mock(() => Promise.resolve(null));

    const result = await checkSignUpAllowed("notwhitelisted@example.com");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("not_whitelisted");
  });

  test("should allow whitelisted email when whitelist enabled", async () => {
    mockDb.query.appSettings.findFirst = mock(() =>
      Promise.resolve({
        id: "global",
        signUpEnabled: true,
        signUpWhitelistEnabled: true,
        updatedAt: new Date(),
      })
    );
    mockDb.query.emailWhitelist.findFirst = mock(() =>
      Promise.resolve({
        id: "123",
        email: "whitelisted@example.com",
        createdAt: new Date(),
      })
    );

    const result = await checkSignUpAllowed("whitelisted@example.com");

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("should allow whitelisted email even when sign-up is disabled", async () => {
    mockDb.query.appSettings.findFirst = mock(() =>
      Promise.resolve({
        id: "global",
        signUpEnabled: false,
        signUpWhitelistEnabled: true,
        updatedAt: new Date(),
      })
    );
    mockDb.query.emailWhitelist.findFirst = mock(() =>
      Promise.resolve({
        id: "123",
        email: "whitelisted@example.com",
        createdAt: new Date(),
      })
    );

    const result = await checkSignUpAllowed("whitelisted@example.com");

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("should block non-whitelisted email when sign-up disabled and whitelist enabled", async () => {
    mockDb.query.appSettings.findFirst = mock(() =>
      Promise.resolve({
        id: "global",
        signUpEnabled: false,
        signUpWhitelistEnabled: true,
        updatedAt: new Date(),
      })
    );
    mockDb.query.emailWhitelist.findFirst = mock(() => Promise.resolve(null));

    const result = await checkSignUpAllowed("notwhitelisted@example.com");

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("not_whitelisted");
  });
});
