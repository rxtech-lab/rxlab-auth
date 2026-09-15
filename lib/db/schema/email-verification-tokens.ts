import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("email_verification_tokens_user_idx").on(table.userId),
    index("email_verification_tokens_token_idx").on(table.token),
  ]
);

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;
