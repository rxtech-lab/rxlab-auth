import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { getReadOAuthClientsAccess } from "@/lib/admin-api/permissions";

export async function findMissingPermissionClientIds(
  permissions: readonly string[],
): Promise<string[]> {
  const access = getReadOAuthClientsAccess(permissions);
  if (access.scope !== "selected") return [];

  const matchingClients = await db
    .select({ id: oauthClients.id })
    .from(oauthClients)
    .where(inArray(oauthClients.id, access.clientIds));
  const matchingIds = new Set(matchingClients.map((client) => client.id));

  return access.clientIds.filter((clientId) => !matchingIds.has(clientId));
}
