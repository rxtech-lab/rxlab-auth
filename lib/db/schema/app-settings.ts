import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey(), // Single row with id = "global"
  signUpEnabled: integer("sign_up_enabled", { mode: "boolean" })
    .default(true)
    .notNull(),
  signUpWhitelistEnabled: integer("sign_up_whitelist_enabled", {
    mode: "boolean",
  })
    .default(false)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;
export type NewAppSettings = typeof appSettings.$inferInsert;
