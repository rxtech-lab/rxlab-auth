import { and, desc, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import type { ReadOAuthClientsAccess } from "@/lib/admin-api/permissions";
import { toContainsLikePattern } from "@/lib/admin-api/oauth-client-query";

export interface OAuthClientSummary {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  clientType: "public" | "confidential";
  isFirstParty: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OAuthClientListResult {
  clients: OAuthClientSummary[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export async function listOAuthClients(params: {
  access: Exclude<ReadOAuthClientsAccess, { scope: "none" }>;
  page: number;
  pageSize: number;
  keyword?: string;
}): Promise<OAuthClientListResult> {
  const { access, page, pageSize } = params;
  const keyword = params.keyword?.trim();
  const keywordPattern = keyword ? toContainsLikePattern(keyword) : undefined;
  const accessCondition =
    access.scope === "selected"
      ? inArray(oauthClients.id, access.clientIds)
      : undefined;
  const keywordCondition = keywordPattern
    ? or(
        sql`${oauthClients.id} LIKE ${keywordPattern} ESCAPE '\\'`,
        sql`${oauthClients.name} LIKE ${keywordPattern} ESCAPE '\\'`,
        sql`${oauthClients.description} LIKE ${keywordPattern} ESCAPE '\\'`,
      )
    : undefined;
  const whereCondition =
    accessCondition && keywordCondition
      ? and(accessCondition, keywordCondition)
      : accessCondition || keywordCondition;

  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(oauthClients);
  const [{ count }] = whereCondition
    ? await countQuery.where(whereCondition)
    : await countQuery;

  const clientQuery = db
    .select({
      id: oauthClients.id,
      name: oauthClients.name,
      description: oauthClients.description,
      iconUrl: oauthClients.iconUrl,
      clientType: oauthClients.clientType,
      isFirstParty: oauthClients.isFirstParty,
      createdAt: oauthClients.createdAt,
      updatedAt: oauthClients.updatedAt,
    })
    .from(oauthClients);

  const orderedQuery = whereCondition
    ? clientQuery.where(whereCondition)
    : clientQuery;
  const clients = await orderedQuery
    .orderBy(desc(oauthClients.createdAt), desc(oauthClients.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    clients,
    pagination: {
      page,
      pageSize,
      totalCount: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}
