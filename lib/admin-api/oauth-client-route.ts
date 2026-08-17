import type { NextRequest } from "next/server";
import type { OAuthClientReadAuthorization } from "@/lib/admin-api/authorize";
import type { OAuthClientListResult } from "@/lib/admin-api/oauth-clients";
import type { ReadOAuthClientsAccess } from "@/lib/admin-api/permissions";
import { parseOAuthClientPagination } from "@/lib/admin-api/oauth-client-query";

interface OAuthClientRouteDependencies {
  authorize: (
    request: NextRequest,
  ) => Promise<OAuthClientReadAuthorization>;
  list: (params: {
    access: Exclude<ReadOAuthClientsAccess, { scope: "none" }>;
    page: number;
    pageSize: number;
    keyword?: string;
  }) => Promise<OAuthClientListResult>;
}

export async function handleOAuthClientListRequest(
  request: NextRequest,
  dependencies: OAuthClientRouteDependencies,
  options: { requireKeyword?: boolean } = {},
): Promise<Response> {
  let authorization: OAuthClientReadAuthorization;
  try {
    authorization = await dependencies.authorize(request);
  } catch (error) {
    console.error("Authorize OAuth client API request error:", error);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  if (!authorization.ok) return authorization.response;

  const url = new URL(request.url);
  const { page, pageSize } = parseOAuthClientPagination(url.searchParams);
  const keyword = url.searchParams.get("keyword")?.trim();

  if (options.requireKeyword && !keyword) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: "keyword is required",
      },
      { status: 400 },
    );
  }

  try {
    const result = await dependencies.list({
      access: authorization.access,
      page,
      pageSize,
      ...(keyword ? { keyword } : {}),
    });

    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("List OAuth clients API error:", error);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
