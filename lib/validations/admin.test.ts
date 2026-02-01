import { describe, expect, test } from "bun:test";
import { createUserSchema, updateUserSchema } from "./admin";

describe("createUserSchema", () => {
  test("should accept valid user with all fields", () => {
    const result = createUserSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      displayName: "Test User",
      username: "testuser",
      emailVerified: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("test@example.com");
      expect(result.data.password).toBe("password123");
      expect(result.data.displayName).toBe("Test User");
      expect(result.data.username).toBe("testuser");
      expect(result.data.emailVerified).toBe(true);
    }
  });

  test("should accept valid user with minimal required fields", () => {
    const result = createUserSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.emailVerified).toBe(false); // default value
    }
  });

  test("should reject invalid email", () => {
    const result = createUserSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  test("should reject password shorter than 8 characters", () => {
    const result = createUserSchema.safeParse({
      email: "test@example.com",
      password: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("8 characters");
    }
  });

  test("should reject username with invalid characters", () => {
    const result = createUserSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      username: "user@name",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("letters, numbers, and underscores");
    }
  });

  test("should accept username with underscores", () => {
    const result = createUserSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      username: "test_user_123",
    });

    expect(result.success).toBe(true);
  });

  test("should accept null username", () => {
    const result = createUserSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      username: null,
    });

    expect(result.success).toBe(true);
  });
});

describe("updateUserSchema", () => {
  test("should accept valid update with all fields", () => {
    const result = updateUserSchema.safeParse({
      email: "newemail@example.com",
      password: "newpassword123",
      displayName: "New Name",
      username: "newusername",
      emailVerified: true,
    });

    expect(result.success).toBe(true);
  });

  test("should accept update with only email", () => {
    const result = updateUserSchema.safeParse({
      email: "newemail@example.com",
    });

    expect(result.success).toBe(true);
  });

  test("should accept update with only password", () => {
    const result = updateUserSchema.safeParse({
      password: "newpassword123",
    });

    expect(result.success).toBe(true);
  });

  test("should accept empty update object", () => {
    const result = updateUserSchema.safeParse({});

    expect(result.success).toBe(true);
  });

  test("should accept null password to keep existing", () => {
    const result = updateUserSchema.safeParse({
      email: "test@example.com",
      password: null,
    });

    expect(result.success).toBe(true);
  });

  test("should reject password shorter than 8 characters when provided", () => {
    const result = updateUserSchema.safeParse({
      password: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("8 characters");
    }
  });

  test("should reject invalid email when provided", () => {
    const result = updateUserSchema.safeParse({
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  test("should reject username with invalid characters when provided", () => {
    const result = updateUserSchema.safeParse({
      username: "user@name!",
    });

    expect(result.success).toBe(false);
  });

  test("should accept null displayName to clear it", () => {
    const result = updateUserSchema.safeParse({
      displayName: null,
    });

    expect(result.success).toBe(true);
  });

  test("should accept null username to clear it", () => {
    const result = updateUserSchema.safeParse({
      username: null,
    });

    expect(result.success).toBe(true);
  });
});
