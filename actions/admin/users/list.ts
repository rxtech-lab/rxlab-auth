"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { desc, lt, or, and, eq, sql, like } from "drizzle-orm";
import type { User } from "@/lib/db/schema";

export interface PaginatedUsersResult {
  success: boolean;
  error?: string;
  data?: {
    users: User[];
    nextCursor: string | null;
    totalCount: number;
  };
}

export interface GetUsersParams {
  cursor?: string;
  limit?: number;
  search?: string;
}

interface CursorData {
  createdAt: number;
  id: string;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.getTime(), id })
  ).toString("base64");
}

function decodeCursor(cursor: string): CursorData | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString());
    return {
      createdAt: decoded.createdAt,
      id: decoded.id,
    };
  } catch {
    return null;
  }
}

export async function getUsers(
  params: GetUsersParams = {}
): Promise<PaginatedUsersResult> {
  try {
    await requireAdmin();

    const limit = Math.min(params.limit ?? 20, 100);
    const cursorData = params.cursor ? decodeCursor(params.cursor) : null;
    const searchTerm = params.search?.trim();

    // Build search condition
    const searchCondition = searchTerm
      ? or(
          like(users.email, `%${searchTerm}%`),
          like(users.username, `%${searchTerm}%`),
          like(users.displayName, `%${searchTerm}%`)
        )
      : undefined;

    // Get total count (with search filter if applicable)
    const countQuery = searchCondition
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(searchCondition)
      : db.select({ count: sql<number>`count(*)` }).from(users);

    const [{ count }] = await countQuery;

    // Build cursor condition
    const cursorCondition = cursorData
      ? or(
          lt(users.createdAt, new Date(cursorData.createdAt)),
          and(
            eq(users.createdAt, new Date(cursorData.createdAt)),
            lt(users.id, cursorData.id)
          )
        )
      : undefined;

    // Combine conditions
    const whereCondition =
      searchCondition && cursorCondition
        ? and(searchCondition, cursorCondition)
        : searchCondition || cursorCondition;

    // Build query
    const query = whereCondition
      ? db
          .select()
          .from(users)
          .where(whereCondition)
          .orderBy(desc(users.createdAt), desc(users.id))
          .limit(limit + 1)
      : db
          .select()
          .from(users)
          .orderBy(desc(users.createdAt), desc(users.id))
          .limit(limit + 1);

    const userList = await query;

    const hasMore = userList.length > limit;
    const resultUsers = hasMore ? userList.slice(0, limit) : userList;

    // Generate next cursor
    const lastUser = resultUsers[resultUsers.length - 1];
    const nextCursor =
      hasMore && lastUser
        ? encodeCursor(lastUser.createdAt, lastUser.id)
        : null;

    return {
      success: true,
      data: {
        users: resultUsers,
        nextCursor,
        totalCount: count,
      },
    };
  } catch (error) {
    console.error("Get users error:", error);
    return {
      success: false,
      error: "Failed to fetch users",
    };
  }
}
