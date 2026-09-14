import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { deleteImage } from "@/lib/blob";
import {
  computeDeletionScheduledAt,
  floorToSecond,
} from "@/lib/account/deletion-config";

/**
 * Core delayed-deletion logic. Deliberately NOT a `"use server"` module and
 * deliberately free of any `workflow` import: route handlers, server actions and
 * the workflow step all call in here, and the step importing this file is what
 * would close an import cycle if this file reached back to `workflow/api`.
 * Starting and cancelling runs lives in deletion-scheduler.ts instead.
 */

export type DeletionActor = "user" | "admin" | "system";

export interface PendingDeletion {
  scheduledAt: Date;
  requestedAt: Date;
  requestId: string;
  runId: string | null;
}

export type FinalizeReason =
  | "not_found"
  | "cancelled"
  | "superseded"
  | "not_due";

function toPendingDeletion(row: {
  deletionScheduledAt: Date | null;
  deletionRequestedAt: Date | null;
  deletionRequestId: string | null;
  deletionRunId: string | null;
}): PendingDeletion | null {
  if (!row.deletionScheduledAt || !row.deletionRequestedAt || !row.deletionRequestId) {
    return null;
  }
  return {
    scheduledAt: row.deletionScheduledAt,
    requestedAt: row.deletionRequestedAt,
    requestId: row.deletionRequestId,
    runId: row.deletionRunId,
  };
}

/**
 * Hard delete, right now. The single home for the avatar-blob cleanup that was
 * previously duplicated in two call sites and missing from a third.
 *
 * Returns the row's workflow run id so the caller can cancel an orphaned run
 * (admin deleting a user who already had a deletion pending).
 */
export async function hardDeleteUser(
  userId: string,
): Promise<{ deleted: boolean; previousRunId: string | null }> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, avatarUrl: true, deletionRunId: true },
  });
  if (!user) return { deleted: false, previousRunId: null };

  if (user.avatarUrl) {
    try {
      await deleteImage(user.avatarUrl);
    } catch {
      // Blob cleanup is best effort — a stranded image must never block the
      // user's account from actually being deleted.
    }
  }

  await db.delete(users).where(eq(users.id, userId));
  return { deleted: true, previousRunId: user.deletionRunId };
}

export async function getPendingDeletion(
  userId: string,
): Promise<PendingDeletion | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      deletionScheduledAt: true,
      deletionRequestedAt: true,
      deletionRequestId: true,
      deletionRunId: true,
    },
  });
  return user ? toPendingDeletion(user) : null;
}

export type MarkScheduledResult =
  | { ok: true; pending: PendingDeletion; alreadyScheduled: boolean }
  | { ok: false; reason: "not_found" };

/**
 * Write the pending-deletion record. Idempotent: an account that is already
 * pending keeps its original schedule rather than silently sliding the deadline
 * further out every time the endpoint is called.
 */
