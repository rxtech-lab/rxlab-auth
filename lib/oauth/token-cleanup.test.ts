import { describe, expect, test, mock, beforeEach } from "bun:test";
import { drizzleOrmMock } from "@/lib/db/drizzle-mock";
import { schemaMock } from "@/lib/db/schema-mock";

// --- fake drizzle delete/select builders ------------------------------------
// The conditions are opaque here; these tests assert the batching loop and the
// per-table accounting, not the generated SQL.

/** Rows each successive delete should report, per table, in call order. */
let deleteQueue: { id: string }[][] = [];
const selectLimits: number[] = [];
let deleteCalls = 0;

const mockDb = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        limit: mock((n: number) => {
          selectLimits.push(n);
          return { __subquery: n };
        }),
      })),
    })),
  })),
  delete: mock(() => ({
    where: mock(() => ({
      returning: mock(() => {
        const rows = deleteQueue[deleteCalls] ?? [];
        deleteCalls += 1;
        return Promise.resolve(rows);
      }),
    })),
  })),
};

mock.module("drizzle-orm", () => drizzleOrmMock);
mock.module("@/lib/db", () => ({ db: mockDb }));
// A superset stub, so this registration winning the run can't break a suite
// that needs a different table. See lib/db/schema-mock.ts.
mock.module("@/lib/db/schema", () => schemaMock);

const {
  purgeExpiredTokens,
  resolveRetentionSeconds,
  DEFAULT_TOKEN_RETENTION_SECONDS,
} = await import("./token-cleanup");

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}` }));

beforeEach(() => {
  deleteQueue = [];
  deleteCalls = 0;
  selectLimits.length = 0;
});

describe("resolveRetentionSeconds", () => {
  test("falls back to the default when unset or blank", () => {
    expect(resolveRetentionSeconds(undefined)).toBe(DEFAULT_TOKEN_RETENTION_SECONDS);
    expect(resolveRetentionSeconds("")).toBe(DEFAULT_TOKEN_RETENTION_SECONDS);
    expect(resolveRetentionSeconds("   ")).toBe(DEFAULT_TOKEN_RETENTION_SECONDS);
  });

  test("reads a valid window", () => {
    expect(resolveRetentionSeconds("604800")).toBe(604800);
    expect(resolveRetentionSeconds("0")).toBe(0);
  });

  test("truncates a fractional window", () => {
    expect(resolveRetentionSeconds("1.9")).toBe(1);
  });

  // A typo'd or negative value must not become a more aggressive purge than
  // the operator asked for.
  test("rejects garbage and negatives rather than purging harder", () => {
    expect(resolveRetentionSeconds("soon")).toBe(DEFAULT_TOKEN_RETENTION_SECONDS);
    expect(resolveRetentionSeconds("-1")).toBe(DEFAULT_TOKEN_RETENTION_SECONDS);
    expect(resolveRetentionSeconds("NaN")).toBe(DEFAULT_TOKEN_RETENTION_SECONDS);
  });
});

describe("purgeExpiredTokens", () => {
  test("stops a table as soon as a delete comes back short", async () => {
    // One short batch per table means one delete each, three in total.
    deleteQueue = [rows(3), rows(2), rows(1)];

    const result = await purgeExpiredTokens();

    expect(result).toEqual({
      refreshTokens: 3,
      emailVerificationTokens: 2,
      passwordResetTokens: 1,
    });
    expect(deleteCalls).toBe(3);
  });

  test("keeps batching while each delete comes back full", async () => {
    // Two full 1000-row batches, then a short one, then the other two tables.
    deleteQueue = [rows(1000), rows(1000), rows(7), [], []];

    const result = await purgeExpiredTokens();

    expect(result.refreshTokens).toBe(2007);
    expect(deleteCalls).toBe(5);
  });

  test("never asks for more rows than the per-table ceiling allows", async () => {
    deleteQueue = [rows(1000), rows(500), [], []];

    const result = await purgeExpiredTokens({ maxRowsPerTable: 1500 });

    expect(result.refreshTokens).toBe(1500);
    // The final batch is trimmed to the remaining allowance, not a full 1000.
    expect(selectLimits.slice(0, 2)).toEqual([1000, 500]);
  });

  test("reports zero without deleting when nothing has expired", async () => {
    deleteQueue = [[], [], []];

    const result = await purgeExpiredTokens();

    expect(result).toEqual({
      refreshTokens: 0,
      emailVerificationTokens: 0,
      passwordResetTokens: 0,
    });
    expect(deleteCalls).toBe(3);
  });
});
