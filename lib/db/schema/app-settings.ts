import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(), // Single row with id = "global"
  signUpEnabled: boolean("sign_up_enabled").default(true).notNull(),
  signUpWhitelistEnabled: boolean("sign_up_whitelist_enabled")
    .default(false)
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;
export type NewAppSettings = typeof appSettings.$inferInsert;
