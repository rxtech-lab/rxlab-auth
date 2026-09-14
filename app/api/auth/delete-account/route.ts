import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { scheduleAccountDeletion } from "@/lib/account/deletion-scheduler";

/**
 * @deprecated Use /api/auth/account-deletion, which also exposes GET (status)
 * and DELETE (cancel). Kept as an alias so existing clients keep working.
 *
 * Behaviour change: this used to hard-delete the account and destroy the
 * session. It now schedules deletion after the grace period and leaves the
 * session intact.
 */
export async function DELETE() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await scheduleAccountDeletion({
      userId: session.userId,
      actor: "user",
    });
    if (!result.ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      pendingDeletion: true,
      alreadyScheduled: result.alreadyScheduled,
      deletionScheduledAt: result.pending.scheduledAt.toISOString(),
      deletionRequestedAt: result.pending.requestedAt.toISOString(),
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: "Failed to schedule account deletion" },
      { status: 500 },
    );
  }
}
