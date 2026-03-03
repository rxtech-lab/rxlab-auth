import { describe, expect, test, mock, beforeEach } from "bun:test";

// Mock data
const mockClients = Array.from({ length: 5 }, (_, i) => ({
  id: `client-${i + 1}`,
  clientType: "confidential" as const,
  secret: `hashed-secret-${i + 1}`,
  name: `Client ${i + 1}`,
  description: `Description ${i + 1}`,
  iconUrl: null,
  redirectUris: JSON.stringify(["http://localhost:3000/callback"]),
  allowedScopes: JSON.stringify(["openid", "profile"]),
  isFirstParty: false,
  signInPermission: "all" as const,
  permissions: null,
  createdAt: new Date(2024, 0, i + 1),
  updatedAt: new Date(2024, 0, i + 1),
}));

// Mock select chain
let mockSelectResult = mockClients;
let mockCountResult = [{ count: 5 }];

const mockOffset = mock((n: number) => mockSelectResult);
const mockLimit = mock((n: number) => ({ offset: mockOffset }));
const mockOrderBy = mock((...args: unknown[]) => ({ limit: mockLimit }));
const mockCountWhere = mock(() => mockCountResult);
const mockCountFrom = mock(() => mockCountResult);
const mockSelectFrom = mock(() => ({
  orderBy: mockOrderBy,
  where: mockCountWhere,
}));

const mockDb = {
  select: mock((fields?: unknown) => {
    if (fields) {
      // count query
      return { from: mock(() => mockCountResult) };
    }
    // data query
    return { from: mockSelectFrom };
  }),
};

// Mock drizzle-orm
mock.module("drizzle-orm", () => ({
  desc: (field: unknown) => ({ field, direction: "desc" }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
    { raw: (s: string) => s }
  ),
}));

// Mock the db module
mock.module("@/lib/db", () => ({
  db: mockDb,
}));

// Mock the schema module
mock.module("@/lib/db/schema", () => ({
  oauthClients: {
    id: "id",
    name: "name",
    createdAt: "created_at",
  },
}));

// Mock requireAdmin to always succeed
mock.module("@/lib/auth/session", () => ({
  requireAdmin: mock(() => Promise.resolve()),
}));

// Import after mocking
const { getClients } = await import("./list");

describe("getClients", () => {
  beforeEach(() => {
    // Reset to default mock data
    mockSelectResult = mockClients;
    mockCountResult = [{ count: 5 }];

    // Recreate the mock chain
    mockDb.select = mock((fields?: unknown) => {
      if (fields) {
        return { from: mock(() => mockCountResult) };
      }
      return {
        from: mock(() => ({
          orderBy: mock(() => ({
            limit: mock(() => ({
              offset: mock(() => mockSelectResult),
            })),
          })),
        })),
      };
    });
  });

  test("should return first page of clients with defaults", async () => {
    const result = await getClients();

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.page).toBe(1);
    expect(result.data!.pageSize).toBe(20);
    expect(result.data!.totalCount).toBe(5);
    expect(result.data!.totalPages).toBe(1);
    expect(result.data!.clients).toEqual(mockClients);
  });

  test("should respect page parameter", async () => {
    const result = await getClients({ page: 2 });

    expect(result.success).toBe(true);
    expect(result.data!.page).toBe(2);
  });

  test("should respect pageSize parameter", async () => {
    const result = await getClients({ pageSize: 10 });

    expect(result.success).toBe(true);
    expect(result.data!.pageSize).toBe(10);
  });

  test("should clamp page to minimum of 1", async () => {
    const result = await getClients({ page: -5 });

    expect(result.success).toBe(true);
    expect(result.data!.page).toBe(1);
  });

  test("should clamp pageSize to maximum of 100", async () => {
    const result = await getClients({ pageSize: 200 });

    expect(result.success).toBe(true);
    expect(result.data!.pageSize).toBe(100);
  });

  test("should clamp pageSize to minimum of 1", async () => {
    const result = await getClients({ pageSize: 0 });

    expect(result.success).toBe(true);
    expect(result.data!.pageSize).toBe(1);
  });

  test("should calculate totalPages correctly", async () => {
    mockCountResult = [{ count: 45 }];
    mockDb.select = mock((fields?: unknown) => {
      if (fields) {
        return { from: mock(() => mockCountResult) };
      }
      return {
        from: mock(() => ({
          orderBy: mock(() => ({
            limit: mock(() => ({
              offset: mock(() => mockSelectResult),
            })),
          })),
        })),
      };
    });

    const result = await getClients({ pageSize: 20 });

    expect(result.success).toBe(true);
    expect(result.data!.totalPages).toBe(3); // ceil(45/20) = 3
  });

  test("should return totalPages of 1 when no clients exist", async () => {
    mockCountResult = [{ count: 0 }];
    mockSelectResult = [];
    mockDb.select = mock((fields?: unknown) => {
      if (fields) {
        return { from: mock(() => mockCountResult) };
      }
      return {
        from: mock(() => ({
          orderBy: mock(() => ({
            limit: mock(() => ({
              offset: mock(() => mockSelectResult),
            })),
          })),
        })),
      };
    });

    const result = await getClients();

    expect(result.success).toBe(true);
    expect(result.data!.totalPages).toBe(1);
    expect(result.data!.clients).toEqual([]);
  });

  test("should handle errors gracefully", async () => {
    mockDb.select = mock(() => {
      throw new Error("Database error");
    });

    const result = await getClients();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to fetch clients");
  });
});
