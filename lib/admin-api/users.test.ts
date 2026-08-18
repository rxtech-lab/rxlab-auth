import { describe, expect, test } from "bun:test";
import { buildAdminUserSummary } from "./users";

describe("buildAdminUserSummary", () => {
  test("returns only the allowlisted identity-selection fields", () => {
    const databaseUser = {
      id: "user_123",
      email: "reader@example.com",
      displayName: "Reader",
      avatarSeed: "seed_123",
      avatarUrl: null,
      passwordHash: "must-not-leak",
      adminApiPermissions: '["read:user:all"]',
    };

    const result = buildAdminUserSummary(
      databaseUser,
      "https://auth.rxlab.app/",
    );

    expect(result).toEqual({
      id: "user_123",
      sub: "user_123",
      name: "Reader",
      email: "reader@example.com",
      image: "https://auth.rxlab.app/api/avatar/seed_123",
    });
    expect(Object.keys(result).sort()).toEqual(
      ["email", "id", "image", "name", "sub"].sort(),
    );
  });

  test("prefers an uploaded profile image", () => {
    const result = buildAdminUserSummary(
      {
        id: "user_123",
        email: "reader@example.com",
        displayName: null,
        avatarSeed: null,
        avatarUrl: "https://cdn.example.com/avatar.png",
      },
      "https://auth.rxlab.app",
    );

    expect(result.name).toBeNull();
    expect(result.image).toBe("https://cdn.example.com/avatar.png");
  });
});
