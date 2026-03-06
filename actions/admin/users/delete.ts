"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { deleteImage } from "@/lib/blob";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface DeleteUserResult {
  success: boolean;
  error?: string;
}

export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  try {
    await requireAdmin();

    if (!userId) {
      return {
        success: false,
        error: "User ID is required",
      };
    }

    // Get user to check for avatar
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    // Delete avatar from blob storage if exists
    if (user?.avatarUrl) {
      try {
        await deleteImage(user.avatarUrl);
      } catch {
        // Ignore deletion errors for blob cleanup
      }
    }

    await db.delete(users).where(eq(users.id, userId));

    revalidatePath("/admin/dashboard/users");

    return { success: true };
  } catch (error) {
    console.error("Delete user error:", error);
    return {
      success: false,
      error: "Failed to delete user",
    };
  }
}
