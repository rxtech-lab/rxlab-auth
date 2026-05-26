import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { buildSigninSchema, type OAuthClientLite } from "@/lib/ui-schema/build";

// GET /api/auth/ui-schema/signin?client_id=<id>
//
// Public endpoint. Returns a JSON description of the sign-in form so native
// clients (e.g. RxAuthSwift on macOS) can render the UI without re-shipping.
// `client_id` is optional; if omitted we return a sane default schema.
// Unknown `client_id` → 404.
export async function GET(request: NextRequest) {
  const clientId = new URL(request.url).searchParams.get("client_id");

  let client: OAuthClientLite | null = null;
  if (clientId) {
    const row = await db.query.oauthClients.findFirst({
      where: eq(oauthClients.id, clientId),
    });
    if (!row) {
      return NextResponse.json(
        { error: "invalid_client", error_description: "Client not found" },
        { status: 404 },
      );
    }
    client = {
      id: row.id,
      name: row.name,
      signInPermission: row.signInPermission,
    };
  }

  return NextResponse.json(buildSigninSchema({ client }));
}
