import { describe, expect, test } from "bun:test";
import {
  DEFAULT_OAUTH_CLIENT_PAGE_SIZE,
  parseOAuthClientPagination,
  toContainsLikePattern,
} from "./oauth-client-query";

describe("parseOAuthClientPagination", () => {
  test("uses stable defaults", () => {
    expect(parseOAuthClientPagination(new URLSearchParams())).toEqual({
      page: 1,
      pageSize: DEFAULT_OAUTH_CLIENT_PAGE_SIZE,
    });
  });

  test("accepts positive page values", () => {
    expect(
      parseOAuthClientPagination(
        new URLSearchParams({ page: "3", pageSize: "25" }),
      ),
    ).toEqual({ page: 3, pageSize: 25 });
  });

  test("falls back for invalid values and caps page size", () => {
    expect(
      parseOAuthClientPagination(
        new URLSearchParams({ page: "0", pageSize: "1000" }),
      ),
    ).toEqual({ page: 1, pageSize: 100 });

    expect(
      parseOAuthClientPagination(
        new URLSearchParams({ page: "2abc", pageSize: "1.5" }),
      ),
    ).toEqual({ page: 1, pageSize: DEFAULT_OAUTH_CLIENT_PAGE_SIZE });
  });
});

describe("toContainsLikePattern", () => {
  test("treats SQL wildcard characters as literal keyword text", () => {
    expect(toContainsLikePattern("100%_ready")).toBe("%100\\%\\_ready%");
  });
});
