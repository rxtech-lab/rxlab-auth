import { drizzle } from "drizzle-orm/libsql";
import { createClient, Client } from "@libsql/client";
import * as schema from "./schema";

// Persist database client across HMR for in-memory databases
const globalForDb = globalThis as unknown as {
  client: Client | undefined;
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
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

// Auto-create tables for E2E tests with in-memory database
async function initializeDatabase() {
  if (
    process.env.E2E_SKIP_EMAIL_VERIFICATION === "true" &&
    process.env.TURSO_DATABASE_URL?.includes(":memory:")
  ) {
    // Create tables for in-memory E2E testing
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        username TEXT UNIQUE,
        display_name TEXT,
        avatar_seed TEXT,
        email_verified INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS passkeys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        public_key TEXT NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        device_type TEXT,
        backed_up INTEGER DEFAULT 0,
        transports TEXT,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS oauth_clients (
        id TEXT PRIMARY KEY,
        secret TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        icon_url TEXT,
        redirect_uris TEXT NOT NULL,
        allowed_scopes TEXT NOT NULL,
        is_first_party INTEGER DEFAULT 0,
        permissions TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS oauth_consents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
        scopes TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(user_id, client_id)
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
        scopes TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        revoked_at INTEGER
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS admin_passkeys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        public_key TEXT NOT NULL,
        counter INTEGER NOT NULL DEFAULT 0,
        device_type TEXT,
        backed_up INTEGER DEFAULT 0,
        transports TEXT,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER
      )
    `);

    console.log("[E2E] In-memory database tables created");
  }
}

// Initialize on module load
initializeDatabase().catch(console.error);
