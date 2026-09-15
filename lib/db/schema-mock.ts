/**
 * Test-only: the shared `mock.module("@/lib/db/schema", ...)` stub.
 *
 * The same hazard `drizzle-mock.ts` documents applies here. `mock.module`
 * replaces a module for the entire `bun test` run, not just the file that calls
 * it, so the last registration wins for everyone. A stub that exports only the
 * tables its own suite needs will therefore break any other suite whose module
 * under test imports a different one — surfacing as
 * `SyntaxError: Export named 'oauthClients' not found in module
 * lib/db/schema/index.ts` inside a file that never mocked anything.
 *
 * Every suite that stubs the schema should spread this object, so whichever
 * registration wins is always a superset.
 *
 * The table values are opaque markers: suites that mock `drizzle-orm` too get
 * conditions their fake `db` ignores, so only identity matters. Column access
 * returns a stable `"<table>.<column>"` string, which keeps assertions on
 * *which* column a query touched readable.
 */

const TABLE_NAMES = [
  "adminPasskeys",
  "appSettings",
  "emailVerificationTokens",
  "emailWhitelist",
  "oauthClientAppIds",
  "oauthClientEmailWhitelist",
  "oauthClientRoles",
  "oauthClientUserRoles",
  "oauthClients",
  "oauthConsents",
  "oauthRefreshTokens",
  "passkeys",
  "passwordResetTokens",
  "socialAccounts",
  "users",
] as const;

/** Any column read off a stub table yields `"<table>.<column>"`. */
function stubTable(table: string): Record<string, string> {
  return new Proxy(
    {},
    {
      get: (_target, column) =>
        typeof column === "string" ? `${table}.${column}` : undefined,
      // `in` and spread have to see something, or drizzle-free assertions on
      // the stub behave surprisingly.
      has: () => true,
    },
  ) as Record<string, string>;
}

export const schemaMock = Object.fromEntries(
  TABLE_NAMES.map((name) => [name, stubTable(name)]),
) as Record<(typeof TABLE_NAMES)[number], Record<string, string>>;
