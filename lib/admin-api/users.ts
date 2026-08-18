import { desc, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { toContainsLikePattern } from "@/lib/admin-api/query";

export interface AdminUserSummary {
  id: string;
  sub: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface AdminUserIdentityRow {
  id: string;
  email: string;
  displayName: string | null;
  avatarSeed: string | null;
  avatarUrl: string | null;
}

export interface AdminUserListResult {
  users: AdminUserSummary[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export function buildAdminUserSummary(
  user: AdminUserIdentityRow,
  issuerUrl: string | undefined,
): AdminUserSummary {
  const issuer = issuerUrl?.replace(/\/$/, "");

  return {
    id: user.id,
    sub: user.id,
    name: user.displayName,
    email: user.email,
    image:
      user.avatarUrl ||
      (issuer ? `${issuer}/api/avatar/${user.avatarSeed || user.id}` : null),
  };
}

export async function listAdminUsers(params: {
  page: number;
  pageSize: number;
  keyword?: string;
}): Promise<AdminUserListResult> {
  const { page, pageSize } = params;
  const keyword = params.keyword?.trim();
  const keywordPattern = keyword ? toContainsLikePattern(keyword) : undefined;
  const searchCondition = keywordPattern
    ? or(
        sql`${users.id} LIKE ${keywordPattern} ESCAPE '\\'`,
        sql`${users.email} LIKE ${keywordPattern} ESCAPE '\\'`,
        sql`${users.username} LIKE ${keywordPattern} ESCAPE '\\'`,
        sql`${users.displayName} LIKE ${keywordPattern} ESCAPE '\\'`,
      )
    : undefined;

  const countQuery = db.select({ count: sql<number>`count(*)` }).from(users);
  const [{ count }] = searchCondition
    ? await countQuery.where(searchCondition)
    : await countQuery;

  const userQuery = db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarSeed: users.avatarSeed,
      avatarUrl: users.avatarUrl,
    })
    .from(users);
  const filteredQuery = searchCondition
    ? userQuery.where(searchCondition)
    : userQuery;
  const userRows = await filteredQuery
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    users: userRows.map((user) =>
      buildAdminUserSummary(user, process.env.OAUTH_ISSUER_URL),
    ),
    pagination: {
      page,
      pageSize,
      totalCount: count,
      totalPages: Math.ceil(count / pageSize),
    },
  };
}
