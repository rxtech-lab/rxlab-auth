import { NextRequest } from "next/server";
import { authorizeOAuthClientReadRequest } from "@/lib/admin-api/authorize";
import { listOAuthClients } from "@/lib/admin-api/oauth-clients";
import { handleOAuthClientListRequest } from "@/lib/admin-api/oauth-client-route";

export async function GET(request: NextRequest) {
  return handleOAuthClientListRequest(request, {
    authorize: authorizeOAuthClientReadRequest,
    list: listOAuthClients,
  });
}
