import {
  DEFAULT_ADMIN_API_PAGE_SIZE,
  MAX_ADMIN_API_PAGE_SIZE,
  parseAdminApiPagination,
  toContainsLikePattern,
} from "@/lib/admin-api/query";

export const DEFAULT_OAUTH_CLIENT_PAGE_SIZE = DEFAULT_ADMIN_API_PAGE_SIZE;
export const MAX_OAUTH_CLIENT_PAGE_SIZE = MAX_ADMIN_API_PAGE_SIZE;
export { toContainsLikePattern };

export function parseOAuthClientPagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
} {
  return parseAdminApiPagination(searchParams);
}
