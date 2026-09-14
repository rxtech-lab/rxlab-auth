import { describe, expect, test, mock, beforeEach } from "bun:test";
import { drizzleOrmMock } from "@/lib/db/drizzle-mock";

// --- fake drizzle query builders -------------------------------------------
// The conditions are opaque here; these tests assert *which* branch ran and
// what it touched, not the SQL. The guard itself is exercised through the
// findFirst rows that feed each branch.

let findFirstResult: Record<string, unknown> | null = null;
const updateSetCalls: Record<string, unknown>[] = [];
let deleteReturning: { id: string }[] = [];
let deleteCallCount = 0;
let selectRows: { id: string; requestId: string | null }[] = [];

const mockDb = {
  query: {
    users: {
      findFirst: mock(() => Promise.resolve(findFirstResult)),
    },
  },
  update: mock(() => ({
    set: mock((values: Record<string, unknown>) => {
      updateSetCalls.push(values);
      return { where: mock(() => Promise.resolve()) };
    }),
  })),
  delete: mock(() => ({
    where: mock(() => {
      deleteCallCount += 1;
      const promise = Promise.resolve(deleteReturning) as Promise<
        { id: string }[]
      > & { returning: () => Promise<{ id: string }[]> };
      promise.returning = () => Promise.resolve(deleteReturning);
      return promise;
    }),
  })),
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        limit: mock(() => Promise.resolve(selectRows)),
      })),
    })),
  })),
};

mock.module("drizzle-orm", () => drizzleOrmMock);

mock.module("@/lib/db", () => ({ db: mockDb }));

const deleteImageMock = mock(() => Promise.resolve());
mock.module("@/lib/blob", () => ({
  deleteImage: deleteImageMock,
  // Re-export the rest of the surface: mock.module replaces the module for the
  // whole run, so omitting these would break any other test that needs them.
  uploadImage: mock(() => Promise.resolve({ url: "https://blob/x.png" })),
  listImages: mock(() => Promise.resolve([])),
}));

const {
  hardDeleteUser,
  markDeletionScheduled,
  clearDeletionSchedule,
  finalizeScheduledDeletion,
  sweepOverdueDeletions,
} = await import("./deletion");

beforeEach(() => {
  findFirstResult = null;
  updateSetCalls.length = 0;
  deleteReturning = [];
  deleteCallCount = 0;
  selectRows = [];
  deleteImageMock.mockClear();
});

const NOW = new Date("2026-09-14T12:00:00.000Z");
const DUE = new Date("2026-09-21T12:00:00.000Z");

describe("hardDeleteUser", () => {
  test("cleans up the avatar blob then deletes the row", async () => {
    findFirstResult = {
      id: "u1",
      avatarUrl: "https://blob/avatar.png",
      deletionRunId: "run_1",
    };

    const result = await hardDeleteUser("u1");

    expect(result).toEqual({ deleted: true, previousRunId: "run_1" });
    expect(deleteImageMock).toHaveBeenCalledTimes(1);
    expect(deleteCallCount).toBe(1);
  });

  test("skips blob cleanup when there is no avatar", async () => {
    findFirstResult = { id: "u1", avatarUrl: null, deletionRunId: null };

    await hardDeleteUser("u1");

    expect(deleteImageMock).not.toHaveBeenCalled();
    expect(deleteCallCount).toBe(1);
  });

  // A stranded blob must never keep an account alive.
  test("still deletes the row when blob cleanup throws", async () => {
    findFirstResult = {
      id: "u1",
      avatarUrl: "https://blob/avatar.png",
      deletionRunId: null,
    };
    deleteImageMock.mockImplementationOnce(() =>
      Promise.reject(new Error("blob down")),
    );

    const result = await hardDeleteUser("u1");

    expect(result.deleted).toBe(true);
    expect(deleteCallCount).toBe(1);
  });

  test("reports a missing user without deleting", async () => {
    findFirstResult = null;

    expect(await hardDeleteUser("nope")).toEqual({
      deleted: false,
      previousRunId: null,
    });
    expect(deleteCallCount).toBe(0);
  });
});

