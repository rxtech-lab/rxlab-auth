import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { oauthClients } from "./oauth-clients";

// Apple app identifiers (`<TEAMID>.<BUNDLEID>`) registered to an OAuth client.
// Read by the apple-app-site-association route to populate `webcredentials.apps`.
export const oauthClientAppIds = sqliteTable(
  "oauth_client_app_ids",
  {
    id: text("id").primaryKey(), // UUID
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    appId: text("app_id").notNull(), // <TEAMID>.<BUNDLEID>
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("oauth_client_app_ids_client_app_idx").on(
      table.clientId,
      table.appId
    ),
    index("oauth_client_app_ids_client_idx").on(table.clientId),
    index("oauth_client_app_ids_app_idx").on(table.appId),
  ]
);

export type OAuthClientAppId = typeof oauthClientAppIds.$inferSelect;
export type NewOAuthClientAppId = typeof oauthClientAppIds.$inferInsert;
