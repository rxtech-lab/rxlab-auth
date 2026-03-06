import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // UUID
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
    passwordHash: text("password_hash"), // nullable for passkey-only users
    username: text("username").unique(),
    displayName: text("display_name"),
    avatarSeed: text("avatar_seed"), // for geometric identicon generation
    avatarUrl: text("avatar_url"), // uploaded avatar URL (Vercel Blob)
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_username_idx").on(table.username),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
