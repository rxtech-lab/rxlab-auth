import { describe, it, expect } from "bun:test";
import { dedupAndSortAppIds, buildAASA } from "./build-aasa";

describe("dedupAndSortAppIds", () => {
  it("returns [] for empty input", () => {
    expect(dedupAndSortAppIds([])).toEqual([]);
  });

  it("sorts lexicographically", () => {
    expect(
      dedupAndSortAppIds(["ABCDE12345.com.b.app", "ABCDE12345.com.a.app"])
    ).toEqual(["ABCDE12345.com.a.app", "ABCDE12345.com.b.app"]);
  });

  it("removes duplicates", () => {
    expect(
      dedupAndSortAppIds([
        "ABCDE12345.com.a.app",
        "ABCDE12345.com.a.app",
        "ABCDE12345.com.b.app",
      ])
    ).toEqual(["ABCDE12345.com.a.app", "ABCDE12345.com.b.app"]);
  });

  it("trims whitespace and drops empty entries", () => {
    expect(
      dedupAndSortAppIds(["  ABCDE12345.com.a.app  ", "", "   "])
    ).toEqual(["ABCDE12345.com.a.app"]);
  });

  it("treats whitespace-only duplicates as one", () => {
    expect(
      dedupAndSortAppIds([
        "ABCDE12345.com.a.app",
        "  ABCDE12345.com.a.app  ",
      ])
    ).toEqual(["ABCDE12345.com.a.app"]);
  });
});

describe("buildAASA", () => {
  it("wraps app IDs under webcredentials.apps", () => {
    expect(buildAASA(["ABCDE12345.com.a.app"])).toEqual({
      webcredentials: { apps: ["ABCDE12345.com.a.app"] },
    });
  });

  it("returns empty apps array for no input", () => {
    expect(buildAASA([])).toEqual({
      webcredentials: { apps: [] },
    });
  });

  it("dedupes and sorts in the wrapped output", () => {
    expect(
      buildAASA(["ABCDE12345.com.b.app", "ABCDE12345.com.a.app", "ABCDE12345.com.b.app"])
    ).toEqual({
      webcredentials: {
        apps: ["ABCDE12345.com.a.app", "ABCDE12345.com.b.app"],
      },
    });
  });
});
