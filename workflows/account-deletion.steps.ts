import { finalizeScheduledDeletion } from "@/lib/account/deletion";

/**
 * Step wrapper for the scheduled-deletion finalizer.
 *
 * This lives in its own file so the `@/lib/db` -> `pg` -> Node builtins import
 * chain is never reachable from the workflow bundle: the SWC plugin strips step
 * bodies, but keeping the import out of the orchestrator module entirely is the
 * durable version of that guarantee.
 */
export async function finalizeScheduledDeletionStep(
  userId: string,
  requestId: string,
) {
  "use step";
  return finalizeScheduledDeletion({ userId, requestId });
}
