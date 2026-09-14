import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { ClientCard } from "@/components/admin/client-card";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { PageHeader } from "@/components/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  buildQueryString,
  parsePageParam,
  parsePageSizeParam,
  resolvePagination,
} from "@/lib/admin/pagination";

export const metadata = {
  title: "OAuth Clients - Admin",
  description: "Manage OAuth client applications",
};

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const requestedPage = parsePageParam(params.page);
  const pageSize = parsePageSizeParam(params.pageSize);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(oauthClients);

  const pagination = resolvePagination({
    totalCount: count,
    requestedPage,
    pageSize,
  });

  const hrefForPage = (page: number) =>
    `/admin/dashboard/clients${buildQueryString({ page, pageSize })}`;

  // A page past the end would otherwise render an empty list at a URL the user
  // could bookmark; send them to the last real page instead.
  if (pagination.wasClamped) {
    redirect(hrefForPage(pagination.page));
  }

  const clients = await db
    .select()
    .from(oauthClients)
    .orderBy(desc(oauthClients.createdAt))
    .limit(pagination.pageSize)
    .offset(pagination.offset);

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
          <div className="space-y-4" data-testid="client-list">
            {clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No OAuth clients registered yet.</p>
                <p className="text-sm">
                  Create your first client to enable OAuth authentication.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {clients.map((client) => (
                    <ClientCard
                      key={client.id}
                      client={{
                        id: client.id,
                        name: client.name,
                        description: client.description,
                        iconUrl: client.iconUrl,
                        isFirstParty: client.isFirstParty ?? false,
                        createdAt: client.createdAt,
                      }}
                    />
                  ))}
                </div>

                <PaginationControls
                  pagination={pagination}
                  hrefForPage={hrefForPage}
                  itemLabel="client"
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
