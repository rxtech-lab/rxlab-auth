import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const oauthClients = sqliteTable(
  "oauth_clients",
  {
    id: text("id").primaryKey(), // client_id
    clientType: text("client_type", { enum: ["public", "confidential"] })
      .notNull()
      .default("confidential"), // Client type for OAuth 2.0
    secret: text("secret"), // hashed client_secret (null for public clients)
    name: text("name").notNull(),
    description: text("description"),
    iconUrl: text("icon_url"), // Vercel Blob URL
    redirectUris: text("redirect_uris").notNull(), // JSON array
    allowedScopes: text("allowed_scopes").notNull(), // JSON array
    isFirstParty: integer("is_first_party", { mode: "boolean" }).default(false),
    signInPermission: text("sign_in_permission", {
      enum: ["all", "none", "whitelist"],
    })
      .notNull()
      .default("all"), // Controls who can sign in via this client
    // Reserved for future permissions
    permissions: text("permissions"), // JSON object for future use
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("oauth_clients_name_idx").on(table.name)]
);

export const oauthClientEmailWhitelist = sqliteTable(
  "oauth_client_email_whitelist",
  {
    id: text("id").primaryKey(), // UUID
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("oauth_client_email_whitelist_client_email_idx").on(
      table.clientId,
      table.email
    ),
    index("oauth_client_email_whitelist_client_idx").on(table.clientId),
  ]
);

export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;
export type OAuthClientEmailWhitelist =
  typeof oauthClientEmailWhitelist.$inferSelect;
export type NewOAuthClientEmailWhitelist =
  typeof oauthClientEmailWhitelist.$inferInsert;
