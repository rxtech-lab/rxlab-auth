"use server";

import { requireAdmin } from "@/lib/auth/session";
import {
  cancelAccountDeletion,
  scheduleAccountDeletion,
} from "@/lib/account/deletion-scheduler";
import { revalidatePath } from "next/cache";

export interface UserDeletionScheduleResult {
  success: boolean;
  error?: string;
  deletionScheduledAt?: string | null;
}

/** Admin-initiated scheduled deletion — the revertible counterpart to deleteUser. */
export async function scheduleUserDeletion(
  userId: string,
): Promise<UserDeletionScheduleResult> {
  try {
    await requireAdmin();

    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const result = await scheduleAccountDeletion({ userId, actor: "admin" });
    if (!result.ok) {
      return { success: false, error: "User not found" };
    }

    revalidatePath("/admin/dashboard/users");

    return {
      success: true,
      deletionScheduledAt: result.pending.scheduledAt.toISOString(),
    };
  } catch (error) {
    console.error("Schedule user deletion error:", error);
    return { success: false, error: "Failed to schedule deletion" };
  }
}

export async function cancelUserDeletion(
  userId: string,
): Promise<UserDeletionScheduleResult> {
  try {
    await requireAdmin();

    if (!userId) {
      return { success: false, error: "User ID is required" };
    }

    const result = await cancelAccountDeletion({ userId, actor: "admin" });
    if (!result.ok) {
      return { success: false, error: "User not found" };
    }

    revalidatePath("/admin/dashboard/users");

    return { success: true, deletionScheduledAt: null };
  } catch (error) {
    console.error("Cancel user deletion error:", error);
    return { success: false, error: "Failed to cancel deletion" };
  }
}
