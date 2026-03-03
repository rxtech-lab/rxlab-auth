import Link from "next/link";
import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { ClientList } from "@/components/admin/client-list";
import { PageHeader } from "@/components/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata = {
  title: "OAuth Clients - Admin",
  description: "Manage OAuth client applications",
};

const DEFAULT_PAGE_SIZE = 20;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(parseInt(params.page ?? "1", 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(params.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 1),
    100
  );
  const offset = (page - 1) * pageSize;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(oauthClients);

  const totalPages = Math.max(Math.ceil(count / pageSize), 1);

  const clients = await db
    .select()
    .from(oauthClients)
    .orderBy(desc(oauthClients.createdAt))
    .limit(pageSize)
    .offset(offset);

  return (
    <div className="space-y-6">
      <PageHeader
        title="OAuth Clients"
        description="Manage your registered OAuth applications"
      >
        <Link href="/admin/dashboard/clients/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Client
          </Button>
        </Link>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <ClientList
            clients={clients}
            page={page}
            pageSize={pageSize}
            totalCount={count}
            totalPages={totalPages}
          />
        </CardContent>
      </Card>
    </div>
  );
}
