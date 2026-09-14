import { describe, expect, test, mock, beforeEach } from "bun:test";

const markDeletionScheduledMock = mock();
const clearDeletionScheduleMock = mock();
const hardDeleteUserMock = mock();
const attachDeletionRunIdMock = mock(() => Promise.resolve());

mock.module("@/lib/account/deletion", () => ({
  markDeletionScheduled: markDeletionScheduledMock,
  clearDeletionSchedule: clearDeletionScheduleMock,
  hardDeleteUser: hardDeleteUserMock,
  attachDeletionRunId: attachDeletionRunIdMock,
}));

const startMock = mock();
const cancelMock = mock(() => Promise.resolve());
const getRunMock = mock(() => ({ cancel: cancelMock }));

mock.module("workflow/api", () => ({
  start: startMock,
  getRun: getRunMock,
}));

mock.module("@/workflows/account-deletion", () => ({
  scheduledAccountDeletionWorkflow: () => Promise.resolve(),
}));

const { scheduleAccountDeletion, cancelAccountDeletion, hardDeleteAccount } =
  await import("./deletion-scheduler");

const SCHEDULED = new Date("2026-09-21T12:00:00.000Z");
const REQUESTED = new Date("2026-09-14T12:00:00.000Z");

function pending(overrides: Record<string, unknown> = {}) {
  return {
    scheduledAt: SCHEDULED,
    requestedAt: REQUESTED,
    requestId: "R1",
    runId: null,
    ...overrides,
  };
}

beforeEach(() => {
  markDeletionScheduledMock.mockReset();
  clearDeletionScheduleMock.mockReset();
  hardDeleteUserMock.mockReset();
  attachDeletionRunIdMock.mockClear();
  startMock.mockReset();
  cancelMock.mockClear();
  getRunMock.mockClear();
});

describe("scheduleAccountDeletion", () => {
  test("marks the row, starts the workflow, then records the run id", async () => {
    markDeletionScheduledMock.mockResolvedValue({
      ok: true,
      pending: pending(),
      alreadyScheduled: false,
    });
    startMock.mockResolvedValue({ runId: "run_1" });

    const result = await scheduleAccountDeletion({
      userId: "u1",
      actor: "user",
    });

    expect(result).toMatchObject({ ok: true, workflowStarted: true });
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock.mock.calls[0][1]).toEqual([
      {
        userId: "u1",
        requestId: "R1",
        scheduledForIso: "2026-09-21T12:00:00.000Z",
      },
    ]);
    expect(attachDeletionRunIdMock).toHaveBeenCalledWith({
      userId: "u1",
      requestId: "R1",
      runId: "run_1",
    });
  });

  // The resilience guarantee: a missing or broken workflow runtime must not make
  // "delete my account" fail. The row stays scheduled; the cron sweep finalizes.
  test("still succeeds when start() throws", async () => {
    markDeletionScheduledMock.mockResolvedValue({
      ok: true,
      pending: pending(),
      alreadyScheduled: false,
    });
    startMock.mockRejectedValue(new Error("no workflow runtime"));

    const result = await scheduleAccountDeletion({
      userId: "u1",
      actor: "user",
    });

    expect(result).toMatchObject({ ok: true, workflowStarted: false });
    if (!result.ok) return;
    expect(result.pending.scheduledAt).toEqual(SCHEDULED);
    expect(attachDeletionRunIdMock).not.toHaveBeenCalled();
  });

  test("does not start a second run when already pending", async () => {
    markDeletionScheduledMock.mockResolvedValue({
      ok: true,
      pending: pending({ runId: "run_existing" }),
      alreadyScheduled: true,
    });

    const result = await scheduleAccountDeletion({
      userId: "u1",
      actor: "user",
    });

    expect(result).toMatchObject({
      ok: true,
      alreadyScheduled: true,
      workflowStarted: true,
    });
    expect(startMock).not.toHaveBeenCalled();
  });

  test("passes through a missing user", async () => {
    markDeletionScheduledMock.mockResolvedValue({
      ok: false,
      reason: "not_found",
    });

    expect(
      await scheduleAccountDeletion({ userId: "nope", actor: "admin" }),
    ).toEqual({ ok: false, reason: "not_found" });
    expect(startMock).not.toHaveBeenCalled();
  });
});

describe("cancelAccountDeletion", () => {
  test("clears the row and cancels the run", async () => {
    clearDeletionScheduleMock.mockResolvedValue({
      ok: true,
      cancelled: true,
      previousRunId: "run_1",
    });

    expect(await cancelAccountDeletion({ userId: "u1", actor: "user" })).toEqual({
      ok: true,
      cancelled: true,
    });
    expect(getRunMock).toHaveBeenCalledWith("run_1");
    expect(cancelMock).toHaveBeenCalledTimes(1);
  });

  // Cancellation must not depend on the workflow backend being reachable.
  test("reports success even when cancelling the run fails", async () => {
    clearDeletionScheduleMock.mockResolvedValue({
      ok: true,
      cancelled: true,
      previousRunId: "run_1",
    });
    cancelMock.mockImplementationOnce(() => Promise.reject(new Error("down")));

    expect(await cancelAccountDeletion({ userId: "u1", actor: "user" })).toEqual({
      ok: true,
      cancelled: true,
    });
  });

  test("skips the run cancel when nothing was pending", async () => {
    clearDeletionScheduleMock.mockResolvedValue({
      ok: true,
      cancelled: false,
      previousRunId: null,
    });

    expect(await cancelAccountDeletion({ userId: "u1", actor: "user" })).toEqual({
      ok: true,
      cancelled: false,
    });
    expect(getRunMock).not.toHaveBeenCalled();
  });
});

describe("hardDeleteAccount", () => {
  test("cancels an orphaned run left by a pending deletion", async () => {
    hardDeleteUserMock.mockResolvedValue({
      deleted: true,
      previousRunId: "run_1",
    });

    expect(await hardDeleteAccount({ userId: "u1", actor: "admin" })).toEqual({
      ok: true,
    });
    expect(cancelMock).toHaveBeenCalledTimes(1);
  });

  test("reports a missing user", async () => {
    hardDeleteUserMock.mockResolvedValue({
      deleted: false,
      previousRunId: null,
    });

    expect(await hardDeleteAccount({ userId: "nope", actor: "admin" })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});
