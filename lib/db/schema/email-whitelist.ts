import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const emailWhitelist = pgTable(
  "email_whitelist",
  {
    id: text("id").primaryKey(), // UUID
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [uniqueIndex("email_whitelist_email_idx").on(table.email)]
);

export type EmailWhitelist = typeof emailWhitelist.$inferSelect;
export type NewEmailWhitelist = typeof emailWhitelist.$inferInsert;
