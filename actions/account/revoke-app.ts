"use server";

import { db } from "@/lib/db";
import { oauthConsents, oauthRefreshTokens } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface RevokeAppResult {
  success: boolean;
  error?: string;
}

export async function revokeApp(clientId: string): Promise<RevokeAppResult> {
  try {
    const session = await requireAuth();

    // Delete consent
    await db
      .delete(oauthConsents)
      .where(
        and(
          eq(oauthConsents.userId, session.userId!),
          eq(oauthConsents.clientId, clientId)
        )
      );

    // Revoke all refresh tokens for this client
    await db
      .update(oauthRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(oauthRefreshTokens.userId, session.userId!),
          eq(oauthRefreshTokens.clientId, clientId)
        )
      );

    revalidatePath("/account/apps");

    return { success: true };
  } catch (error) {
    console.error("Revoke app error:", error);
    return {
      success: false,
      error: "Failed to revoke access",
    };
  }
}
