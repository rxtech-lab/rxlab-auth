import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { matchRedirectUri } from "@/lib/oauth/redirect-uri";

type Client = typeof oauthClients.$inferSelect;

// Result of validating that a client is allowed to use native OAuth flows
// (password grant, native signup, native passkey routes).
//
// Mirrors the gate used in /api/oauth/token's password branch: first-party,
// open sign-in clients only. Returning a Response means the caller must
// short-circuit; returning a `client` means the request is allowed.
export type NativeClientCheck =
  | { ok: true; client: Client }
  | { ok: false; response: NextResponse };

export async function validateNativeClient(
  clientId: string,
): Promise<NativeClientCheck> {
  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, clientId),
  });
  if (!client) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_client", error_description: "Client not found" },
        { status: 401 },
      ),
    };
  }
  if (client.signInPermission !== "all") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "unauthorized_client",
          error_description:
            "Native flows are only available for first-party clients",
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, client };
}

// Validate that a client exists and that the supplied redirect_uri is one
// the client has registered. Used by passkey native routes — instead of
// requiring `signInPermission === "all"`, we trust the client's registered
// redirect-URI allow-list (same gate authorization_code already uses, see
// app/api/oauth/authorize/route.ts:78-87).
//
// On unknown client: 401 invalid_client.
// On missing or unregistered redirect_uri: 400 invalid_request.
export async function validateClientRedirect(params: {
  clientId: string;
  redirectUri: string | undefined;
}): Promise<NativeClientCheck> {
  const { clientId, redirectUri } = params;
  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, clientId),
  });
  if (!client) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_client", error_description: "Client not found" },
        { status: 401 },
      ),
    };
  }
  if (!redirectUri) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "invalid_request",
          error_description: "Invalid redirect_uri for client",
        },
        { status: 400 },
      ),
    };
  }
  const allowed: string[] = JSON.parse(client.redirectUris);
  if (!matchRedirectUri(redirectUri, allowed)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "invalid_request",
          error_description: "Invalid redirect_uri for client",
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, client };
}

// Resolve a requested-scope string against a client's allowed_scopes.
// Returns either the resolved scope array or a 400 response.
export function resolveRequestedScopes(
  scope: string | undefined,
  client: Client,
): { ok: true; scopes: string[] } | { ok: false; response: NextResponse } {
  const allowedScopes: string[] = JSON.parse(client.allowedScopes);
  if (!scope) {
    return { ok: true, scopes: allowedScopes };
  }
  const requestedScopes = scope.split(" ").filter(Boolean);
  const invalid = requestedScopes.filter((s) => !allowedScopes.includes(s));
  if (invalid.length > 0) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "invalid_scope",
          error_description: `Requested scope(s) not allowed: ${invalid.join(", ")}`,
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, scopes: requestedScopes };
}
