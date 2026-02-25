"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth, destroySession } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

export interface DeleteAccountResult {
  success: boolean;
  error?: string;
}

export async function deleteAccount(): Promise<DeleteAccountResult> {
  try {
    const session = await requireAuth();

    await db.delete(users).where(eq(users.id, session.userId!));

    await destroySession();

    return { success: true };
  } catch (error) {
    console.error("Delete account error:", error);
    return {
      success: false,
      error: "Failed to delete account",
    };
  }
}
