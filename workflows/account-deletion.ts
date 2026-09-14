import { sleep } from "workflow";
import { finalizeScheduledDeletionStep } from "./account-deletion.steps";

export interface ScheduledAccountDeletionInput {
  userId: string;
  /** Fencing token — see finalizeScheduledDeletion in lib/account/deletion.ts. */
  requestId: string;
  /** Absolute UTC instant to wake at, computed by the caller. */
  scheduledForIso: string;
}

/**
 * Sleeps out the grace period, then asks the database whether this deletion
 * should still happen.
 *
 * Everything non-deterministic is computed by the caller and passed in: no
 * `Date.now()`, no `randomUUID()`, no db access in this body. Sleeping until an
 * absolute instant rather than for a relative duration also means a later change
 * to ACCOUNT_DELETION_DELAY_SECONDS cannot move an already-running sleep.
 */
export async function scheduledAccountDeletionWorkflow(
  input: ScheduledAccountDeletionInput,
) {
  "use workflow";

  await sleep(new Date(input.scheduledForIso));

  return finalizeScheduledDeletionStep(input.userId, input.requestId);
}
