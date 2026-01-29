import { drizzle } from "drizzle-orm/libsql";
import { createClient, Client } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";
import path from "path";

// Persist database client across HMR for in-memory databases
const globalForDb = globalThis as unknown as {
  client: Client | undefined;
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
  initialized: boolean | undefined;
};

const client =
  globalForDb.client ??
  createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

export const db = globalForDb.db ?? drizzle(client, { schema });

// Preserve across HMR in development
if (process.env.NODE_ENV !== "production") {
  globalForDb.client = client;
  globalForDb.db = db;
}

export type Database = typeof db;

// Auto-run migrations for E2E tests with in-memory database
async function initializeDatabase() {
  // Skip if already initialized
  if (globalForDb.initialized) {
    return;
  }

  if (
    process.env.E2E_SKIP_EMAIL_VERIFICATION === "true" &&
    process.env.TURSO_DATABASE_URL?.includes(":memory:")
  ) {
    // Use drizzle migrations for in-memory E2E testing
    const migrationsFolder = path.join(process.cwd(), "lib/db/migrations");

    await migrate(db, { migrationsFolder });

    globalForDb.initialized = true;
    console.log("[E2E] In-memory database migrations applied");
  }
}

// Initialize on module load
initializeDatabase().catch(console.error);
