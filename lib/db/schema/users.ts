import {
  pgTable,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // UUID
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false),
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
    // `deletionRequestId` is the fencing token the workflow checks on wake. An
    // opaque id rather than a timestamp comparison: identity is the thing the
    // workflow actually cares about, so a cancel + re-schedule always produces
    // a different token and a stale run can never delete an account the user
    // had re-scheduled — no matter how close together the two requests land.
    // See lib/account/deletion.ts.
    deletionScheduledAt: timestamp("deletion_scheduled_at", { withTimezone: true }),
    deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
    deletionRequestId: text("deletion_request_id"),
    deletionRunId: text("deletion_run_id"), // Vercel Workflow runId, null when unavailable
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
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
