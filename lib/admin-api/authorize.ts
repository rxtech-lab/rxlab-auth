import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireBearerToken } from "@/lib/oauth/bearer";
import {
  READ_OAUTH_CLIENTS_PERMISSION,
  READ_USERS_PERMISSION,
  getReadOAuthClientsAccess,
  hasReadUsersPermission,
  parseStoredAdminApiPermissions,
  type ReadOAuthClientsAccess,
} from "@/lib/admin-api/permissions";

type AdminApiPermissionAuthorization =
  | { ok: true; permissions: string[] }
  | { ok: false; response: NextResponse };

async function authorizeAdminApiPermissionRequest(
  request: NextRequest,
): Promise<AdminApiPermissionAuthorization> {
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

  return {
    ok: true,
    permissions: parseStoredAdminApiPermissions(user.adminApiPermissions),
  };
}

export type OAuthClientReadAuthorization =
  | { ok: true; access: Exclude<ReadOAuthClientsAccess, { scope: "none" }> }
  | { ok: false; response: NextResponse };

export async function authorizeOAuthClientReadRequest(
  request: NextRequest,
): Promise<OAuthClientReadAuthorization> {
  const authorization = await authorizeAdminApiPermissionRequest(request);
  if (!authorization.ok) return authorization;

  const access = getReadOAuthClientsAccess(
    authorization.permissions,
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

export type UserReadAuthorization =
  | { ok: true }
  | { ok: false; response: NextResponse };

export async function authorizeUserReadRequest(
  request: NextRequest,
): Promise<UserReadAuthorization> {
  const authorization = await authorizeAdminApiPermissionRequest(request);
  if (!authorization.ok) return authorization;

  if (!hasReadUsersPermission(authorization.permissions)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "insufficient_permission",
          error_description: `Requires ${READ_USERS_PERMISSION.key}`,
          required_permission: READ_USERS_PERMISSION.key,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true };
}
