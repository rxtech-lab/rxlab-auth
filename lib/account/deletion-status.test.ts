import { describe, expect, test } from "bun:test";
import {
  buildAccountDeletionStatus,
  buildOAuthAccountDeletionClaims,
  toNumericDate,
  toUtcIso,
} from "./deletion-status";

const SCHEDULED = new Date("2026-09-21T12:00:00.000Z");
const REQUESTED = new Date("2026-09-14T12:00:00.000Z");

describe("toUtcIso", () => {
  test("renders a UTC ISO-8601 string", () => {
    expect(toUtcIso(SCHEDULED)).toBe("2026-09-21T12:00:00.000Z");
  });

  test("returns null for null and undefined", () => {
    expect(toUtcIso(null)).toBeNull();
    expect(toUtcIso(undefined)).toBeNull();
  });
});

describe("toNumericDate", () => {
  test("returns epoch seconds, not milliseconds", () => {
    expect(toNumericDate(SCHEDULED)).toBe(SCHEDULED.getTime() / 1000);
  });

  test("floors sub-second precision", () => {
    expect(toNumericDate(new Date("2026-09-21T12:00:00.750Z"))).toBe(
      Math.floor(new Date("2026-09-21T12:00:00.750Z").getTime() / 1000),
    );
  });

  test("returns null for null and undefined", () => {
    expect(toNumericDate(null)).toBeNull();
    expect(toNumericDate(undefined)).toBeNull();
  });
});

describe("buildAccountDeletionStatus", () => {
  test("reports a clean account as not pending", () => {
    expect(
      buildAccountDeletionStatus({
        deletionScheduledAt: null,
        deletionRequestedAt: null,
      }),
    ).toEqual({
      pendingDeletion: false,
      deletionScheduledAt: null,
      deletionRequestedAt: null,
    });
  });

  test("reports a scheduled account with ISO timestamps", () => {
    expect(
      buildAccountDeletionStatus({
        deletionScheduledAt: SCHEDULED,
        deletionRequestedAt: REQUESTED,
      }),
    ).toEqual({
      pendingDeletion: true,
      deletionScheduledAt: "2026-09-21T12:00:00.000Z",
      deletionRequestedAt: "2026-09-14T12:00:00.000Z",
    });
  });
});

describe("buildOAuthAccountDeletionClaims", () => {
  test("reports a clean account as not pending", () => {
    expect(
      buildOAuthAccountDeletionClaims({
        deletionScheduledAt: null,
        deletionRequestedAt: null,
      }),
    ).toEqual({
      deletion_pending: false,
      deletion_scheduled_at: null,
      deletion_requested_at: null,
    });
  });

  // Guards against someone "unifying" the two serializers onto ISO strings and
  // breaking OIDC clients that parse these as NumericDate.
  test("emits numbers, not ISO strings", () => {
    const claims = buildOAuthAccountDeletionClaims({
      deletionScheduledAt: SCHEDULED,
      deletionRequestedAt: REQUESTED,
    });

    expect(claims.deletion_pending).toBe(true);
    expect(typeof claims.deletion_scheduled_at).toBe("number");
    expect(typeof claims.deletion_requested_at).toBe("number");
    expect(claims.deletion_scheduled_at).toBe(SCHEDULED.getTime() / 1000);
  });
});
