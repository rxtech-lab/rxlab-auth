import { describe, expect, test } from "bun:test";
import { computeExpectedOrigins } from "./config";

describe("computeExpectedOrigins", () => {
  test("prod: includes both configured origin and bare-rpId origin", () => {
    const origins = computeExpectedOrigins(
      "https://auth.rxlab.app",
      "rxlab.app",
    );
    expect(origins).toContain("https://auth.rxlab.app");
    expect(origins).toContain("https://rxlab.app");
    expect(origins.length).toBe(2);
  });

  test("localhost dev: only configured origin, no https://localhost", () => {
    const origins = computeExpectedOrigins(
      "http://localhost:3000",
      "localhost",
    );
    expect(origins).toEqual(["http://localhost:3000"]);
  });

  test("dedupes when configured origin already equals https://<rpId>", () => {
    const origins = computeExpectedOrigins(
      "https://rxlab.app",
      "rxlab.app",
    );
    expect(origins).toEqual(["https://rxlab.app"]);
  });

  test("rpId without a dot is treated like localhost (no bare origin added)", () => {
    const origins = computeExpectedOrigins("http://localhost:3000", "myhost");
    expect(origins).toEqual(["http://localhost:3000"]);
  });
});
