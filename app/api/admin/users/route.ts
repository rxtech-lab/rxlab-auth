import { NextRequest } from "next/server";
import { authorizeUserReadRequest } from "@/lib/admin-api/authorize";
import { handleUserListRequest } from "@/lib/admin-api/user-route";
import { listAdminUsers } from "@/lib/admin-api/users";

export async function GET(request: NextRequest) {
  return handleUserListRequest(request, {
    authorize: authorizeUserReadRequest,
    list: listAdminUsers,
  });
}
