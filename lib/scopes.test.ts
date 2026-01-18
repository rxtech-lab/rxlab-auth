import { describe, expect, test } from "bun:test";
import {
  SCOPES,
  SCOPE_RESOURCES,
  SPECIAL_SCOPES,
  SUPPORTED_SCOPES,
  OPERATIONS,
  getScope,
  getScopesByResource,
  getSpecialScopes,
  getResourceScopes,
} from "./scopes";

describe("SCOPE_RESOURCES", () => {
  test("should have at least one resource", () => {
    expect(SCOPE_RESOURCES.length).toBeGreaterThan(0);
  });

  test("each resource should have required fields", () => {
    for (const resource of SCOPE_RESOURCES) {
      expect(resource.key).toBeDefined();
      expect(resource.key.length).toBeGreaterThan(0);
      expect(resource.title).toBeDefined();
      expect(resource.subtitle).toBeDefined();
      expect(resource.icon).toBeDefined();
      expect(resource.operations.length).toBeGreaterThan(0);
    }
  });

  test("should have unique keys", () => {
    const keys = SCOPE_RESOURCES.map((r) => r.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  test("operations should be valid", () => {
    const validOperations = Object.keys(OPERATIONS);
    for (const resource of SCOPE_RESOURCES) {
      for (const op of resource.operations) {
        expect(validOperations).toContain(op);
      }
    }
  });
});

describe("SPECIAL_SCOPES", () => {
  test("should have openid as a required scope", () => {
    const openid = SPECIAL_SCOPES.find((s) => s.key === "openid");
    expect(openid).toBeDefined();
    expect(openid?.required).toBe(true);
  });

  test("should contain expected special scopes", () => {
    const keys = SPECIAL_SCOPES.map((s) => s.key);
    expect(keys).toContain("openid");
    expect(keys).toContain("offline_access");
  });
});

describe("SCOPES (generated)", () => {
  test("should generate scopes from resources and special scopes", () => {
    expect(SCOPES.length).toBeGreaterThan(0);
  });

  test("should contain special scopes", () => {
    const keys = SCOPES.map((s) => s.key);
    expect(keys).toContain("openid");
    expect(keys).toContain("offline_access");
  });

  test("should contain resource scopes with operation:resource format", () => {
    const keys = SCOPES.map((s) => s.key);
    expect(keys).toContain("read:profile");
    expect(keys).toContain("write:profile");
    expect(keys).toContain("read:email");
  });

  test("resource scopes should have resource and operation fields", () => {
    const resourceScopes = SCOPES.filter((s) => s.key.includes(":"));
    for (const scope of resourceScopes) {
      expect(scope.resource).toBeDefined();
      expect(scope.operation).toBeDefined();
    }
  });

  test("special scopes should not have resource or operation fields", () => {
    const specialScopes = SCOPES.filter((s) => !s.key.includes(":"));
    for (const scope of specialScopes) {
      expect(scope.resource).toBeUndefined();
      expect(scope.operation).toBeUndefined();
    }
  });
});

describe("SUPPORTED_SCOPES", () => {
  test("should be derived from SCOPES", () => {
    expect(SUPPORTED_SCOPES).toEqual(SCOPES.map((s) => s.key));
  });

  test("should be a non-empty tuple", () => {
    expect(SUPPORTED_SCOPES.length).toBeGreaterThan(0);
  });
});

describe("getScope", () => {
  test("should return scope for valid key", () => {
    const scope = getScope("openid");
    expect(scope).toBeDefined();
    expect(scope?.key).toBe("openid");
  });

  test("should return resource scope for operation:resource format", () => {
    const scope = getScope("read:profile");
    expect(scope).toBeDefined();
    expect(scope?.key).toBe("read:profile");
    expect(scope?.resource).toBe("profile");
    expect(scope?.operation).toBe("read");
  });

  test("should return undefined for invalid key", () => {
    const scope = getScope("invalid_scope");
    expect(scope).toBeUndefined();
  });
});

describe("getScopesByResource", () => {
  test("should return all scopes for a resource", () => {
    const profileScopes = getScopesByResource("profile");
    expect(profileScopes.length).toBe(2);
    expect(profileScopes.map((s) => s.key)).toContain("read:profile");
    expect(profileScopes.map((s) => s.key)).toContain("write:profile");
  });

  test("should return empty array for unknown resource", () => {
    const scopes = getScopesByResource("unknown");
    expect(scopes).toEqual([]);
  });
});

describe("getSpecialScopes", () => {
  test("should return only special scopes", () => {
    const special = getSpecialScopes();
    for (const scope of special) {
      expect(scope.resource).toBeUndefined();
    }
    expect(special.map((s) => s.key)).toContain("openid");
  });
});

describe("getResourceScopes", () => {
  test("should return only resource scopes", () => {
    const resourceScopes = getResourceScopes();
    for (const scope of resourceScopes) {
      expect(scope.resource).toBeDefined();
      expect(scope.operation).toBeDefined();
    }
  });
});
