import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["github", "google", "apple"] }).notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    providerEmail: text("provider_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
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
