import {
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { oauthClients } from "./oauth-clients";

// Apple app identifiers (`<TEAMID>.<BUNDLEID>`) registered to an OAuth client.
// Read by the apple-app-site-association route to populate `webcredentials.apps`.
export const oauthClientAppIds = pgTable(
  "oauth_client_app_ids",
  {
    id: text("id").primaryKey(), // UUID
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    appId: text("app_id").notNull(), // <TEAMID>.<BUNDLEID>
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
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
