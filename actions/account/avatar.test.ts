import { describe, expect, test, mock, beforeEach } from "bun:test";

// Mock user data
const mockUser = {
  id: "user-123",
  email: "test@example.com",
  username: "testuser",
  displayName: "Test User",
  avatarSeed: "seed-123",
  avatarUrl: null as string | null,
  emailVerified: true,
  passwordHash: "hash",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock the database module
const mockFindFirst = mock(() => Promise.resolve(mockUser));
const mockUpdate = mock(() => ({
  set: mock(() => ({
    where: mock(() => Promise.resolve()),
  })),
}));
const mockDb = {
  query: {
    users: {
      findFirst: mockFindFirst,
    },
  },
  update: mockUpdate,
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
  users: { id: "id", avatarUrl: "avatar_url", updatedAt: "updated_at" },
}));

// Mock requireAuth to always succeed
mock.module("@/lib/auth/session", () => ({
  requireAuth: mock(() => Promise.resolve({ userId: "user-123" })),
}));

// Mock blob functions
const mockDeleteImage = mock(() => Promise.resolve());
mock.module("@/lib/blob", () => ({
  deleteImage: mockDeleteImage,
}));

// Import after mocking
const { removeAvatar, getAvatarUrl } = await import("./avatar");

describe("removeAvatar", () => {
  beforeEach(() => {
    mockDb.query.users.findFirst = mock(() =>
      Promise.resolve({ ...mockUser, avatarUrl: "https://blob.vercel-storage.com/avatars/avatar.webp" })
    );
    mockDb.update = mock(() => ({
      set: mock(() => ({
        where: mock(() => Promise.resolve()),
      })),
    }));
    mockDeleteImage.mockImplementation(() => Promise.resolve());
  });

  test("should remove avatar successfully", async () => {
    const result = await removeAvatar();

    expect(result.success).toBe(true);
    expect(mockDeleteImage).toHaveBeenCalled();
  });

  test("should clear DB before deleting blob (safe ordering)", async () => {
    const callOrder: string[] = [];
    mockDb.update = mock(() => {
      callOrder.push("db_update");
      return {
        set: mock(() => ({
          where: mock(() => Promise.resolve()),
        })),
      };
    });
    mockDeleteImage.mockImplementation(() => {
      callOrder.push("blob_delete");
      return Promise.resolve();
    });

    await removeAvatar();

    expect(callOrder[0]).toBe("db_update");
    expect(callOrder[1]).toBe("blob_delete");
  });

  test("should succeed even when user has no avatar", async () => {
    mockDb.query.users.findFirst = mock(() =>
      Promise.resolve({ ...mockUser, avatarUrl: null })
    );

    const result = await removeAvatar();

    expect(result.success).toBe(true);
  });

  test("should return error when user not found", async () => {
    mockDb.query.users.findFirst = mock(() => Promise.resolve(null));

    const result = await removeAvatar();

    expect(result.success).toBe(false);
    expect(result.error).toBe("User not found");
  });
});

describe("getAvatarUrl", () => {
  beforeEach(() => {
    mockDb.query.users.findFirst = mock(() =>
      Promise.resolve({ ...mockUser, avatarUrl: "https://blob.vercel-storage.com/avatars/avatar.webp" })
    );
  });

  test("should return avatar URL when set", async () => {
    const result = await getAvatarUrl();

    expect(result.success).toBe(true);
    expect(result.avatarUrl).toBe("https://blob.vercel-storage.com/avatars/avatar.webp");
  });

  test("should return null avatar URL when not set", async () => {
    mockDb.query.users.findFirst = mock(() =>
      Promise.resolve({ ...mockUser, avatarUrl: null })
    );

    const result = await getAvatarUrl();

    expect(result.success).toBe(true);
    expect(result.avatarUrl).toBeNull();
  });

  test("should return error when user not found", async () => {
    mockDb.query.users.findFirst = mock(() => Promise.resolve(null));

    const result = await getAvatarUrl();

    expect(result.success).toBe(false);
    expect(result.error).toBe("User not found");
  });
});