export async function markDeletionScheduled(params: {
  userId: string;
  delaySeconds?: number;
  now?: Date;
}): Promise<MarkScheduledResult> {
  const { userId, delaySeconds } = params;
  // Floor up front so `requestedAt` — the value we return and later compare
  // against — survives the round-trip through the whole-second column.
  const now = floorToSecond(params.now ?? new Date());

  const existingRow = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      deletionScheduledAt: true,
      deletionRequestedAt: true,
      deletionRequestId: true,
      deletionRunId: true,
    },
  });
  if (!existingRow) return { ok: false, reason: "not_found" };

  const existing = toPendingDeletion(existingRow);
  if (existing) {
    return { ok: true, pending: existing, alreadyScheduled: true };
  }

  const pending: PendingDeletion = {
    scheduledAt: computeDeletionScheduledAt(now, delaySeconds),
    requestedAt: now,
    requestId: crypto.randomUUID(),
    runId: null,
  };

  await db
    .update(users)
    .set({
      deletionScheduledAt: pending.scheduledAt,
      deletionRequestedAt: pending.requestedAt,
      deletionRequestId: pending.requestId,
      deletionRunId: null,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return { ok: true, pending, alreadyScheduled: false };
}

export type ClearScheduleResult =
  | { ok: true; cancelled: boolean; previousRunId: string | null }
  | { ok: false; reason: "not_found" };

export async function clearDeletionSchedule(
  userId: string,
): Promise<ClearScheduleResult> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      deletionScheduledAt: true,
      deletionRequestedAt: true,
      deletionRequestId: true,
      deletionRunId: true,
    },
  });
  if (!row) return { ok: false, reason: "not_found" };

  const existing = toPendingDeletion(row);
  if (!existing) return { ok: true, cancelled: false, previousRunId: null };

  await db
    .update(users)
    .set({
      deletionScheduledAt: null,
      deletionRequestedAt: null,
      deletionRequestId: null,
      deletionRunId: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { ok: true, cancelled: true, previousRunId: existing.runId };
}

/**
 * Record the workflow run id once `start()` has returned. Guarded by requestId so
 * a slow start() belonging to a schedule the user has since cancelled (or
 * replaced) cannot write its run id onto the current record.
 */
export async function attachDeletionRunId(params: {
  userId: string;
  requestId: string;
  runId: string;
}): Promise<void> {
  await db
    .update(users)
    .set({ deletionRunId: params.runId })
    .where(
      and(
        eq(users.id, params.userId),
        eq(users.deletionRequestId, params.requestId),
      ),
    );
}

/**
 * Execute a scheduled deletion — the only path the workflow and the sweep use.
 *
 * The guard lives in the WHERE clause rather than in an `if` after a read, so
 * there is no window between deciding and deleting. All three conditions matter:
 *
 *  - `deletion_request_id = requestId` — this run still owns the schedule. This
 *    is what makes schedule -> cancel -> re-schedule safe: a stale run from the
 *    first schedule wakes up, finds a different id, and does nothing. Without it
 *    that run would delete an account whose deletion had been moved later.
 *  - `deletion_scheduled_at IS NOT NULL` — not cancelled.
 *  - `deletion_scheduled_at <= now` — never delete ahead of the advertised date.
 */
export async function finalizeScheduledDeletion(params: {
  userId: string;
  requestId: string;
  now?: Date;
}): Promise<{ deleted: boolean; reason?: FinalizeReason }> {
  const { userId, requestId } = params;
  const now = params.now ?? new Date();

  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      avatarUrl: true,
      deletionScheduledAt: true,
      deletionRequestId: true,
    },
  });

  if (!row) return { deleted: false, reason: "not_found" };
  if (!row.deletionScheduledAt) return { deleted: false, reason: "cancelled" };
  if (row.deletionRequestId !== requestId) {
    return { deleted: false, reason: "superseded" };
  }
  if (row.deletionScheduledAt > now) return { deleted: false, reason: "not_due" };

  const deleted = await db
    .delete(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.deletionRequestId, requestId),
        isNotNull(users.deletionScheduledAt),
        lte(users.deletionScheduledAt, now),
      ),
    )
    .returning({ id: users.id });

  if (deleted.length === 0) {
    // Lost a race with a cancel between the read and the delete.
    return { deleted: false, reason: "cancelled" };
  }

  if (row.avatarUrl) {
    try {
      await deleteImage(row.avatarUrl);
    } catch {
      // Best effort, as in hardDeleteUser.
    }
  }

  return { deleted: true };
}

/**
 * Safety net for runs that never fired — a lost workflow run, or a schedule
 * written while the workflow runtime was unavailable. Without this a user who
 * asked to be deleted could be retained indefinitely.
 *
 * `graceSeconds` lets the workflow win the normal race, so the sweep only ever
 * picks up genuinely missed runs.
 */
export async function sweepOverdueDeletions(params?: {
  limit?: number;
  graceSeconds?: number;
  now?: Date;
}): Promise<{ deleted: string[]; skipped: string[] }> {
  const limit = params?.limit ?? 100;
  const graceSeconds = params?.graceSeconds ?? 300;
  const now = params?.now ?? new Date();
  const cutoff = new Date(now.getTime() - graceSeconds * 1000);

  const overdue = await db
    .select({
      id: users.id,
      requestId: users.deletionRequestId,
    })
    .from(users)
    .where(
      and(isNotNull(users.deletionScheduledAt), lte(users.deletionScheduledAt, cutoff)),
    )
    .limit(limit);

  const deleted: string[] = [];
  const skipped: string[] = [];

  for (const row of overdue) {
    if (!row.requestId) {
      skipped.push(row.id);
      continue;
    }
    // Same guarded path the workflow uses — a row cancelled since the select
    // above is never touched.
    const result = await finalizeScheduledDeletion({
      userId: row.id,
      requestId: row.requestId,
      now,
    });
    (result.deleted ? deleted : skipped).push(row.id);
  }

  return { deleted, skipped };
}
