import { count, desc, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { toContainsLikePattern } from "@/lib/admin-api/query";
import {
  buildAccountDeletionStatus,
  type AccountDeletionStatus,
} from "@/lib/account/deletion-status";

export interface AdminUserSummary extends AccountDeletionStatus {
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
  deletionScheduledAt: Date | null;
  deletionRequestedAt: Date | null;
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
    ...buildAccountDeletionStatus(user),
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
        ilike(users.id, keywordPattern),
        ilike(users.email, keywordPattern),
        ilike(users.username, keywordPattern),
        ilike(users.displayName, keywordPattern),
      )
    : undefined;

  const countQuery = db.select({ count: count() }).from(users);
  const [{ count: totalCount }] = searchCondition
    ? await countQuery.where(searchCondition)
    : await countQuery;

  const userQuery = db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      avatarSeed: users.avatarSeed,
      avatarUrl: users.avatarUrl,
      deletionScheduledAt: users.deletionScheduledAt,
      deletionRequestedAt: users.deletionRequestedAt,
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
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
}
