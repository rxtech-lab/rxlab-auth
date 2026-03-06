"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth, destroySession } from "@/lib/auth/session";
import { deleteImage } from "@/lib/blob";
import { eq } from "drizzle-orm";

export interface DeleteAccountResult {
  success: boolean;
  error?: string;
}

export async function deleteAccount(): Promise<DeleteAccountResult> {
  try {
    const session = await requireAuth();

    // Get user to check for avatar
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId!),
    });

    // Delete avatar from blob storage if exists
    if (user?.avatarUrl) {
      try {
        await deleteImage(user.avatarUrl);
      } catch {
        // Ignore deletion errors for blob cleanup
      }
    }

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
