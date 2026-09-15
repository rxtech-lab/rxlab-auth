import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { oauthClients } from "./oauth-clients";

export const oauthRefreshTokens = pgTable(
  "oauth_refresh_tokens",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    scopes: text("scopes").notNull(), // JSON array
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // Original authentication time for this session. Refresh-token rotation
    // copies this value so activity does not look like a new sign-in.
    authenticatedAt: timestamp("authenticated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("oauth_refresh_tokens_user_idx").on(table.userId),
    index("oauth_refresh_tokens_token_idx").on(table.token),
    index("oauth_refresh_tokens_client_idx").on(table.clientId),
  ]
);

export type OAuthRefreshToken = typeof oauthRefreshTokens.$inferSelect;
export type NewOAuthRefreshToken = typeof oauthRefreshTokens.$inferInsert;
