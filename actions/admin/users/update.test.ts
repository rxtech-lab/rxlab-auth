import { describe, expect, test, mock, beforeEach } from "bun:test";

// Mock user data
const mockExistingUser = {
  id: "user-123",
  email: "existing@example.com",
  username: "existinguser",
  displayName: "Existing User",
  emailVerified: false,
  passwordHash: "old_hash",
  avatarSeed: "avatar-seed",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock the database module
const mockFindFirst = mock(() => Promise.resolve(mockExistingUser));
const mockUpdate = mock(() => ({
  set: mock(() => ({
    where: mock(() => Promise.resolve()),
  })),
}));
let updatedUserData: Record<string, unknown> | undefined;
const mockDb = {
  query: {
    users: {
      findFirst: mockFindFirst,
    },
  },
  update: mockUpdate,
};

// Mock drizzle-orm functions
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

// Mock revalidatePath
mock.module("next/cache", () => ({
  revalidatePath: mock(() => {}),
}));

// Import after mocking
const { updateUser } = await import("./update");

describe("updateUser", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockDb.query.users.findFirst = mock(() => Promise.resolve(mockExistingUser));
    updatedUserData = undefined;
    mockDb.update = mock(() => ({
      set: mock((value: Record<string, unknown>) => {
        updatedUserData = value;
        return {
          where: mock(() => Promise.resolve()),
        };
      }),
    }));
  });

  test("should update user email successfully", async () => {
    // First call: find user by ID
    // Second call: check if new email is taken (null means not taken)
    // Third call: return updated user
    let callCount = 0;
    mockDb.query.users.findFirst = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockExistingUser);
      if (callCount === 2) return Promise.resolve(null); // Email not taken
      return Promise.resolve({ ...mockExistingUser, email: "newemail@example.com" });
    });

    const result = await updateUser("user-123", {
      email: "newemail@example.com",
    });

    expect(result.success).toBe(true);
    expect(result.user?.email).toBe("newemail@example.com");
  });

  test("should return error when user not found", async () => {
    mockDb.query.users.findFirst = mock(() => Promise.resolve(null));

    const result = await updateUser("nonexistent-user", {
      displayName: "New Name",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("User not found");
  });

  test("should return error when new email is already in use", async () => {
    let callCount = 0;
    mockDb.query.users.findFirst = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockExistingUser);
      return Promise.resolve({
        id: "other-user-id",
        email: "taken@example.com",
      });
    });

    const result = await updateUser("user-123", {
      email: "taken@example.com",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("This email is already in use by another user");
  });

  test("should return error when new username is already taken", async () => {
    let callCount = 0;
    mockDb.query.users.findFirst = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockExistingUser);
      return Promise.resolve({
        id: "other-user-id",
        username: "takenusername",
      });
    });

    const result = await updateUser("user-123", {
      username: "takenusername",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("This username is already taken");
  });

  test("should update password when provided", async () => {
    let callCount = 0;
    mockDb.query.users.findFirst = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockExistingUser);
      return Promise.resolve({ ...mockExistingUser, passwordHash: "hashed_newpassword123" });
    });

    const result = await updateUser("user-123", {
      password: "newpassword123",
    });

    expect(result.success).toBe(true);
  });

  test("should update emailVerified status", async () => {
    let callCount = 0;
    mockDb.query.users.findFirst = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockExistingUser);
      return Promise.resolve({ ...mockExistingUser, emailVerified: true });
    });

    const result = await updateUser("user-123", {
      emailVerified: true,
    });

    expect(result.success).toBe(true);
    expect(result.user?.emailVerified).toBe(true);
  });

  test("should return error for invalid email format", async () => {
    const result = await updateUser("user-123", {
      email: "invalid-email",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("email");
  });

  test("should return error for invalid username format", async () => {
    const result = await updateUser("user-123", {
      username: "invalid username!",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("letters, numbers, and underscores");
  });

  test("should persist the OAuth client admin API permission", async () => {
    const result = await updateUser("user-123", {
      adminApiPermissions: ["read:oauth_clients:all"],
    });

    expect(result.success).toBe(true);
    expect(updatedUserData?.adminApiPermissions).toBe(
      '["read:oauth_clients:all"]',
    );
  });
});
