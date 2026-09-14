/**
 * Grace period configuration for delayed account deletion.
 *
 * Seconds rather than a duration string because every consumer needs the number
 * for `Date` math — the workflow sleeps until an absolute instant, so parsing a
 * duration in two places would just be two chances to disagree.
 */

export const DEFAULT_ACCOUNT_DELETION_DELAY_SECONDS = 7 * 24 * 60 * 60; // 604800

/** A typo must not be able to create a row nothing will ever delete. */
export const MAX_ACCOUNT_DELETION_DELAY_SECONDS = 365 * 24 * 60 * 60;

/**
 * Read at call time, never at module load, so tests (and E2E, which sets this to
 * a couple of seconds) can change it without re-importing the module.
 */
export function getAccountDeletionDelaySeconds(): number {
  const raw = process.env.ACCOUNT_DELETION_DELAY_SECONDS;
  if (!raw) return DEFAULT_ACCOUNT_DELETION_DELAY_SECONDS;

  // Reject anything that isn't a clean non-negative integer: "1.5", "abc", "-1"
  // and "" all fall back rather than silently producing a nonsense schedule.
  if (!/^\d+$/.test(raw.trim())) return DEFAULT_ACCOUNT_DELETION_DELAY_SECONDS;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_ACCOUNT_DELETION_DELAY_SECONDS;

  return Math.min(parsed, MAX_ACCOUNT_DELETION_DELAY_SECONDS);
}

/**
 * Drop sub-second precision.
 *
 * Drizzle's `integer({ mode: "timestamp" })` persists `Math.floor(ms / 1000)`,
 * so anything finer is lost on the round-trip. Flooring before we store means
 * the instant an API response advertises is byte-for-byte the instant a later
 * read returns — otherwise scheduling replies with `…:08.619Z` and every
 * subsequent read says `…:08.000Z`.
 */
export function floorToSecond(value: Date): Date {
  return new Date(Math.floor(value.getTime() / 1000) * 1000);
}

/** The absolute instant a deletion requested `now` should execute. */
export function computeDeletionScheduledAt(
  now: Date = new Date(),
  delaySeconds: number = getAccountDeletionDelaySeconds(),
): Date {
  return floorToSecond(new Date(now.getTime() + delaySeconds * 1000));
}
