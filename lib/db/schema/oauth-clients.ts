import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const oauthClients = sqliteTable(
  "oauth_clients",
  {
    id: text("id").primaryKey(), // client_id
    secret: text("secret").notNull(), // hashed client_secret
    name: text("name").notNull(),
    description: text("description"),
    iconUrl: text("icon_url"), // Vercel Blob URL
    redirectUris: text("redirect_uris").notNull(), // JSON array
    allowedScopes: text("allowed_scopes").notNull(), // JSON array
    isFirstParty: integer("is_first_party", { mode: "boolean" }).default(false),
    // Reserved for future permissions
    permissions: text("permissions"), // JSON object for future use
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("oauth_clients_name_idx").on(table.name)]
);

export type OAuthClient = typeof oauthClients.$inferSelect;
export type NewOAuthClient = typeof oauthClients.$inferInsert;
