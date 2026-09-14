"use server";

import { requireAdmin } from "@/lib/auth/session";
import { hardDeleteAccount } from "@/lib/account/deletion-scheduler";
import { revalidatePath } from "next/cache";

export interface DeleteUserResult {
  success: boolean;
  error?: string;
}

/**
 * Immediate, irreversible delete. Kept alongside the 7-day scheduled path for
 * cases where an admin needs an account gone now (abuse, legal request).
 *
 * Safe against a user who already had a deletion pending: hardDeleteAccount
 * cancels the orphaned workflow run, and even if that cancel fails the run wakes
 * to a missing row and no-ops.
 */
export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  try {
    await requireAdmin();

    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const result = await hardDeleteAccount({ userId, actor: "admin" });
    if (!result.ok) {
      return { success: false, error: "User not found" };
    }

    revalidatePath("/admin/dashboard/users");

    return { success: true };
  } catch (error) {
    console.error("Delete user error:", error);
    return { success: false, error: "Failed to delete user" };
  }
}
