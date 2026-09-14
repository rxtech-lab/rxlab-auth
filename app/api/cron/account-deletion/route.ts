import { NextRequest, NextResponse } from "next/server";
import { sweepOverdueDeletions } from "@/lib/account/deletion";

/**
 * Safety net for scheduled deletions whose workflow run never fired — a lost or
 * cancelled-by-accident run, a world outage, or a schedule written while the
 * workflow runtime was unavailable (see deletion-scheduler.ts).
 *
 * Without this, a user who asked to be deleted could be retained indefinitely,
 * which is both a broken promise and a data-protection problem.
 *
 * Runs hourly via vercel.json. The 5-minute grace means the workflow wins the
 * normal race and this only ever picks up genuinely missed runs.
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
    console.error("CRON_SECRET is not configured; refusing to run the sweep");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const header = request.headers.get("Authorization");
  const provided = header?.startsWith("Bearer ") ? header.substring(7) : "";
  if (!secretMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sweepOverdueDeletions();

    if (result.deleted.length > 0) {
      // Worth a log line: every entry here is a workflow run that did not fire.
      console.warn(
        `Account deletion sweep finalized ${result.deleted.length} overdue account(s)`,
      );
    }

    return NextResponse.json({
      deleted: result.deleted.length,
      skipped: result.skipped.length,
    });
  } catch (error) {
    console.error("Account deletion sweep error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
