import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const emailWhitelist = sqliteTable(
  "email_whitelist",
  {
    id: text("id").primaryKey(), // UUID
    email: text("email").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [uniqueIndex("email_whitelist_email_idx").on(table.email)]
);

export type EmailWhitelist = typeof emailWhitelist.$inferSelect;
export type NewEmailWhitelist = typeof emailWhitelist.$inferInsert;
