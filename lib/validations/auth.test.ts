import { describe, expect, test } from "bun:test";
import { registerSchema } from "./auth";

describe("registerSchema", () => {
  test("should accept valid registration with matching passwords", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      confirmPassword: "password123",
      displayName: "Test User",
    });

    expect(result.success).toBe(true);
  });

  test("should accept valid registration without display name", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      confirmPassword: "password123",
    });

    expect(result.success).toBe(true);
  });

  test("should reject when passwords do not match", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      confirmPassword: "different456",
      displayName: "Test User",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmPasswordError = result.error.issues.find(
        (issue) => issue.path.includes("confirmPassword")
      );
      expect(confirmPasswordError).toBeDefined();
      expect(confirmPasswordError!.message).toBe("Passwords do not match");
    }
  });

  test("should reject when confirmPassword is missing", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "password123",
      displayName: "Test User",
    });

    expect(result.success).toBe(false);
  });

  test("should reject when password is too short", () => {
    const result = registerSchema.safeParse({
      email: "test@example.com",
      password: "short",
      confirmPassword: "short",
    });

    expect(result.success).toBe(false);
  });
});
