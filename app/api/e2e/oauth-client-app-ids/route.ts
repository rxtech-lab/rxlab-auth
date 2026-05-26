import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { oauthClientAppIds, oauthClients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// E2E-only: seed Apple app IDs for an OAuth client without going through admin UI.
// Mirrors the pattern in app/api/e2e/password-reset-token/route.ts.

function e2eGuard() {
  if (process.env.E2E_SKIP_EMAIL_VERIFICATION !== "true") {
    return NextResponse.json(
      { error: "This endpoint is only available in E2E test mode" },
      { status: 403 }
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  const blocked = e2eGuard();
  if (blocked) return blocked;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.clientId !== "string" || !Array.isArray(body.appIds)) {
    return NextResponse.json(
      { error: "Expected { clientId: string, appIds: string[] }" },
      { status: 400 }
    );
  }

  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, body.clientId),
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const now = new Date();
  for (const rawAppId of body.appIds) {
    if (typeof rawAppId !== "string") continue;
    const appId = rawAppId.trim();
    if (!appId) continue;
    await db
      .insert(oauthClientAppIds)
      .values({
        id: crypto.randomUUID(),
        clientId: body.clientId,
        appId,
        createdAt: now,
      })
      .onConflictDoNothing();
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const blocked = e2eGuard();
  if (blocked) return blocked;

  await db.delete(oauthClientAppIds);
  return NextResponse.json({ ok: true });
}
