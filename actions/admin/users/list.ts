"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { desc, lt, or, and, eq, sql } from "drizzle-orm";
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

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    // Build query with cursor condition
    let query;
    if (cursorData) {
      const cursorDate = new Date(cursorData.createdAt);
      query = db
        .select()
        .from(users)
        .where(
          or(
            lt(users.createdAt, cursorDate),
            and(eq(users.createdAt, cursorDate), lt(users.id, cursorData.id))
          )
        )
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(limit + 1);
    } else {
      query = db
        .select()
        .from(users)
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(limit + 1);
    }

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
