// Shared paging maths for the admin list pages.
//
// Everything paging-related lives in the URL rather than component state, so a
// refresh, a shared link, or the back button all land on the same page of the
// same list. These helpers are pure so the clamping rules — which are the easy
// part to get subtly wrong — can be tested without a database or a renderer.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Read a `?page=` value. Anything unparseable, zero, or negative means page 1;
 * a URL is user-editable, so no input here should ever produce a broken query.
 */
export function parsePageParam(value: string | undefined | null): number {
  const parsed = parseInt(value ?? "1", 10);
  return Math.max(Number.isNaN(parsed) ? 1 : parsed, 1);
}

/** Read a `?pageSize=`, clamped to a range that can't melt the database. */
export function parsePageSizeParam(
  value: string | undefined | null,
  fallback: number = DEFAULT_PAGE_SIZE,
): number {
  const parsed = parseInt(value ?? String(fallback), 10);
  const size = Number.isNaN(parsed) ? fallback : parsed;
  return Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
}

export interface Pagination {
  /** The page actually being shown, after clamping to what exists. */
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  offset: number;
  hasPrev: boolean;
  hasNext: boolean;
  /** 1-based index of the first row on this page; 0 when there are no rows. */
  from: number;
  /** 1-based index of the last row on this page; 0 when there are no rows. */
  to: number;
  /** True when the requested page didn't exist and had to be clamped. */
  wasClamped: boolean;
}

/**
 * Resolve a requested page against the row count.
 *
 * An empty list still has one (empty) page, so `totalPages` never drops below 1
 * — otherwise page 1 of an empty table would itself be out of range and the
 * caller would redirect forever.
 */
export function resolvePagination(input: {
  totalCount: number;
  requestedPage: number;
  pageSize: number;
}): Pagination {
  const totalCount = Math.max(input.totalCount, 0);
  const pageSize = Math.max(input.pageSize, 1);
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  const requestedPage = Math.max(input.requestedPage, 1);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    offset,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    from: totalCount === 0 ? 0 : offset + 1,
    to: Math.min(page * pageSize, totalCount),
    wasClamped: page !== requestedPage,
  };
}

/**
 * Build a query string from the params that should survive navigation.
 *
 * Empty, null, and undefined values are dropped so the URL stays readable —
 * `?page=2` rather than `?page=2&q=&pageSize=`. Returns "" when nothing is
 * left, which is a valid relative href meaning "this page".
 */
export function buildQueryString(
  params: Record<string, string | number | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const stringValue = String(value);
    if (stringValue === "") continue;
    search.set(key, stringValue);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
