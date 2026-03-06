"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { deleteImage } from "@/lib/blob";
import { eq } from "drizzle-orm";

export interface AvatarActionResult {
  success: boolean;
  error?: string;
  avatarUrl?: string | null;
}

export async function removeAvatar(): Promise<AvatarActionResult> {
  try {
    const session = await requireAuth();

    // Get current user
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId!),
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Clear avatar URL from user record first
    const oldAvatarUrl = user.avatarUrl;
    await db
      .update(users)
      .set({
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId!));

    // Delete avatar from blob storage if exists (best-effort cleanup)
    if (oldAvatarUrl) {
      try {
        await deleteImage(oldAvatarUrl);
      } catch {
        // Ignore deletion errors
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Remove avatar error:", error);
    return {
      success: false,
      error: "Failed to remove avatar",
    };
  }
}

/**
 * Get the current user's avatar URL.
 * Used to poll for the processed WebP avatar after client upload.
 */
export async function getAvatarUrl(): Promise<AvatarActionResult> {
  try {
    const session = await requireAuth();

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId!),
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    return { success: true, avatarUrl: user.avatarUrl };
  } catch (error) {
    console.error("Get avatar URL error:", error);
    return {
      success: false,
      error: "Failed to get avatar URL",
    };
  }
}
