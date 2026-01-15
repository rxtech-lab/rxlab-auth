import { sqliteTable, text, integer, blob, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const passkeys = sqliteTable(
  "passkeys",
  {
    id: text("id").primaryKey(), // credential ID (base64url)
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // user-provided name like "MacBook Pro"
    publicKey: text("public_key").notNull(), // base64url encoded COSE public key
    counter: integer("counter").notNull().default(0),
    deviceType: text("device_type"), // "platform" or "cross-platform"
    backedUp: integer("backed_up", { mode: "boolean" }).default(false),
    transports: text("transports"), // JSON array: ["internal", "usb", "ble", "nfc"]
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  },
  (table) => [index("passkeys_user_idx").on(table.userId)]
);

export type Passkey = typeof passkeys.$inferSelect;
export type NewPasskey = typeof passkeys.$inferInsert;
