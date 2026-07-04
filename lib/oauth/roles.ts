import { db } from "@/lib/db";
import { oauthClientRoles, oauthClientUserRoles } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function getUserRoleKeys(
  userId: string,
  clientId: string
): Promise<string[]> {
  const rows = await db
    .select({ key: oauthClientRoles.key })
    .from(oauthClientUserRoles)
    .innerJoin(
      oauthClientRoles,
      eq(oauthClientUserRoles.roleId, oauthClientRoles.id)
    )
    .where(
      and(
        eq(oauthClientUserRoles.userId, userId),
        eq(oauthClientUserRoles.clientId, clientId),
        eq(oauthClientRoles.clientId, clientId)
      )
    )
    .orderBy(oauthClientRoles.key);

  return rows.map((row) => row.key);
}
