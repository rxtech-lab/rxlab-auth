import type { UserDeletionState } from "@/lib/db/schema";

/**
 * Serializers for the pending-deletion state.
 *
 * Two shapes on purpose. Cookie-authenticated JSON (`/api/auth/*`, the admin
 * API) uses camelCase + ISO-8601 UTC, which is what any `Date` already becomes
 * through `NextResponse.json`. OAuth/OIDC surfaces (`/api/oauth/*`) use
 * snake_case + NumericDate, matching `auth_time` in lib/oauth/issue-tokens.ts
 * and the OIDC convention its clients parse against.
 *
 * Pure — no `@/lib/db` import — so it unit-tests without mocks.
 */

export interface AccountDeletionStatus {
  pendingDeletion: boolean;
  deletionScheduledAt: string | null;
  deletionRequestedAt: string | null;
}

export interface OAuthAccountDeletionClaims {
  deletion_pending: boolean;
  deletion_scheduled_at: number | null;
  deletion_requested_at: number | null;
}

export function toUtcIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toNumericDate(value: Date | null | undefined): number | null {
  return value ? Math.floor(value.getTime() / 1000) : null;
}

export function buildAccountDeletionStatus(
  row: UserDeletionState,
): AccountDeletionStatus {
  return {
    // Always derived, never stored: one column decides, so the flag can't drift
    // out of sync with the timestamp.
    pendingDeletion: row.deletionScheduledAt !== null,
    deletionScheduledAt: toUtcIso(row.deletionScheduledAt),
    deletionRequestedAt: toUtcIso(row.deletionRequestedAt),
  };
}

export function buildOAuthAccountDeletionClaims(
  row: UserDeletionState,
): OAuthAccountDeletionClaims {
  return {
    deletion_pending: row.deletionScheduledAt !== null,
    deletion_scheduled_at: toNumericDate(row.deletionScheduledAt),
    deletion_requested_at: toNumericDate(row.deletionRequestedAt),
  };
}

/**
 * Column projection for drizzle `columns: {...}` selections, so every user-info
 * query that wants the deletion state stays in sync with the serializers.
 */
export const DELETION_STATE_COLUMNS = {
  deletionScheduledAt: true,
  deletionRequestedAt: true,
} as const;
