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
    adminApiPermissions: text("admin_api_permissions").notNull().default("[]"),
    // Delayed-deletion state. All four are written and cleared together — treat
    // them as one record. An account is pending deletion iff
    // `deletionScheduledAt` is non-null.
    //
    // `deletionRequestId` is the fencing token the workflow checks on wake. It
    // has to be an opaque id rather than a timestamp: `mode: "timestamp"` stores
    // whole seconds, so a cancel + re-schedule inside the same second would
    // produce an identical timestamp and let a stale run delete an account the
    // user had re-scheduled. See lib/account/deletion.ts.
    deletionScheduledAt: integer("deletion_scheduled_at", { mode: "timestamp" }),
    deletionRequestedAt: integer("deletion_requested_at", { mode: "timestamp" }),
    deletionRequestId: text("deletion_request_id"),
    deletionRunId: text("deletion_run_id"), // Vercel Workflow runId, null when unavailable
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_username_idx").on(table.username),
    index("users_deletion_scheduled_at_idx").on(table.deletionScheduledAt),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/** The subset every deletion-state serializer needs. */
export type UserDeletionState = Pick<
  User,
  "deletionScheduledAt" | "deletionRequestedAt"
>;
