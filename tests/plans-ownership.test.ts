import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));

const {
  workoutPlanFindFirst,
  workoutPlanUpdate,
  workoutPlanDelete,
  planExerciseFindFirst,
  planExerciseUpdate,
  planExerciseDelete,
  planExerciseDeleteMany,
  planExerciseFindMany,
  scheduleDayDeleteMany,
  exerciseFindFirst,
  prismaTransaction,
} = vi.hoisted(() => ({
  workoutPlanFindFirst: vi.fn(),
  workoutPlanUpdate: vi.fn(),
  workoutPlanDelete: vi.fn(),
  planExerciseFindFirst: vi.fn(),
  planExerciseUpdate: vi.fn(),
  planExerciseDelete: vi.fn(),
  planExerciseDeleteMany: vi.fn(),
  planExerciseFindMany: vi.fn(),
  scheduleDayDeleteMany: vi.fn(),
  exerciseFindFirst: vi.fn(),
  prismaTransaction: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/queries", () => ({ refreshUserCache: vi.fn() }));
vi.mock("@/lib/revalidate-tabs", () => ({ revalidateTabs: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn, updateTag: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`redirect:${url}`); }) }));
vi.mock("@/lib/prisma", () => ({
  default: {
    workoutPlan: {
      findFirst: workoutPlanFindFirst,
      update: workoutPlanUpdate,
      delete: workoutPlanDelete,
    },
    planExercise: {
      findFirst: planExerciseFindFirst,
      update: planExerciseUpdate,
      delete: planExerciseDelete,
      deleteMany: planExerciseDeleteMany,
      findMany: planExerciseFindMany,
    },
    scheduleDay: { deleteMany: scheduleDayDeleteMany },
    exercise: { findFirst: exerciseFindFirst },
    $transaction: prismaTransaction,
  },
}));

import {
  deletePlan,
  removeExerciseFromPlan,
  reorderExercises,
  updateExercise,
  updatePlanName,
} from "@/app/plans/[id]/actions";
import { assignPlanToDay, createWorkoutPlan } from "@/app/schedule/actions";

describe("plan ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: "user-a" } });
  });

  it("user A cannot rename user B's plan", async () => {
    workoutPlanUpdate.mockRejectedValue(new Error("not found"));
    await expect(updatePlanName("plan-b", "Gehackt")).rejects.toThrow();
    expect(workoutPlanUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "plan-b", userId: "user-a" }) })
    );
  });

  it("user A cannot edit an exercise in user B's plan", async () => {
    planExerciseFindFirst.mockResolvedValue(null);
    const result = await updateExercise("plan-b", "placement-b", "Squat", 3, 90);
    expect(result).toEqual({ error: "Exercise not found." });
    expect(planExerciseUpdate).not.toHaveBeenCalled();
  });

  it("user A cannot remove an exercise from user B's plan", async () => {
    planExerciseFindFirst.mockResolvedValue(null);
    await removeExerciseFromPlan("plan-b", "placement-b");
    expect(planExerciseDelete).not.toHaveBeenCalled();
  });

  it("user A cannot delete user B's plan", async () => {
    workoutPlanFindFirst.mockResolvedValue(null);
    await deletePlan("plan-b");
    expect(workoutPlanDelete).not.toHaveBeenCalled();
    expect(scheduleDayDeleteMany).not.toHaveBeenCalled();
    expect(planExerciseDeleteMany).not.toHaveBeenCalled();
  });

  it("user A cannot schedule user B's plan", async () => {
    workoutPlanFindFirst.mockResolvedValue(null);
    await expect(assignPlanToDay(1, "plan-b")).rejects.toThrow("Plan not found");
  });

  it("rejects an invalid day and an overlong plan name", async () => {
    await expect(assignPlanToDay(7, null)).rejects.toThrow("Invalid day");
    expect(await createWorkoutPlan("x".repeat(81))).toBeNull();
  });

  it("reorders in two phases so the unique order never collides", async () => {
    planExerciseFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    prismaTransaction.mockImplementation(async (ops: unknown) => ops);
    const result = await reorderExercises("plan-a", ["c", "a", "b"]);
    expect(result).toEqual({ success: true });
    expect(prismaTransaction).toHaveBeenCalledTimes(1);
    const ops = prismaTransaction.mock.calls[0][0] as unknown[];
    // 3 temp writes (negative, collision-free) + 3 final writes.
    expect(ops).toHaveLength(6);
  });

  it("rejects a reorder that drops or adds placements", async () => {
    planExerciseFindMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    const result = await reorderExercises("plan-a", ["a", "b", "c"]);
    expect(result).toEqual({ error: "Couldn't save the order." });
    expect(prismaTransaction).not.toHaveBeenCalled();
  });
});
