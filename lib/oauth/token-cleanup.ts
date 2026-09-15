import { and, inArray, isNotNull, lt, or, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  emailVerificationTokens,
  oauthRefreshTokens,
  passwordResetTokens,
} from "@/lib/db/schema";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

/**
 * Periodic purge of tokens that can no longer authenticate anyone.
 *
 * These tables are append-heavy and nothing else prunes them: every sign-in
 * mints a refresh token, and rotation revokes the old one rather than deleting
 * it. The production database had 36k refresh tokens of which only 1k were
 * live, so without this the table grows without bound.
 *
 * NOTE: admin "Signed-in applications" (lib/admin/sign-in-history.ts) reads
 * oauth_refresh_tokens *without* filtering revoked or expired rows, so purging
 * shrinks a user's visible sign-in history down to their active sessions. That
 * is the intended trade-off; raise TOKEN_RETENTION_SECONDS to keep more of it.
 */

/** Rows are deleted this long *after* they expire. 0 means "as soon as expired". */
export const DEFAULT_TOKEN_RETENTION_SECONDS = 0;

/**
 * Rows per DELETE. Keeps a first run over a large backlog off a single
 * long-held lock, and bounds how much work one invocation can do.
 */
const DELETE_BATCH_SIZE = 1_000;

/** Ceiling per table per run, so one invocation can't run past the timeout. */
const DEFAULT_MAX_ROWS_PER_TABLE = 20_000;

export interface PurgeExpiredTokensResult {
  refreshTokens: number;
  emailVerificationTokens: number;
  passwordResetTokens: number;
}

/** Read the retention window from the environment, falling back to the default. */
export function resolveRetentionSeconds(
  value: string | undefined,
): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_TOKEN_RETENTION_SECONDS;
  }
  const parsed = Number(value);
  // A bad value must not silently turn into an aggressive purge.
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_TOKEN_RETENTION_SECONDS;
  }
  return Math.floor(parsed);
}

/**
 * Delete rows matching `condition` in batches.
 *
 * The subquery is what gives DELETE a LIMIT, which Postgres has no direct
 * syntax for.
 */
async function purgeInBatches(
  table: PgTable,
  idColumn: PgColumn,
  condition: SQL,
  maxRows: number,
): Promise<number> {
  let removed = 0;

  while (removed < maxRows) {
    const batchSize = Math.min(DELETE_BATCH_SIZE, maxRows - removed);
    const doomed = db
      .select({ id: idColumn })
      .from(table)
      .where(condition)
      .limit(batchSize);

    const deleted = await db
      .delete(table)
      .where(inArray(idColumn, doomed))
      .returning({ id: idColumn });

    removed += deleted.length;
    // A short batch means the condition is exhausted.
    if (deleted.length < batchSize) break;
  }

  return removed;
}

export async function purgeExpiredTokens(params?: {
  now?: Date;
  retentionSeconds?: number;
  maxRowsPerTable?: number;
}): Promise<PurgeExpiredTokensResult> {
  const now = params?.now ?? new Date();
  const retentionSeconds =
    params?.retentionSeconds ?? DEFAULT_TOKEN_RETENTION_SECONDS;
  const maxRows = params?.maxRowsPerTable ?? DEFAULT_MAX_ROWS_PER_TABLE;
  const cutoff = new Date(now.getTime() - retentionSeconds * 1000);

  // `expires_at` is nullable and NULL means "never expires", so the comparison
  // has to be the thing that matches — `lt(null, cutoff)` is NULL, never true,
  // which is exactly the behaviour a non-expiring token needs.
  const refreshTokens = await purgeInBatches(
    oauthRefreshTokens,
    oauthRefreshTokens.id,
    or(
      lt(oauthRefreshTokens.expiresAt, cutoff),
      and(isNotNull(oauthRefreshTokens.revokedAt), lt(oauthRefreshTokens.revokedAt, cutoff)),
    )!,
    maxRows,
  );

  const emailTokens = await purgeInBatches(
    emailVerificationTokens,
    emailVerificationTokens.id,
    lt(emailVerificationTokens.expiresAt, cutoff),
    maxRows,
  );

  const resetTokens = await purgeInBatches(
    passwordResetTokens,
    passwordResetTokens.id,
    or(
      lt(passwordResetTokens.expiresAt, cutoff),
      and(isNotNull(passwordResetTokens.usedAt), lt(passwordResetTokens.usedAt, cutoff)),
    )!,
    maxRows,
  );

  return {
    refreshTokens,
    emailVerificationTokens: emailTokens,
    passwordResetTokens: resetTokens,
  };
}
