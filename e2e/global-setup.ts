import EmbeddedPostgres from "embedded-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Boots a throwaway Postgres cluster for the E2E run.
 *
 * Real Postgres rather than the app's own client: the Next.js dev server is a
 * separate process, so the database has to be reachable over a socket. Its data
 * directory is created fresh per run, which is what keeps runs isolated from
 * each other — there is no truncation between tests, and specs lean on unique
 * emails instead.
 *
 * The binaries ship with `@embedded-postgres/<platform>` and are installed by
 * `bun install`, so nothing is downloaded while the suite runs.
 */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) {
    throw new Error(
      "E2E_DATABASE_URL is unset — playwright.config.ts should have set it",
    );
  }

  const { port, username, password, pathname } = new URL(url);
  const database = pathname.replace(/^\//, "");
  const databaseDir = await mkdtemp(join(tmpdir(), "rxlab-auth-e2e-pg-"));

  const postgres = new EmbeddedPostgres({
    databaseDir,
    port: Number(port),
    user: username,
    password,
    // `stop()` deletes the data directory for us, but the mkdtemp parent is
    // ours to clean up.
    persistent: false,
    // initdb and postgres are chatty on startup; only surface real problems.
    onLog: () => {},
  });

  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase(database);

  // Replaces the migrate-on-import hook `lib/db/index.ts` used to carry for the
  // SQLite E2E database: the schema is created once, here, before any spec runs.
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: join(process.cwd(), "lib/db/migrations"),
    });
  } finally {
    await pool.end();
  }

  return async () => {
    await postgres.stop();
    await rm(databaseDir, { recursive: true, force: true });
  };
}
