import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { oauthClients, oauthClientRoles, users } from "@/lib/db/schema";
import { asc, count, desc, ilike, or } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard";
import { UserList } from "@/components/admin/user-list";
import type { UserRoleOptionApp } from "@/components/admin/user-role-assignments";
import {
  buildQueryString,
  parsePageParam,
  resolvePagination,
} from "@/lib/admin/pagination";

export const metadata = {
  title: "Users - Admin",
  description: "Manage user accounts",
};

const PAGE_SIZE = 20;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const requestedPage = parsePageParam(params.page);

  // Both the page and the query live in the URL, so a refresh, a bookmark, or
  // the back button restore the same view — and a colleague can be sent a link
  // to a specific search result.
  const searchCondition = search
    ? or(
        ilike(users.email, `%${search}%`),
        ilike(users.username, `%${search}%`),
        ilike(users.displayName, `%${search}%`),
      )
    : undefined;

  const [{ count: filteredCount }] = await db
    .select({ count: count() })
    .from(users)
    .where(searchCondition);

  const pagination = resolvePagination({
    totalCount: filteredCount,
    requestedPage,
    pageSize: PAGE_SIZE,
  });

  const hrefForPage = (page: number) =>
    `/admin/dashboard/users${buildQueryString({ page: page === 1 ? undefined : page, q: search })}`;

  // Narrowing a search can leave you on a page that no longer exists; land on
  // the last real one rather than an empty list at a bookmarkable URL.
  if (pagination.wasClamped) {
    redirect(hrefForPage(pagination.page));
  }

  const userList = await db
    .select()
    .from(users)
    .where(searchCondition)
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(pagination.pageSize)
    .offset(pagination.offset);

  const clients = await db
    .select({
      id: oauthClients.id,
      name: oauthClients.name,
    })
    .from(oauthClients)
    .orderBy(asc(oauthClients.name));

  const roles = await db
    .select({
      id: oauthClientRoles.id,
      clientId: oauthClientRoles.clientId,
      key: oauthClientRoles.key,
      name: oauthClientRoles.name,
    })
    .from(oauthClientRoles)
    .orderBy(asc(oauthClientRoles.name));

  const rolesByClient = new Map<string, UserRoleOptionApp["roles"]>();
  for (const role of roles) {
    const clientRoles = rolesByClient.get(role.clientId) ?? [];
    clientRoles.push({
      id: role.id,
      key: role.key,
      name: role.name,
    });
    rolesByClient.set(role.clientId, clientRoles);
  }

  const roleOptions: UserRoleOptionApp[] = clients.map((client) => ({
    id: client.id,
    name: client.name,
    roles: rolesByClient.get(client.id) ?? [],
  }));

  // The count in the header is the unfiltered total; the filtered count belongs
  // with the rows it describes.
  const [{ count: totalUsers }] = search
    ? await db.select({ count: count() }).from(users)
    : [{ count: filteredCount }];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${totalUsers} registered ${totalUsers === 1 ? "user" : "users"}`}
      />

      <UserList
        users={userList}
        pagination={pagination}
        search={search}
        roleOptions={roleOptions}
      />
    </div>
  );
}
