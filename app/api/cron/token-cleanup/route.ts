import { NextRequest, NextResponse } from "next/server";
import {
  purgeExpiredTokens,
  resolveRetentionSeconds,
} from "@/lib/oauth/token-cleanup";

/**
 * Drops tokens that can no longer authenticate anyone — expired or revoked
 * refresh tokens, plus spent email-verification and password-reset tokens.
 *
 * Nothing else prunes these tables, so they grow with every sign-in. Runs
 * nightly via vercel.json.
 */

/** Length-safe comparison so the secret can't be probed a byte at a time. */
function secretMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.error("CRON_SECRET is not configured; refusing to run the purge");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const header = request.headers.get("Authorization");
  const provided = header?.startsWith("Bearer ") ? header.substring(7) : "";
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeExpiredTokens({
      retentionSeconds: resolveRetentionSeconds(
        process.env.TOKEN_RETENTION_SECONDS,
      ),
    });

    const total =
      result.refreshTokens +
      result.emailVerificationTokens +
      result.passwordResetTokens;
    if (total > 0) {
      console.log(
        `Token cleanup removed ${total} expired token(s): ` +
          `${result.refreshTokens} refresh, ` +
          `${result.emailVerificationTokens} email verification, ` +
          `${result.passwordResetTokens} password reset`,
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Token cleanup error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
