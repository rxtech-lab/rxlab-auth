export const DEFAULT_ADMIN_API_PAGE_SIZE = 20;
export const MAX_ADMIN_API_PAGE_SIZE = 100;
export const MAX_ADMIN_API_KEYWORD_LENGTH = 100;

/**
 * Wraps a keyword for a substring `ILIKE`, escaping the wildcards it may
 * contain. The escape character is a backslash, which is Postgres' default for
 * `LIKE`/`ILIKE` — so callers need no explicit `ESCAPE` clause.
 */
export function toContainsLikePattern(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, "\\$&")}%`;
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  maximum?: number,
): number {
  const parsed = value && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return maximum ? Math.min(parsed, maximum) : parsed;
}

export function parseAdminApiPagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
} {
  return {
    page: parsePositiveInteger(searchParams.get("page"), 1),
    pageSize: parsePositiveInteger(
      searchParams.get("pageSize"),
      DEFAULT_ADMIN_API_PAGE_SIZE,
      MAX_ADMIN_API_PAGE_SIZE,
    ),
  };
}
