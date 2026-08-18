import { describe, expect, test } from "bun:test";
import {
  buildReadOAuthClientsPermissions,
  buildReadUsersPermissions,
  getReadOAuthClientsAccess,
  getReadOAuthClientsSelection,
  isReadOAuthClientsPermission,
  getReadUsersPermissionEnabled,
  hasReadUsersPermission,
  isSupportedAdminApiPermission,
  parseStoredAdminApiPermissions,
} from "./permissions";

describe("OAuth client admin API permissions", () => {
  test("recognizes an all-clients permission", () => {
    expect(getReadOAuthClientsAccess(["read:oauth_clients:all"])).toEqual({
      scope: "all",
      clientIds: [],
    });
  });

  test("unions and deduplicates selected client permissions", () => {
    expect(
      getReadOAuthClientsAccess([
        "read:oauth_clients:client_2,client_1",
        "read:oauth_clients:client_2",
      ]),
    ).toEqual({
      scope: "selected",
      clientIds: ["client_2", "client_1"],
    });
  });

  test("ignores malformed stored JSON", () => {
    expect(parseStoredAdminApiPermissions("not-json")).toEqual([]);
    expect(parseStoredAdminApiPermissions('{"permission":"all"}')).toEqual(
      [],
    );
  });

  test("builds a canonical selected-clients permission", () => {
    expect(
      buildReadOAuthClientsPermissions({
        enabled: true,
        scope: "selected",
        clientIds: ["client_2", "client_1", "client_2"],
      }),
    ).toEqual(["read:oauth_clients:client_1,client_2"]);
  });

  test("maps stored permissions to the user form selection", () => {
    expect(
      getReadOAuthClientsSelection(
        JSON.stringify(["read:oauth_clients:client_1,client_2"]),
      ),
    ).toEqual({
      enabled: true,
      scope: "selected",
      clientIds: ["client_1", "client_2"],
    });
  });

  test("validates only supported permission values", () => {
    expect(isReadOAuthClientsPermission("read:oauth_clients:all")).toBe(true);
    expect(
      isReadOAuthClientsPermission("read:oauth_clients:client_1,client_2"),
    ).toBe(true);
    expect(isReadOAuthClientsPermission("write:oauth_clients:all")).toBe(false);
    expect(isReadOAuthClientsPermission("read:oauth_clients:")).toBe(false);
  });
});

describe("user admin API permission", () => {
  test("matches only the exact read:user:all permission", () => {
    expect(hasReadUsersPermission(["read:user:all"])).toBe(true);
    expect(hasReadUsersPermission(["read:user:user_1"])).toBe(false);
    expect(hasReadUsersPermission(["read:users:all"])).toBe(false);
  });

  test("maps stored permission state and builds its canonical value", () => {
    expect(
      getReadUsersPermissionEnabled(JSON.stringify(["read:user:all"])),
    ).toBe(true);
    expect(buildReadUsersPermissions(true)).toEqual(["read:user:all"]);
    expect(buildReadUsersPermissions(false)).toEqual([]);
  });

  test("is included in the supported admin API permission set", () => {
    expect(isSupportedAdminApiPermission("read:user:all")).toBe(true);
    expect(isSupportedAdminApiPermission("read:user:user_1")).toBe(false);
  });
});
