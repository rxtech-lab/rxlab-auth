import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireBearerToken } from "@/lib/oauth/bearer";
import {
  READ_OAUTH_CLIENTS_PERMISSION,
  getReadOAuthClientsAccess,
  parseStoredAdminApiPermissions,
  type ReadOAuthClientsAccess,
} from "@/lib/admin-api/permissions";

export type OAuthClientReadAuthorization =
  | { ok: true; access: Exclude<ReadOAuthClientsAccess, { scope: "none" }> }
  | { ok: false; response: NextResponse };

export async function authorizeOAuthClientReadRequest(
  request: NextRequest,
): Promise<OAuthClientReadAuthorization> {
  const bearer = await requireBearerToken(request);
  if (!bearer.ok) return bearer;

  if (typeof bearer.payload.sub !== "string") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "invalid_token",
          error_description: "Access token subject is missing",
        },
        { status: 401 },
      ),
    };
  }

  const user = await db.query.users.findFirst({
    columns: { adminApiPermissions: true },
    where: eq(users.id, bearer.payload.sub),
  });

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "invalid_token",
          error_description: "User not found",
        },
        { status: 401 },
      ),
    };
  }

  const access = getReadOAuthClientsAccess(
    parseStoredAdminApiPermissions(user.adminApiPermissions),
  );
  if (access.scope === "none") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "insufficient_permission",
          error_description: `Requires ${READ_OAUTH_CLIENTS_PERMISSION.key}:all or selected OAuth client IDs`,
          required_permission: READ_OAUTH_CLIENTS_PERMISSION.key,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, access };
}
