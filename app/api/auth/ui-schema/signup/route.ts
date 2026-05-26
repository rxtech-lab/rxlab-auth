import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { getSignUpStatus } from "@/lib/settings/sign-up";
import { buildSignupSchema, type OAuthClientLite } from "@/lib/ui-schema/build";

// GET /api/auth/ui-schema/signup?client_id=<id>
//
// Public endpoint. Returns a JSON description of the sign-up form. Mirrors
// /signin but the supportedMethods list is gated on the global sign-up
// settings (see lib/settings/sign-up.ts): when sign-up is fully disabled the
// methods list is empty so the client can render its own "sign-up closed" UI
// without hard-coding the rule.
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

  const status = await getSignUpStatus();
  // Without a candidate email we can't evaluate the whitelist, so treat
  // whitelist-enabled as "sign-up is open at the form level" — the actual
  // gate runs at POST /api/oauth/signup.
  const signUpAllowed = !status.isCompletelyDisabled;

  // The iOS 26 / macOS 26 system-sheet account-creation endpoints
  // (POST /api/oauth/passkey/account-creation/{options,verify}) are always
  // available — feature-gate at the schema level so non-Apple clients that
  // never call them simply ignore the entry.
  const accountCreationEnabled =
    process.env.UI_SCHEMA_PASSKEY_ACCOUNT_CREATION !== "false";

  return NextResponse.json(
    buildSignupSchema({ client, signUpAllowed, accountCreationEnabled }),
  );
}
