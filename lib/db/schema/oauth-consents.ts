import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { users } from "./users";
import { oauthClients } from "./oauth-clients";

export const oauthConsents = sqliteTable(
  "oauth_consents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    scopes: text("scopes").notNull(), // JSON array of granted scopes
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("oauth_consents_user_client_idx").on(table.userId, table.clientId),
    index("oauth_consents_user_idx").on(table.userId),
    index("oauth_consents_client_idx").on(table.clientId),
  ]
);

export type OAuthConsent = typeof oauthConsents.$inferSelect;
export type NewOAuthConsent = typeof oauthConsents.$inferInsert;
