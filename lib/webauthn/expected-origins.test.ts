import { describe, expect, test } from "bun:test";
import { computeExpectedOrigins } from "./config";

describe("computeExpectedOrigins", () => {
  test("prod: dedupes configured auth origin when rpId is auth host", () => {
    const origins = computeExpectedOrigins(
      "https://auth.rxlab.app",
      "auth.rxlab.app",
    );
    expect(origins).toEqual(["https://auth.rxlab.app"]);
  });

  test("localhost dev: only configured origin, no https://localhost", () => {
    const origins = computeExpectedOrigins(
      "http://localhost:3000",
      "localhost",
    );
    expect(origins).toEqual(["http://localhost:3000"]);
  });

  test("keeps distinct rpId origin when it differs from configured origin", () => {
    const origins = computeExpectedOrigins(
      "https://auth.rxlab.app",
      "rxlab.app",
    );
    expect(origins).toEqual(["https://auth.rxlab.app", "https://rxlab.app"]);
  });

  test("rpId without a dot is treated like localhost (no bare origin added)", () => {
    const origins = computeExpectedOrigins("http://localhost:3000", "myhost");
    expect(origins).toEqual(["http://localhost:3000"]);
  });
});
