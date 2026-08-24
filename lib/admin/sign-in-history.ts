import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  oauthClients,
  oauthRefreshTokens,
  users,
} from "@/lib/db/schema";

const lastSignedInAt = sql<Date>`max(coalesce(${oauthRefreshTokens.authenticatedAt}, ${oauthRefreshTokens.createdAt}))`.mapWith(
  oauthRefreshTokens.createdAt,
);

export interface SignedInApp {
  clientId: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  signedInAt: Date;
}

export interface SignedInUser {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  signedInAt: Date;
}

export async function getUserSignedInApps(
  userId: string,
): Promise<SignedInApp[]> {
  return db
    .select({
      clientId: oauthClients.id,
      name: oauthClients.name,
      description: oauthClients.description,
      iconUrl: oauthClients.iconUrl,
      signedInAt: lastSignedInAt,
    })
    .from(oauthRefreshTokens)
    .innerJoin(oauthClients, eq(oauthRefreshTokens.clientId, oauthClients.id))
    .where(eq(oauthRefreshTokens.userId, userId))
    .groupBy(
      oauthClients.id,
      oauthClients.name,
      oauthClients.description,
      oauthClients.iconUrl,
    )
    .orderBy(desc(lastSignedInAt));
}

export async function getClientSignedInUsers(
  clientId: string,
): Promise<SignedInUser[]> {
  return db
    .select({
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      signedInAt: lastSignedInAt,
    })
    .from(oauthRefreshTokens)
    .innerJoin(users, eq(oauthRefreshTokens.userId, users.id))
    .where(eq(oauthRefreshTokens.clientId, clientId))
    .groupBy(
      users.id,
      users.email,
      users.displayName,
      users.avatarUrl,
    )
    .orderBy(desc(lastSignedInAt));
}
