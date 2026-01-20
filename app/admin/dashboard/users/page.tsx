import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard";
import { UserList } from "@/components/admin/user-list";

export const metadata = {
  title: "Users - Admin",
  description: "Manage user accounts",
};

const PAGE_SIZE = 20;

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.getTime(), id })
  ).toString("base64");
}

export default async function UsersPage() {
  // Fetch total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  // Fetch first page
  const userList = await db.query.users.findMany({
    orderBy: [desc(users.createdAt), desc(users.id)],
    limit: PAGE_SIZE + 1,
  });

  const hasMore = userList.length > PAGE_SIZE;
  const displayUsers = hasMore ? userList.slice(0, PAGE_SIZE) : userList;

  const lastUser = displayUsers[displayUsers.length - 1];
  const nextCursor =
    hasMore && lastUser ? encodeCursor(lastUser.createdAt, lastUser.id) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${count} registered ${count === 1 ? "user" : "users"}`}
      />

      <UserList
        initialUsers={displayUsers}
        initialCursor={nextCursor}
        totalCount={count}
      />
    </div>
  );
}
