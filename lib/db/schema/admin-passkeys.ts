import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const adminPasskeys = sqliteTable("admin_passkeys", {
  id: text("id").primaryKey(), // credential ID (base64url)
  name: text("name").notNull(), // user-provided name
  publicKey: text("public_key").notNull(), // base64url encoded COSE public key
  counter: integer("counter").notNull().default(0),
  transports: text("transports"), // JSON array
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
});

export type AdminPasskey = typeof adminPasskeys.$inferSelect;
export type NewAdminPasskey = typeof adminPasskeys.$inferInsert;
