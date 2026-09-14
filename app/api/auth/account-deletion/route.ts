import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPendingDeletion } from "@/lib/account/deletion";
import {
  cancelAccountDeletion,
  scheduleAccountDeletion,
} from "@/lib/account/deletion-scheduler";
import { toUtcIso } from "@/lib/account/deletion-status";

// Session-authenticated account deletion.
//
//   GET    -> pending-deletion status
//   POST   -> schedule (idempotent: re-posting returns the existing schedule
//             rather than sliding the deadline further out)
//   DELETE -> cancel
//
// Scheduling deliberately leaves the session intact — the user stays signed in
// throughout the grace period so they can change their mind.

async function requireUserId(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, userId: session.userId };
}

export async function GET() {
  try {
    const auth = await requireUserId();
    if (!auth.ok) return auth.response;

    const pending = await getPendingDeletion(auth.userId);

    return NextResponse.json({
      pendingDeletion: pending !== null,
      deletionScheduledAt: toUtcIso(pending?.scheduledAt ?? null),
      deletionRequestedAt: toUtcIso(pending?.requestedAt ?? null),
    });
  } catch (error) {
    console.error("Get account deletion status error:", error);
    return NextResponse.json(
      { error: "Failed to read account deletion status" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const auth = await requireUserId();
    if (!auth.ok) return auth.response;

    const result = await scheduleAccountDeletion({
      userId: auth.userId,
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
    console.error("Schedule account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to schedule account deletion" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const auth = await requireUserId();
    if (!auth.ok) return auth.response;

    const result = await cancelAccountDeletion({
      userId: auth.userId,
      actor: "user",
    });
    if (!result.ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      pendingDeletion: false,
      cancelled: result.cancelled,
      deletionScheduledAt: null,
    });
  } catch (error) {
    console.error("Cancel account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to cancel account deletion" },
      { status: 500 },
    );
  }
}
