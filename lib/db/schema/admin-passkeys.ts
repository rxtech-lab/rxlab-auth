import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

export const adminPasskeys = pgTable("admin_passkeys", {
  id: text("id").primaryKey(), // credential ID (base64url)
  name: text("name").notNull(), // user-provided name
  publicKey: text("public_key").notNull(), // base64url encoded COSE public key
  counter: integer("counter").notNull().default(0),
  transports: text("transports"), // JSON array
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export type AdminPasskey = typeof adminPasskeys.$inferSelect;
export type NewAdminPasskey = typeof adminPasskeys.$inferInsert;
