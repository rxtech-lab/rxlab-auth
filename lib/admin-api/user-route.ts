import type { NextRequest } from "next/server";
import type { UserReadAuthorization } from "@/lib/admin-api/authorize";
import type { AdminUserListResult } from "@/lib/admin-api/users";
import {
  MAX_ADMIN_API_KEYWORD_LENGTH,
  parseAdminApiPagination,
} from "@/lib/admin-api/query";

interface UserRouteDependencies {
  authorize: (request: NextRequest) => Promise<UserReadAuthorization>;
  list: (params: {
    page: number;
    pageSize: number;
    keyword?: string;
  }) => Promise<AdminUserListResult>;
}

export async function handleUserListRequest(
  request: NextRequest,
  dependencies: UserRouteDependencies,
): Promise<Response> {
  let authorization: UserReadAuthorization;
  try {
    authorization = await dependencies.authorize(request);
  } catch (error) {
    console.error("Authorize user list API request error:", error);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  if (!authorization.ok) return authorization.response;

  const url = new URL(request.url);
  const { page, pageSize } = parseAdminApiPagination(url.searchParams);
  const keyword = url.searchParams.get("keyword")?.trim();

  if (keyword && keyword.length > MAX_ADMIN_API_KEYWORD_LENGTH) {
    return Response.json(
      {
        error: "invalid_request",
        error_description: `keyword must be ${MAX_ADMIN_API_KEYWORD_LENGTH} characters or fewer`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await dependencies.list({
      page,
      pageSize,
      ...(keyword ? { keyword } : {}),
    });

    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("List users API error:", error);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
