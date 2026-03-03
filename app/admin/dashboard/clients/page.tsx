import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { oauthClients } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { ClientCard } from "@/components/admin/client-card";
import { PageHeader } from "@/components/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

export const metadata = {
  title: "OAuth Clients - Admin",
  description: "Manage OAuth client applications",
};

const DEFAULT_PAGE_SIZE = 20;

function buildPageUrl(page: number, pageSize: number) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return `?${params.toString()}`;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const rawPage = Math.max(parseInt(params.page ?? "1", 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(params.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 1),
    100
  );

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(oauthClients);

  const totalPages = Math.max(Math.ceil(count / pageSize), 1);
  const page = Math.min(rawPage, totalPages);

  if (page !== rawPage) {
    redirect(`/admin/dashboard/clients${buildPageUrl(page, pageSize)}`);
  }

  const offset = (page - 1) * pageSize;

  const clients = await db
    .select()
    .from(oauthClients)
    .orderBy(desc(oauthClients.createdAt))
    .limit(pageSize)
    .offset(offset);

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

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

                {totalPages > 1 && (
                  <div
                    className="flex items-center justify-between pt-4"
                    data-testid="pagination-controls"
                  >
                    <div className="text-sm text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1}–
                      {Math.min(page * pageSize, count)} of {count} clients
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href={buildPageUrl(1, pageSize)}
                        aria-disabled={!hasPrev}
                        tabIndex={hasPrev ? 0 : -1}
                        className={!hasPrev ? "pointer-events-none" : ""}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!hasPrev}
                          data-testid="first-page"
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link
                        href={buildPageUrl(page - 1, pageSize)}
                        aria-disabled={!hasPrev}
                        tabIndex={hasPrev ? 0 : -1}
                        className={!hasPrev ? "pointer-events-none" : ""}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!hasPrev}
                          data-testid="prev-page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </Link>
                      <span
                        className="px-3 text-sm text-muted-foreground"
                        data-testid="page-info"
                      >
                        Page {page} of {totalPages}
                      </span>
                      <Link
                        href={buildPageUrl(page + 1, pageSize)}
                        aria-disabled={!hasNext}
                        tabIndex={hasNext ? 0 : -1}
                        className={!hasNext ? "pointer-events-none" : ""}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!hasNext}
                          data-testid="next-page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link
                        href={buildPageUrl(totalPages, pageSize)}
                        aria-disabled={!hasNext}
                        tabIndex={hasNext ? 0 : -1}
                        className={!hasNext ? "pointer-events-none" : ""}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!hasNext}
                          data-testid="last-page"
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {totalPages <= 1 && (
                  <div className="text-center text-sm text-muted-foreground">
                    Showing {count} {count === 1 ? "client" : "clients"}
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
