import { describe, expect, it } from "vitest";
import {
  exerciseBests,
  exerciseSeries,
  scheduleStreaks,
  volumePerPlan,
  volumePerWeek,
  workoutsPerWeek,
} from "@/lib/stats";
import { placeholderSet } from "@/lib/strength";
import type { StrengthWorkout } from "@/lib/strength";

function workout(date: string, entries: StrengthWorkout["entries"]): StrengthWorkout {
  return { completedAt: date, entries };
}

describe("volumePerWeek", () => {
  it("sums weight x reps per Amsterdam week and ignores bodyweight sets", () => {
    const workouts = [
      workout("2026-10-12T18:00:00Z", [
        { exerciseName: "Squat", weight: 80, reps: 5, durationSeconds: null, tracking: "weight" },
        { exerciseName: "Push-up", weight: null, reps: 12, durationSeconds: null, tracking: "reps" },
      ]),
      workout("2026-10-14T18:00:00Z", [
        { exerciseName: "Squat", weight: 100, reps: 3, durationSeconds: null, tracking: "weight" },
      ]),
    ];
    expect(volumePerWeek(workouts)).toEqual([{ week: "2026-10-12", volume: 700 }]);
  });
});

describe("volumePerPlan", () => {
  it("groups volume and sessions per plan", () => {
    const result = volumePerPlan([
      { ...workout("2026-10-12T18:00:00Z", [
        { exerciseName: "Squat", weight: 80, reps: 5, durationSeconds: null, tracking: "weight" },
      ]), planId: "plan-a", planName: "Push" },
      { ...workout("2026-10-13T18:00:00Z", [
        { exerciseName: "Push-up", weight: null, reps: 10, durationSeconds: null, tracking: "reps" },
      ]), planId: "plan-a", planName: "Push" },
    ]);
    expect(result).toEqual([{ name: "Push", volume: 400, sessions: 2 }]);
  });
});

describe("workoutsPerWeek", () => {
  it("counts sessions per week", () => {
    const workouts = [
      workout("2026-10-12T18:00:00Z", []),
      workout("2026-10-13T18:00:00Z", []),
      workout("2026-10-19T18:00:00Z", []),
    ];
    expect(workoutsPerWeek(workouts)).toEqual([
      { week: "2026-10-12", sessions: 2 },
      { week: "2026-10-19", sessions: 1 },
    ]);
  });
});

describe("scheduleStreaks", () => {
  it("counts consecutive scheduled training days", () => {
    // Mon + Wed scheduled; trained both.
    expect(scheduleStreaks(["2026-10-12", "2026-10-14"], [1, 3], "2026-10-14")).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it("breaks the streak on a missed scheduled day", () => {
    expect(scheduleStreaks(["2026-10-12"], [1, 3], "2026-10-14")).toEqual({
      current: 0,
      longest: 1,
    });
  });

  it("counts up to the latest scheduled day on a rest day", () => {
    expect(scheduleStreaks(["2026-10-12", "2026-10-14"], [1, 3], "2026-10-15")).toEqual({
      current: 2,
      longest: 2,
    });
  });

  it("returns zero without a schedule", () => {
    expect(scheduleStreaks(["2026-10-12"], [], "2026-10-12")).toEqual({ current: 0, longest: 0 });
  });
});

describe("exerciseSeries", () => {
  it("builds one score per session sorted by date", () => {
    const series = exerciseSeries([
      workout("2026-10-14T18:00:00Z", [
        { exerciseName: "Squat", weight: 100, reps: 3, durationSeconds: null, tracking: "weight" },
      ]),
      workout("2026-10-12T18:00:00Z", [
        { exerciseName: "Squat", weight: 80, reps: 5, durationSeconds: null, tracking: "weight" },
      ]),
    ]);
    expect(series["Squat"]?.points.map((point) => point.date)).toEqual(["2026-10-12", "2026-10-14"]);
    expect(series["Squat"]?.points[0]?.score).toBeCloseTo(80 * (1 + 5 / 30), 5);
  });
});

describe("exerciseBests", () => {
  it("reports top weight, e1RM, best reps and best hold", () => {
    const bests = exerciseBests([
      workout("2026-10-12T18:00:00Z", [
        { exerciseName: "Squat", weight: 80, reps: 5, durationSeconds: null, tracking: "weight" },
        { exerciseName: "Push-up", weight: null, reps: 12, durationSeconds: null, tracking: "reps" },
        { exerciseName: "Plank", weight: null, reps: 0, durationSeconds: 60, tracking: "hold" },
      ]),
    ]);
    const squat = bests.find((row) => row.name === "Squat");
    expect(squat?.topWeight).toBe(80);
    expect(squat?.e1rm).toBeCloseTo(80 * (1 + 5 / 30), 5);
    expect(bests.find((row) => row.name === "Push-up")?.bestReps).toBe(12);
    expect(bests.find((row) => row.name === "Plank")?.bestHold).toBe(60);
  });

  it("uses the same set number, falling back to the last set", () => {
    const previous = [
      { exerciseName: "Squat", weight: 80, reps: 5, durationSeconds: null, tracking: "weight" as const },
      { exerciseName: "Squat", weight: 82.5, reps: 5, durationSeconds: null, tracking: "weight" as const },
    ];
    expect(placeholderSet(previous, 1)?.weight).toBe(80);
    expect(placeholderSet(previous, 5)?.weight).toBe(82.5);
    expect(placeholderSet(undefined, 1)).toBeUndefined();
  });
});
