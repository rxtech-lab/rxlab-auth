import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { oauthClients } from "./oauth-clients";

export const oauthClientRoles = pgTable(
  "oauth_client_roles",
  {
    id: text("id").primaryKey(), // UUID
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("oauth_client_roles_client_key_idx").on(
      table.clientId,
      table.key
    ),
    index("oauth_client_roles_client_idx").on(table.clientId),
  ]
);

export const oauthClientUserRoles = pgTable(
  "oauth_client_user_roles",
  {
    id: text("id").primaryKey(), // UUID
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => oauthClientRoles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("oauth_client_user_roles_unique_idx").on(
      table.clientId,
      table.userId,
      table.roleId
    ),
    index("oauth_client_user_roles_client_user_idx").on(
      table.clientId,
      table.userId
    ),
    index("oauth_client_user_roles_user_idx").on(table.userId),
    index("oauth_client_user_roles_role_idx").on(table.roleId),
  ]
);

export type OAuthClientRole = typeof oauthClientRoles.$inferSelect;
export type NewOAuthClientRole = typeof oauthClientRoles.$inferInsert;
export type OAuthClientUserRole = typeof oauthClientUserRoles.$inferSelect;
export type NewOAuthClientUserRole =
  typeof oauthClientUserRoles.$inferInsert;
