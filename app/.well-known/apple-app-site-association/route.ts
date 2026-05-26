import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { oauthClientAppIds } from "@/lib/db/schema";
import { buildAASA } from "@/lib/aasa/build-aasa";

export const dynamic = "force-dynamic";

export async function GET() {
  const rpId = process.env.WEBAUTHN_RP_ID;
  if (process.env.NODE_ENV === "production" && (!rpId || rpId === "localhost")) {
    console.warn(
      "[AASA] WEBAUTHN_RP_ID is unset or 'localhost' in production; passkey domain binding will not work for native apps."
    );
  }

  const rows = await db
    .select({ appId: oauthClientAppIds.appId })
    .from(oauthClientAppIds);

  const aasa = buildAASA(rows.map((r) => r.appId));

  return NextResponse.json(aasa, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
    },
  });
}
