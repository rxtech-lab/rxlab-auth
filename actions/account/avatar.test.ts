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
const mockUploadImage = mock(() =>
  Promise.resolve({ url: "https://blob.vercel-storage.com/avatars/new-avatar.png", pathname: "avatars/new-avatar.png" })
);
const mockDeleteImage = mock(() => Promise.resolve());
mock.module("@/lib/blob", () => ({
  uploadImage: mockUploadImage,
  deleteImage: mockDeleteImage,
}));

// Import after mocking
const { uploadAvatar, removeAvatar } = await import("./avatar");

describe("uploadAvatar", () => {
  beforeEach(() => {
    mockDb.query.users.findFirst = mock(() => Promise.resolve({ ...mockUser, avatarUrl: null }));
    mockDb.update = mock(() => ({
      set: mock(() => ({
        where: mock(() => Promise.resolve()),
      })),
    }));
    mockUploadImage.mockImplementation(() =>
      Promise.resolve({ url: "https://blob.vercel-storage.com/avatars/new-avatar.png", pathname: "avatars/new-avatar.png" })
    );
    mockDeleteImage.mockImplementation(() => Promise.resolve());
  });

  test("should upload avatar successfully", async () => {
    const formData = new FormData();
    const file = new File(["fake-image-data"], "avatar.png", { type: "image/png" });
    formData.append("avatar", file);

    const result = await uploadAvatar(formData);

    expect(result.success).toBe(true);
    expect(result.avatarUrl).toBe("https://blob.vercel-storage.com/avatars/new-avatar.png");
  });

  test("should return error when no file provided", async () => {
    const formData = new FormData();

    const result = await uploadAvatar(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("No file provided");
  });

  test("should return error for invalid file type", async () => {
    const formData = new FormData();
    const file = new File(["fake-data"], "doc.pdf", { type: "application/pdf" });
    formData.append("avatar", file);

    const result = await uploadAvatar(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid file type");
  });

  test("should return error for file too large", async () => {
    const formData = new FormData();
    // Create a file larger than 2MB
    const largeContent = new Uint8Array(3 * 1024 * 1024);
    const file = new File([largeContent], "large.png", { type: "image/png" });
    formData.append("avatar", file);

    const result = await uploadAvatar(formData);

    expect(result.success).toBe(false);
    expect(result.error).toContain("too large");
  });

  test("should delete old avatar when uploading new one", async () => {
    mockDb.query.users.findFirst = mock(() =>
      Promise.resolve({ ...mockUser, avatarUrl: "https://blob.vercel-storage.com/avatars/old-avatar.png" })
    );

    const formData = new FormData();
    const file = new File(["fake-image-data"], "avatar.png", { type: "image/png" });
    formData.append("avatar", file);

    const result = await uploadAvatar(formData);

    expect(result.success).toBe(true);
    expect(mockDeleteImage).toHaveBeenCalled();
  });

  test("should return error when user not found", async () => {
    mockDb.query.users.findFirst = mock(() => Promise.resolve(null));

    const formData = new FormData();
    const file = new File(["fake-image-data"], "avatar.png", { type: "image/png" });
    formData.append("avatar", file);

    const result = await uploadAvatar(formData);

    expect(result.success).toBe(false);
    expect(result.error).toBe("User not found");
  });
});

describe("removeAvatar", () => {
  beforeEach(() => {
    mockDb.query.users.findFirst = mock(() =>
      Promise.resolve({ ...mockUser, avatarUrl: "https://blob.vercel-storage.com/avatars/avatar.png" })
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
