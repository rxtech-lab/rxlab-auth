import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { oauthClients } from "./oauth-clients";

export const oauthClientRoles = sqliteTable(
  "oauth_client_roles",
  {
    id: text("id").primaryKey(), // UUID
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("oauth_client_roles_client_key_idx").on(
      table.clientId,
      table.key
    ),
    index("oauth_client_roles_client_idx").on(table.clientId),
  ]
);

export const oauthClientUserRoles = sqliteTable(
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
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
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
