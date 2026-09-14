"use server";

import { requireAuth } from "@/lib/auth/session";
import {
  cancelAccountDeletion,
  scheduleAccountDeletion,
} from "@/lib/account/deletion-scheduler";

export interface DeleteAccountResult {
  success: boolean;
  error?: string;
  /** ISO-8601 UTC instant the account will be deleted, when pending. */
  deletionScheduledAt?: string | null;
  alreadyScheduled?: boolean;
}

/**
 * Schedule the signed-in user's account for deletion after the grace period.
 *
 * Note the session is deliberately NOT destroyed: the user stays signed in so
 * they can change their mind, and every user-info surface reports the pending
 * state until they do.
 */
export async function requestAccountDeletion(): Promise<DeleteAccountResult> {
  try {
    const session = await requireAuth();

    const result = await scheduleAccountDeletion({
      userId: session.userId!,
      actor: "user",
    });

    if (!result.ok) {
      return { success: false, error: "Account not found" };
    }

    return {
      success: true,
      deletionScheduledAt: result.pending.scheduledAt.toISOString(),
      alreadyScheduled: result.alreadyScheduled,
    };
  } catch (error) {
    console.error("Request account deletion error:", error);
    return { success: false, error: "Failed to schedule account deletion" };
  }
}

/** Revert a pending deletion. */
export async function revertAccountDeletion(): Promise<DeleteAccountResult> {
  try {
    const session = await requireAuth();

    const result = await cancelAccountDeletion({
      userId: session.userId!,
      actor: "user",
    });

    if (!result.ok) {
      return { success: false, error: "Account not found" };
    }

    return { success: true, deletionScheduledAt: null };
  } catch (error) {
    console.error("Revert account deletion error:", error);
    return { success: false, error: "Failed to cancel account deletion" };
  }
}
