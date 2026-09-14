import { NextRequest, NextResponse } from "next/server";
import { requireBearerToken } from "@/lib/oauth/bearer";
import { grantsAccountDeletionScope } from "@/lib/scopes";
import { getPendingDeletion } from "@/lib/account/deletion";
import {
  cancelAccountDeletion,
  scheduleAccountDeletion,
} from "@/lib/account/deletion-scheduler";
import { toNumericDate } from "@/lib/account/deletion-status";

// Bearer-authenticated account deletion for native clients.
//
//   GET    -> status
//   POST   -> schedule
//   DELETE -> cancel
//
// Bodies use snake_case and NumericDate (epoch seconds) to match the rest of the
// /api/oauth surface — see lib/account/deletion-status.ts for why this differs
// from the camelCase/ISO shape on /api/auth/account-deletion.

interface Authorized {
  userId: string;
  scopes: string[];
}

async function authorize(
  request: NextRequest,
  { requireWrite }: { requireWrite: boolean },
): Promise<{ ok: true; auth: Authorized } | { ok: false; response: NextResponse }> {
  const bearer = await requireBearerToken(request);
  if (!bearer.ok) return { ok: false, response: bearer.response };

  const userId = bearer.payload.sub;
  if (typeof userId !== "string" || !userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_token", error_description: "Token has no subject" },
        { status: 401 },
      ),
    };
  }

  const scopes =
    typeof bearer.payload.scope === "string"
      ? bearer.payload.scope.split(" ").filter(Boolean)
      : [];

  // Reading your own deletion status needs no extra scope: a client must always
  // be able to warn the user that their account is about to disappear.
  if (requireWrite && !grantsAccountDeletionScope(scopes)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "insufficient_scope",
          error_description:
            "Managing account deletion requires the write:profile scope",
          scope: "write:profile",
        },
        {
          status: 403,
          headers: { "WWW-Authenticate": 'Bearer error="insufficient_scope"' },
        },
      ),
    };
  }

  return { ok: true, auth: { userId, scopes } };
}

function serverError(error: unknown, message: string): NextResponse {
  console.error(message, error);
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const authorized = await authorize(request, { requireWrite: false });
    if (!authorized.ok) return authorized.response;

    const pending = await getPendingDeletion(authorized.auth.userId);

    return NextResponse.json({
      deletion_pending: pending !== null,
      deletion_scheduled_at: toNumericDate(pending?.scheduledAt ?? null),
      deletion_requested_at: toNumericDate(pending?.requestedAt ?? null),
    });
  } catch (error) {
    return serverError(error, "OAuth account deletion status error:");
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorized = await authorize(request, { requireWrite: true });
    if (!authorized.ok) return authorized.response;

    const result = await scheduleAccountDeletion({
      userId: authorized.auth.userId,
      actor: "user",
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: "invalid_token", error_description: "User not found" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      deletion_pending: true,
      already_scheduled: result.alreadyScheduled,
      deletion_scheduled_at: toNumericDate(result.pending.scheduledAt),
      deletion_requested_at: toNumericDate(result.pending.requestedAt),
    });
  } catch (error) {
    return serverError(error, "OAuth schedule account deletion error:");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authorized = await authorize(request, { requireWrite: true });
    if (!authorized.ok) return authorized.response;

    const result = await cancelAccountDeletion({
      userId: authorized.auth.userId,
      actor: "user",
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: "invalid_token", error_description: "User not found" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      deletion_pending: false,
      cancelled: result.cancelled,
      deletion_scheduled_at: null,
      deletion_requested_at: null,
    });
  } catch (error) {
    return serverError(error, "OAuth cancel account deletion error:");
  }
}
