import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));

const { workoutLogFindFirst, workoutLogCreate, workoutLogUpdate, restTimerUpdateMany, logEntryCreate, logEntryDeleteMany, workoutPlanFindFirst, exerciseFindFirst } =
  vi.hoisted(() => ({
    workoutLogFindFirst: vi.fn(),
    workoutLogCreate: vi.fn(),
    workoutLogUpdate: vi.fn(),
    restTimerUpdateMany: vi.fn(),
    logEntryCreate: vi.fn(),
    logEntryDeleteMany: vi.fn(),
    workoutPlanFindFirst: vi.fn(),
    exerciseFindFirst: vi.fn(),
  }));

vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/queries", () => ({ refreshUserCache: vi.fn() }));
vi.mock("@/lib/revalidate-tabs", () => ({ revalidateTabs: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    workoutLog: {
      findFirst: workoutLogFindFirst,
      create: workoutLogCreate,
      update: workoutLogUpdate,
    },
    workoutPlan: { findFirst: workoutPlanFindFirst },
    exercise: { findFirst: exerciseFindFirst },
    logEntry: { create: logEntryCreate, deleteMany: logEntryDeleteMany, updateMany: vi.fn() },
    restTimer: { updateMany: restTimerUpdateMany },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));

import {
  abandonWorkoutSession,
  deleteLoggedSet,
  finishWorkoutSession,
  logSet,
  startWorkoutSession,
} from "@/app/workout/active/session-actions";

describe("workout sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: "user-a" } });
  });

  it("user A cannot log a set into user B's session", async () => {
    workoutLogFindFirst.mockResolvedValue(null);
    const result = await logSet("session-b", {
      exerciseName: "Squat",
      setNumber: 1,
      weight: 80,
      reps: 5,
      durationSeconds: null,
    });
    expect(result).toEqual({ error: "Session not found." });
    expect(workoutLogFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "session-b", userId: "user-a" }) })
    );
    expect(logEntryCreate).not.toHaveBeenCalled();
  });

  it("user A cannot delete user B's logged set", async () => {
    workoutLogFindFirst.mockResolvedValue(null);
    const result = await deleteLoggedSet("session-b", "entry-b");
    expect(result).toEqual({ error: "Session not found." });
    expect(logEntryDeleteMany).not.toHaveBeenCalled();
  });

  it("user A cannot finish user B's session", async () => {
    workoutLogFindFirst.mockResolvedValue(null);
    const result = await finishWorkoutSession("session-b");
    expect(result).toEqual({ error: "Session not found." });
    expect(workoutLogUpdate).not.toHaveBeenCalled();
  });

  it("user A cannot abandon user B's session", async () => {
    workoutLogFindFirst.mockResolvedValue(null);
    const result = await abandonWorkoutSession("session-b");
    expect(result).toEqual({ error: "Session not found." });
    expect(workoutLogUpdate).not.toHaveBeenCalled();
  });

  it("resumes the in-progress session instead of creating a new one", async () => {
    workoutLogFindFirst.mockResolvedValue({ id: "session-a", planId: "plan-a" });
    const result = await startWorkoutSession("plan-a");
    expect(result).toEqual({ success: true, sessionId: "session-a", resumed: true });
    expect(workoutLogCreate).not.toHaveBeenCalled();
  });

  it("finish cancels only pending timers of the user's own session", async () => {
    workoutLogFindFirst.mockResolvedValue({ id: "session-a", planId: "plan-a" });
    const result = await finishWorkoutSession("session-a");
    expect(result).toEqual({ success: true, sessionId: "session-a" });
    expect(restTimerUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-a",
          workoutLogId: "session-a",
          status: "pending",
        }),
      })
    );
  });

  it("rejects invalid set input", async () => {
    workoutLogFindFirst.mockResolvedValue({ id: "session-a", planId: "plan-a" });
    const result = await logSet("session-a", {
      exerciseName: "",
      setNumber: -1,
      weight: -5,
      reps: 5,
    });
    expect(result).toEqual({ error: "Invalid set." });
    expect(logEntryCreate).not.toHaveBeenCalled();
  });

  it("abandoning marks the session abandoned (never counted)", async () => {
    workoutLogFindFirst.mockResolvedValue({ id: "session-a", planId: "plan-a" });
    const result = await abandonWorkoutSession("session-a");
    expect(result).toEqual({ success: true });
    expect(workoutLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-a" },
        data: expect.objectContaining({ status: "abandoned" }),
      })
    );
  });

  it("finishing marks the session finished", async () => {
    workoutLogFindFirst.mockResolvedValue({ id: "session-a", planId: "plan-a" });
    const result = await finishWorkoutSession("session-a");
    expect(result).toEqual({ success: true, sessionId: "session-a" });
    expect(workoutLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-a" },
        data: expect.objectContaining({ status: "finished" }),
      })
    );
  });
});