describe("markDeletionScheduled", () => {
  test("writes the full pending record", async () => {
    findFirstResult = {
      deletionScheduledAt: null,
      deletionRequestedAt: null,
      deletionRequestId: null,
      deletionRunId: null,
    };

    const result = await markDeletionScheduled({
      userId: "u1",
      delaySeconds: 2,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyScheduled).toBe(false);
    expect(result.pending.requestedAt).toEqual(NOW);
    expect(result.pending.scheduledAt).toEqual(new Date(NOW.getTime() + 2000));
    expect(result.pending.requestId).toBeTruthy();
    expect(updateSetCalls).toHaveLength(1);
    expect(updateSetCalls[0].deletionRunId).toBeNull();
  });

  // Re-posting must not slide the deadline further out each time.
  test("is idempotent when a deletion is already pending", async () => {
    findFirstResult = {
      deletionScheduledAt: DUE,
      deletionRequestedAt: NOW,
      deletionRequestId: "R1",
      deletionRunId: "run_1",
    };

    const result = await markDeletionScheduled({ userId: "u1", now: NOW });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.alreadyScheduled).toBe(true);
    expect(result.pending.requestId).toBe("R1");
    expect(updateSetCalls).toHaveLength(0);
  });

  test("reports a missing user", async () => {
    findFirstResult = null;
    expect(await markDeletionScheduled({ userId: "nope" })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("clearDeletionSchedule", () => {
  test("nulls every deletion column and returns the run id", async () => {
    findFirstResult = {
      deletionScheduledAt: DUE,
      deletionRequestedAt: NOW,
      deletionRequestId: "R1",
      deletionRunId: "run_1",
    };

    const result = await clearDeletionSchedule("u1");

    expect(result).toEqual({
      ok: true,
      cancelled: true,
      previousRunId: "run_1",
    });
    expect(updateSetCalls[0]).toMatchObject({
      deletionScheduledAt: null,
      deletionRequestedAt: null,
      deletionRequestId: null,
      deletionRunId: null,
    });
  });

  test("is a no-op when nothing is pending", async () => {
    findFirstResult = {
      deletionScheduledAt: null,
      deletionRequestedAt: null,
      deletionRequestId: null,
      deletionRunId: null,
    };

    expect(await clearDeletionSchedule("u1")).toEqual({
      ok: true,
      cancelled: false,
      previousRunId: null,
    });
    expect(updateSetCalls).toHaveLength(0);
  });
});

describe("finalizeScheduledDeletion", () => {
  const AFTER_DUE = new Date(DUE.getTime() + 1000);

  test("deletes when the request id matches and the date has passed", async () => {
    findFirstResult = {
      avatarUrl: "https://blob/a.png",
      deletionScheduledAt: DUE,
      deletionRequestId: "R1",
    };
    deleteReturning = [{ id: "u1" }];

    const result = await finalizeScheduledDeletion({
      userId: "u1",
      requestId: "R1",
      now: AFTER_DUE,
    });

    expect(result).toEqual({ deleted: true });
    expect(deleteCallCount).toBe(1);
    expect(deleteImageMock).toHaveBeenCalledTimes(1);
  });

  test("no-ops when the user is already gone", async () => {
    findFirstResult = null;

    expect(
      await finalizeScheduledDeletion({
        userId: "u1",
        requestId: "R1",
        now: AFTER_DUE,
      }),
    ).toEqual({ deleted: false, reason: "not_found" });
    expect(deleteCallCount).toBe(0);
  });

  test("no-ops when the deletion was cancelled", async () => {
    findFirstResult = {
      avatarUrl: null,
      deletionScheduledAt: null,
      deletionRequestId: null,
    };

    expect(
      await finalizeScheduledDeletion({
        userId: "u1",
        requestId: "R1",
        now: AFTER_DUE,
      }),
    ).toEqual({ deleted: false, reason: "cancelled" });
    expect(deleteCallCount).toBe(0);
  });

  // The decisive case: schedule -> cancel -> re-schedule. The stale run from the
  // first schedule wakes up and must not delete the re-scheduled account.
  test("no-ops when a later schedule superseded this run", async () => {
    findFirstResult = {
      avatarUrl: null,
      deletionScheduledAt: DUE,
      deletionRequestId: "R2",
    };

    expect(
      await finalizeScheduledDeletion({
        userId: "u1",
        requestId: "R1",
        now: AFTER_DUE,
      }),
    ).toEqual({ deleted: false, reason: "superseded" });
    expect(deleteCallCount).toBe(0);
  });

  test("no-ops when woken before the scheduled date", async () => {
    findFirstResult = {
      avatarUrl: null,
      deletionScheduledAt: DUE,
      deletionRequestId: "R1",
    };

    expect(
      await finalizeScheduledDeletion({
        userId: "u1",
        requestId: "R1",
        now: NOW,
      }),
    ).toEqual({ deleted: false, reason: "not_due" });
    expect(deleteCallCount).toBe(0);
  });

  // The WHERE clause is the real guard: if a cancel lands between the read and
  // the delete, the delete matches nothing and we must not report success.
  test("reports cancelled when the guarded delete matches no row", async () => {
    findFirstResult = {
      avatarUrl: "https://blob/a.png",
      deletionScheduledAt: DUE,
      deletionRequestId: "R1",
    };
    deleteReturning = [];

    const result = await finalizeScheduledDeletion({
      userId: "u1",
      requestId: "R1",
      now: AFTER_DUE,
    });

    expect(result).toEqual({ deleted: false, reason: "cancelled" });
    expect(deleteImageMock).not.toHaveBeenCalled();
  });
});

describe("sweepOverdueDeletions", () => {
  test("finalizes each overdue row through the same guard", async () => {
    selectRows = [
      { id: "u1", requestId: "R1" },
      { id: "u2", requestId: "R2" },
    ];
    findFirstResult = {
      avatarUrl: null,
      deletionScheduledAt: DUE,
      deletionRequestId: "R1",
    };
    deleteReturning = [{ id: "u1" }];

    const result = await sweepOverdueDeletions({
      now: new Date(DUE.getTime() + 600_000),
    });

    // u1 matches its request id; u2's row read returns R1, so it is skipped as
    // superseded rather than deleted.
    expect(result.deleted).toEqual(["u1"]);
    expect(result.skipped).toEqual(["u2"]);
  });

  test("skips rows with no request id instead of deleting them", async () => {
    selectRows = [{ id: "u1", requestId: null }];

    const result = await sweepOverdueDeletions({ now: NOW });

    expect(result).toEqual({ deleted: [], skipped: ["u1"] });
    expect(deleteCallCount).toBe(0);
  });
});
