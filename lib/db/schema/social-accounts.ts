import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const socialAccounts = sqliteTable(
  "social_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["github", "google"] }).notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    providerEmail: text("provider_email").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("social_accounts_provider_account_idx").on(
      table.provider,
      table.providerAccountId,
    ),
    uniqueIndex("social_accounts_user_provider_idx").on(
      table.userId,
      table.provider,
    ),
    index("social_accounts_user_idx").on(table.userId),
  ],
);

export type SocialAccount = typeof socialAccounts.$inferSelect;
export type NewSocialAccount = typeof socialAccounts.$inferInsert;
