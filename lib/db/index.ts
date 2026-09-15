import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Persist the pool across HMR so a dev session does not leak a connection pool
// per module reload.
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

// `pg` would otherwise fall back to libpq's defaults (localhost, the OS user)
// and fail later with a confusing "database does not exist", so a missing URL
// is caught here where the cause is obvious.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = globalForDb.pool ?? new Pool({ connectionString });

// An idle pooled connection dropped by the server — Neon autosuspending, a
// failover, the cluster going down at the end of an E2E run — surfaces as an
// `error` event on the Pool. Node turns an unhandled one into an
// uncaughtException that takes the process with it, so swallow it here: the
// pool discards the dead client on its own and the next query gets a fresh one.
pool.on("error", (error) => {
  console.error("[db] idle client error", error);
});

// Recreate the Drizzle wrapper when this module reloads so newly added schema
// exports are reflected in db.query while preserving the underlying pool.
export const db = drizzle(pool, { schema });

// Preserve across HMR in development
if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export type Database = typeof db;
