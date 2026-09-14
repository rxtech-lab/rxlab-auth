/**
 * Test-only: the shared `mock.module("drizzle-orm", ...)` stub.
 *
 * `mock.module` replaces a module for the entire `bun test` run, not just the
 * file that calls it, so the last registration wins for everyone. A stub that
 * exports only the helpers its own suite needs will therefore break any other
 * suite whose module under test imports a different one — the failure surfaces
 * as `SyntaxError: Export named 'and' not found in module drizzle-orm` inside a
 * file that never mocked anything.
 *
 * Every suite that stubs drizzle-orm should spread this object, so whichever
 * registration wins is always a superset. The returned conditions are opaque —
 * the fake `db` in each suite ignores them. `eq`, `and` and `not` keep the exact
 * shapes the original inline stubs produced.
 */

const condition =
  (kind: string) =>
  (...args: unknown[]) => ({ [kind]: args });

export const drizzleOrmMock = {
  eq: (field: unknown, value: unknown) => ({ field, value }),
  and: (...conditions: unknown[]) => ({ conditions }),
  not: (condition_: unknown) => ({ not: condition_ }),

  or: condition("or"),
  ne: condition("ne"),
  gt: condition("gt"),
  gte: condition("gte"),
  lt: condition("lt"),
  lte: condition("lte"),
  isNull: condition("isNull"),
  isNotNull: condition("isNotNull"),
  inArray: condition("inArray"),
  like: condition("like"),
  desc: condition("desc"),
  asc: condition("asc"),
  sql: Object.assign(condition("sql"), { raw: condition("sqlRaw") }),
};
