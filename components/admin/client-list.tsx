"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientCard } from "@/components/admin/client-card";
import type { OAuthClient } from "@/lib/db/schema";

interface ClientListProps {
  clients: OAuthClient[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

function buildPageUrl(
  searchParams: URLSearchParams,
  page: number,
  pageSize: number
) {
  const params = new URLSearchParams(searchParams);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return `?${params.toString()}`;
}

export function ClientList({
  clients,
  page,
  pageSize,
  totalCount,
  totalPages,
}: ClientListProps) {
  const searchParams = useSearchParams();

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
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

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between pt-4"
              data-testid="pagination-controls"
            >
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, totalCount)} of {totalCount} clients
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href={buildPageUrl(searchParams, 1, pageSize)}
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
                  href={buildPageUrl(searchParams, page - 1, pageSize)}
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
                  href={buildPageUrl(searchParams, page + 1, pageSize)}
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
                  href={buildPageUrl(searchParams, totalPages, pageSize)}
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
              Showing {totalCount} {totalCount === 1 ? "client" : "clients"}
            </div>
          )}
        </>
      )}
    </div>
  );
}
