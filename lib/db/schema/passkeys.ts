import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const passkeys = pgTable(
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
    backedUp: boolean("backed_up").default(false),
    transports: text("transports"), // JSON array: ["internal", "usb", "ble", "nfc"]
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (table) => [index("passkeys_user_idx").on(table.userId)]
);

export type Passkey = typeof passkeys.$inferSelect;
export type NewPasskey = typeof passkeys.$inferInsert;
