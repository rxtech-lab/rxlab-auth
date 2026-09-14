import { describe, expect, test, beforeEach, afterAll } from "bun:test";
import {
  DEFAULT_ACCOUNT_DELETION_DELAY_SECONDS,
  MAX_ACCOUNT_DELETION_DELAY_SECONDS,
  computeDeletionScheduledAt,
  floorToSecond,
  getAccountDeletionDelaySeconds,
} from "./deletion-config";

const ORIGINAL = process.env.ACCOUNT_DELETION_DELAY_SECONDS;

beforeEach(() => {
  delete process.env.ACCOUNT_DELETION_DELAY_SECONDS;
});

afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.ACCOUNT_DELETION_DELAY_SECONDS;
  else process.env.ACCOUNT_DELETION_DELAY_SECONDS = ORIGINAL;
});

describe("getAccountDeletionDelaySeconds", () => {
  test("defaults to seven days", () => {
    expect(getAccountDeletionDelaySeconds()).toBe(7 * 24 * 60 * 60);
    expect(DEFAULT_ACCOUNT_DELETION_DELAY_SECONDS).toBe(604800);
  });

  test("reads a valid override", () => {
    process.env.ACCOUNT_DELETION_DELAY_SECONDS = "2";
    expect(getAccountDeletionDelaySeconds()).toBe(2);
  });

  test.each([["abc"], ["-1"], ["1.5"], [""], ["  "], ["1e3"]])(
    "falls back to the default for %p",
    (value) => {
      process.env.ACCOUNT_DELETION_DELAY_SECONDS = value;
      expect(getAccountDeletionDelaySeconds()).toBe(
        DEFAULT_ACCOUNT_DELETION_DELAY_SECONDS,
      );
    },
  );

  test("clamps absurd values so a typo can't strand a row forever", () => {
    process.env.ACCOUNT_DELETION_DELAY_SECONDS = String(999 * 365 * 24 * 60 * 60);
    expect(getAccountDeletionDelaySeconds()).toBe(
      MAX_ACCOUNT_DELETION_DELAY_SECONDS,
    );
  });
});

describe("computeDeletionScheduledAt", () => {
  test("adds the delay to the supplied instant", () => {
    expect(computeDeletionScheduledAt(new Date(0), 2)).toEqual(new Date(2000));
  });

  test("uses the configured delay when none is passed", () => {
    process.env.ACCOUNT_DELETION_DELAY_SECONDS = "60";
    expect(computeDeletionScheduledAt(new Date(0))).toEqual(new Date(60_000));
  });
});

describe("floorToSecond", () => {
  test("drops sub-second precision", () => {
    expect(floorToSecond(new Date("2026-09-21T12:00:00.619Z"))).toEqual(
      new Date("2026-09-21T12:00:00.000Z"),
    );
  });

  test("leaves a whole second untouched", () => {
    const whole = new Date("2026-09-21T12:00:00.000Z");
    expect(floorToSecond(whole)).toEqual(whole);
  });
});

// Regression: the scheduled instant is stored in a whole-second column, so an
// unfloored value made the schedule response disagree with every later read.
describe("computeDeletionScheduledAt precision", () => {
  test("returns a whole second even from a sub-second now", () => {
    const result = computeDeletionScheduledAt(
      new Date("2026-09-14T12:00:00.619Z"),
      2,
    );
    expect(result.getMilliseconds()).toBe(0);
    expect(result).toEqual(new Date("2026-09-14T12:00:02.000Z"));
  });
});
