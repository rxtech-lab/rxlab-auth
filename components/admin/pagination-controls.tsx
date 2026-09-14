import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Pagination } from "@/lib/admin/pagination";

interface PaginationControlsProps {
  pagination: Pagination;
  /** Build the href for a page. Callers keep their own extra params (search,
   *  page size) in the URL by closing over them here. */
  hrefForPage: (page: number) => string;
  /** Singular noun for the row type, e.g. "client" — pluralised with an "s". */
  itemLabel: string;
}

/**
 * Page navigation for the admin list pages.
 *
 * Every control is a real `<Link>`, so the current page lives in the URL: a
 * refresh, a bookmark, or the back button all return to the same page. That is
 * also why this is a server component — there is no state to hold.
 */
export function PaginationControls({
  pagination,
  hrefForPage,
  itemLabel,
}: PaginationControlsProps) {
  const { page, totalPages, totalCount, hasPrev, hasNext, from, to } =
    pagination;

  // The prev/next hrefs are still rendered while disabled (so the control keeps
  // its shape), which would otherwise emit `?page=0` on the first page. Clamp
  // rather than emit a URL that doesn't exist.
  const href = (target: number) =>
    hrefForPage(Math.min(Math.max(target, 1), totalPages));

  if (totalPages <= 1) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        Showing {totalCount} {totalCount === 1 ? itemLabel : `${itemLabel}s`}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between pt-4"
      data-testid="pagination-controls"
    >
      <div className="text-sm text-muted-foreground">
        Showing {from}–{to} of {totalCount} {itemLabel}s
      </div>
      <div className="flex items-center gap-1">
        <PageLink
          href={href(1)}
          enabled={hasPrev}
          testId="first-page"
          label="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </PageLink>
        <PageLink
          href={href(page - 1)}
          enabled={hasPrev}
          testId="prev-page"
          label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </PageLink>
        <span
          className="px-3 text-sm text-muted-foreground"
          data-testid="page-info"
        >
          Page {page} of {totalPages}
        </span>
        <PageLink
          href={href(page + 1)}
          enabled={hasNext}
          testId="next-page"
          label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </PageLink>
        <PageLink
          href={href(totalPages)}
          enabled={hasNext}
          testId="last-page"
          label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  enabled,
  testId,
  label,
  children,
}: {
  href: string;
  enabled: boolean;
  testId: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-disabled={!enabled}
      tabIndex={enabled ? 0 : -1}
      className={!enabled ? "pointer-events-none" : ""}
    >
      <Button
        variant="outline"
        size="sm"
        disabled={!enabled}
        data-testid={testId}
        aria-label={label}
      >
        {children}
      </Button>
    </Link>
  );
}
