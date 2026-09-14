import { getRun, start } from "workflow/api";
import {
  attachDeletionRunId,
  clearDeletionSchedule,
  hardDeleteUser,
  markDeletionScheduled,
  type DeletionActor,
  type PendingDeletion,
} from "@/lib/account/deletion";
import { scheduledAccountDeletionWorkflow } from "@/workflows/account-deletion";

/**
 * The workflow-aware facade over lib/account/deletion.ts, and the only module in
 * the app that imports `workflow/api`. Routes and server actions call in here.
 *
 * Invariant throughout: **the database row is the source of truth, the workflow
 * run is an optimisation.** Every operation writes the DB first and treats the
 * workflow call as best effort, because the alternative — letting a remote
 * system's availability decide whether a deletion is scheduled or cancelled —
 * puts irreversible account loss on the wrong side of a network call.
 */

/** Best-effort cancel of a pending run. Never allowed to fail the caller. */
async function cancelRunQuietly(runId: string | null): Promise<void> {
  if (!runId) return;
  try {
    await getRun(runId).cancel();
  } catch (error) {
    // The run is only a timer; the DB guard in finalizeScheduledDeletion means a
    // surviving run wakes up and no-ops. Losing this call costs nothing but a
    // stale entry in the Workflow dashboard.
    console.error("Failed to cancel account deletion workflow run:", error);
  }
}

export interface ScheduleAccountDeletionResult {
  ok: true;
  pending: PendingDeletion;
  alreadyScheduled: boolean;
  /** False when the workflow runtime was unavailable — the cron sweep covers it. */
  workflowStarted: boolean;
}

export async function scheduleAccountDeletion(params: {
  userId: string;
  actor: DeletionActor;
  delaySeconds?: number;
}): Promise<ScheduleAccountDeletionResult | { ok: false; reason: "not_found" }> {
  const marked = await markDeletionScheduled({
    userId: params.userId,
    delaySeconds: params.delaySeconds,
  });
  if (!marked.ok) return marked;

  // Already pending: keep the original schedule and its existing run rather than
  // starting a second timer against the same account.
  if (marked.alreadyScheduled) {
    return {
      ok: true,
      pending: marked.pending,
      alreadyScheduled: true,
      workflowStarted: marked.pending.runId !== null,
    };
  }

  let workflowStarted = false;
  try {
    const run = await start(scheduledAccountDeletionWorkflow, [
      {
        userId: params.userId,
        requestId: marked.pending.requestId,
        scheduledForIso: marked.pending.scheduledAt.toISOString(),
      },
    ]);
    await attachDeletionRunId({
      userId: params.userId,
      requestId: marked.pending.requestId,
      runId: run.runId,
    });
    marked.pending.runId = run.runId;
    workflowStarted = true;
  } catch (error) {
    // Deliberately swallowed. The schedule is already committed to the database,
    // so the request succeeds and /api/cron/account-deletion finalizes it. A
    // missing workflow runtime (local dev without the transform, CI, a world
    // outage) must not make "delete my account" fail.
    console.error(
      `Failed to start account deletion workflow for ${params.userId} (actor: ${params.actor}); the cron sweep will finalize it:`,
      error,
    );
  }

  return {
    ok: true,
    pending: marked.pending,
    alreadyScheduled: false,
    workflowStarted,
  };
}

export async function cancelAccountDeletion(params: {
  userId: string;
  actor: DeletionActor;
}): Promise<{ ok: true; cancelled: boolean } | { ok: false; reason: "not_found" }> {
  const cleared = await clearDeletionSchedule(params.userId);
  if (!cleared.ok) return cleared;

  await cancelRunQuietly(cleared.previousRunId);
  return { ok: true, cancelled: cleared.cancelled };
}

/** Immediate, irreversible delete. Admin-only at every call site. */
export async function hardDeleteAccount(params: {
  userId: string;
  actor: DeletionActor;
}): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const result = await hardDeleteUser(params.userId);
  if (!result.deleted) return { ok: false, reason: "not_found" };

  // The user may have had a deletion pending; free its timer.
  await cancelRunQuietly(result.previousRunId);
  return { ok: true };
}
