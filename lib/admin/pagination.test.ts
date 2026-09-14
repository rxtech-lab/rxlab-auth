import { describe, expect, test } from "bun:test";
import {
  buildQueryString,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePageParam,
  parsePageSizeParam,
  resolvePagination,
} from "./pagination";

describe("parsePageParam", () => {
  test("reads a valid page", () => {
    expect(parsePageParam("3")).toBe(3);
  });

  test("defaults to page 1 when absent", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam(null)).toBe(1);
  });

  test("floors junk and out-of-range values at 1", () => {
    // The URL is user-editable, so none of these may produce a broken query.
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-5")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam("")).toBe(1);
  });

  test("tolerates trailing junk the way parseInt does", () => {
    expect(parsePageParam("2xyz")).toBe(2);
  });
});

describe("parsePageSizeParam", () => {
  test("defaults when absent", () => {
    expect(parsePageSizeParam(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  test("clamps to at least 1", () => {
    expect(parsePageSizeParam("0")).toBe(1);
    expect(parsePageSizeParam("-10")).toBe(1);
  });

  test("clamps to the maximum", () => {
    expect(parsePageSizeParam("999")).toBe(MAX_PAGE_SIZE);
  });

  test("falls back for junk", () => {
    expect(parsePageSizeParam("abc")).toBe(DEFAULT_PAGE_SIZE);
  });

  test("honours a custom fallback", () => {
    expect(parsePageSizeParam(undefined, 50)).toBe(50);
  });
});

describe("resolvePagination", () => {
  test("describes a middle page", () => {
    const result = resolvePagination({
      totalCount: 95,
      requestedPage: 3,
      pageSize: 20,
    });

    expect(result).toMatchObject({
      page: 3,
      totalPages: 5,
      offset: 40,
      hasPrev: true,
      hasNext: true,
      from: 41,
      to: 60,
      wasClamped: false,
    });
  });

  test("clamps a page past the end to the last page", () => {
    const result = resolvePagination({
      totalCount: 25,
      requestedPage: 999,
      pageSize: 20,
    });

    expect(result.page).toBe(2);
    expect(result.wasClamped).toBe(true);
    expect(result.hasNext).toBe(false);
    expect(result.to).toBe(25);
  });

  test("an empty list still has one page, so page 1 is never out of range", () => {
    // Otherwise the caller redirects to a page that also doesn't exist, forever.
    const result = resolvePagination({
      totalCount: 0,
      requestedPage: 1,
      pageSize: 20,
    });

    expect(result.totalPages).toBe(1);
    expect(result.page).toBe(1);
    expect(result.wasClamped).toBe(false);
    expect(result.hasPrev).toBe(false);
    expect(result.hasNext).toBe(false);
    expect(result.from).toBe(0);
    expect(result.to).toBe(0);
  });

  test("the last page is short when the count isn't a multiple of pageSize", () => {
    const result = resolvePagination({
      totalCount: 21,
      requestedPage: 2,
      pageSize: 20,
    });

    expect(result.from).toBe(21);
    expect(result.to).toBe(21);
  });

  test("a single full page has no next", () => {
    const result = resolvePagination({
      totalCount: 20,
      requestedPage: 1,
      pageSize: 20,
    });

    expect(result.totalPages).toBe(1);
    expect(result.hasNext).toBe(false);
  });
});

describe("buildQueryString", () => {
  test("serialises the params that matter", () => {
    expect(buildQueryString({ page: 2, pageSize: 20 })).toBe(
      "?page=2&pageSize=20",
    );
  });

  test("drops empty, null and undefined values", () => {
    expect(buildQueryString({ page: 2, q: "", tab: undefined, x: null })).toBe(
      "?page=2",
    );
  });

  test("returns an empty string when nothing survives", () => {
    // "" is a valid relative href meaning "this page".
    expect(buildQueryString({ q: "", page: undefined })).toBe("");
  });

  test("escapes values", () => {
    expect(buildQueryString({ q: "a b&c" })).toBe("?q=a+b%26c");
  });
});
