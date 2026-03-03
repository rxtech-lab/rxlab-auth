"use server";

import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { desc, sql } from "drizzle-orm";
import type { OAuthClient } from "@/lib/db/schema";

export interface PaginatedClientsResult {
  success: boolean;
  error?: string;
  data?: {
    clients: OAuthClient[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface GetClientsParams {
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function getClients(
  params: GetClientsParams = {}
): Promise<PaginatedClientsResult> {
  try {
    await requireAdmin();

    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(
      Math.max(params.pageSize ?? DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );
    const offset = (page - 1) * pageSize;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(oauthClients);

    const totalPages = Math.max(Math.ceil(count / pageSize), 1);

    // Fetch clients for the current page
    const clients = await db
      .select()
      .from(oauthClients)
      .orderBy(desc(oauthClients.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      success: true,
      data: {
        clients,
        page,
        pageSize,
        totalCount: count,
        totalPages,
      },
    };
  } catch (error) {
    console.error("Get clients error:", error);
    return {
      success: false,
      error: "Failed to fetch clients",
    };
  }
}
