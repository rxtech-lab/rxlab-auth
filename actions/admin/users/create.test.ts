import { describe, expect, test, mock, beforeEach } from "bun:test";

// Mock the database module
const mockFindFirst = mock(() => Promise.resolve(null));
const mockInsert = mock(() => ({
  values: mock(() => Promise.resolve()),
}));
let insertedUser: Record<string, unknown> | undefined;
const mockDb = {
  query: {
    users: {
      findFirst: mockFindFirst,
    },
  },
  insert: mockInsert,
};

// Mock drizzle-orm eq function
mock.module("drizzle-orm", () => ({
  eq: (field: unknown, value: unknown) => ({ field, value }),
  and: (...conditions: unknown[]) => ({ conditions }),
  not: (condition: unknown) => ({ not: condition }),
}));

// Mock the db module
mock.module("@/lib/db", () => ({
  db: mockDb,
}));

// Mock the schema module
mock.module("@/lib/db/schema", () => ({
  users: { id: "id", email: "email", username: "username" },
}));

mock.module("@/lib/admin-api/permission-targets", () => ({
  findMissingPermissionClientIds: mock(() => Promise.resolve([])),
}));

// Mock requireAdmin to always succeed
mock.module("@/lib/auth/session", () => ({
  requireAdmin: mock(() => Promise.resolve()),
}));

// Mock hashPassword
mock.module("@/lib/auth/password", () => ({
  hashPassword: mock((password: string) => Promise.resolve(`hashed_${password}`)),
}));

// Mock generateAvatarSeed
mock.module("@/lib/identicon/generate", () => ({
  generateAvatarSeed: mock(() => "test-avatar-seed"),
}));

// Mock revalidatePath
mock.module("next/cache", () => ({
  revalidatePath: mock(() => {}),
}));

// Import after mocking
const { createUser } = await import("./create");

describe("createUser", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockDb.query.users.findFirst = mock(() => Promise.resolve(null));
    insertedUser = undefined;
    mockDb.insert = mock(() => ({
      values: mock((value: Record<string, unknown>) => {
        insertedUser = value;
        return Promise.resolve();
      }),
    }));
  });

  test("should create a user successfully", async () => {
    mockDb.query.users.findFirst = mock(() => Promise.resolve(null));

    const result = await createUser({
      email: "test@example.com",
      password: "password123",
      displayName: "Test User",
      emailVerified: false,
    });

    expect(result.success).toBe(true);
    expect(result.userId).toBeDefined();
  });

  test("should return error when email already exists", async () => {
    mockDb.query.users.findFirst = mock(() =>
      Promise.resolve({
        id: "existing-user-id",
        email: "test@example.com",
      })
    );

    const result = await createUser({
      email: "test@example.com",
      password: "password123",
      emailVerified: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("A user with this email already exists");
  });

  test("should return error for invalid email", async () => {
    const result = await createUser({
      email: "invalid-email",
      password: "password123",
      emailVerified: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("email");
  });

  test("should return error for short password", async () => {
    const result = await createUser({
      email: "test@example.com",
      password: "short",
      emailVerified: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("8 characters");
  });

  test("should return error when username is already taken", async () => {
    // First call returns null (email check), second returns existing user (username check)
    let callCount = 0;
    mockDb.query.users.findFirst = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(null);
      return Promise.resolve({
        id: "existing-user-id",
        username: "existinguser",
      });
    });

    const result = await createUser({
      email: "test@example.com",
      password: "password123",
      username: "existinguser",
      emailVerified: false,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("This username is already taken");
  });

  test("should create user with emailVerified true", async () => {
    mockDb.query.users.findFirst = mock(() => Promise.resolve(null));

    const result = await createUser({
      email: "verified@example.com",
      password: "password123",
      emailVerified: true,
    });

    expect(result.success).toBe(true);
    expect(result.userId).toBeDefined();
  });

  test("should persist the OAuth client admin API permission", async () => {
    const result = await createUser({
      email: "api-reader@example.com",
      password: "password123",
      adminApiPermissions: ["read:oauth_clients:client_1,client_2"],
    });

    expect(result.success).toBe(true);
    expect(insertedUser?.adminApiPermissions).toBe(
      '["read:oauth_clients:client_1,client_2"]',
    );
  });

  test("should persist OAuth-client and user-read permissions together", async () => {
    const result = await createUser({
      email: "identity-reader@example.com",
      password: "password123",
      adminApiPermissions: ["read:oauth_clients:all", "read:user:all"],
    });

    expect(result.success).toBe(true);
    expect(insertedUser?.adminApiPermissions).toBe(
      '["read:oauth_clients:all","read:user:all"]',
    );
  });
});
