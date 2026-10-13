import { describe, expect, it } from "vitest";
import { exerciseBests, exerciseSeries, sessionTop } from "@/lib/stats";
import type { StrengthWorkout } from "@/lib/strength";
import { placeholderSet } from "@/lib/strength";

function workout(date: string, entries: StrengthWorkout["entries"]): StrengthWorkout {
  return { completedAt: date, entries };
}

describe("sessionTop", () => {
  it("reports the real maximum without estimates", () => {
    expect(
      sessionTop([{ exerciseName: "Squat", weight: 80, reps: 5, durationSeconds: null, tracking: "weight" }])
    ).toEqual({ tracking: "weight", score: 80 });
    expect(
      sessionTop([{ exerciseName: "Push-up", weight: null, reps: 12, durationSeconds: null, tracking: "reps" }])
    ).toEqual({ tracking: "reps", score: 12 });
    expect(
      sessionTop([{ exerciseName: "Plank", weight: null, reps: 0, durationSeconds: 60, tracking: "hold" }])
    ).toEqual({ tracking: "hold", score: 60 });
    expect(sessionTop([])).toBeNull();
  });
});

describe("exerciseSeries", () => {
  it("builds one top score per session sorted by date", () => {
    const series = exerciseSeries([
      workout("2026-10-14T18:00:00Z", [
        { exerciseName: "Squat", weight: 100, reps: 3, durationSeconds: null, tracking: "weight" },
      ]),
      workout("2026-10-12T18:00:00Z", [
        { exerciseName: "Squat", weight: 80, reps: 5, durationSeconds: null, tracking: "weight" },
      ]),
    ]);
    expect(series["Squat"]?.points.map((point) => point.date)).toEqual(["2026-10-12", "2026-10-14"]);
    expect(series["Squat"]?.points.map((point) => point.score)).toEqual([80, 100]);
  });
});

describe("exerciseBests", () => {
  it("reports top weight, best reps and best hold", () => {
    const bests = exerciseBests([
      workout("2026-10-12T18:00:00Z", [
        { exerciseName: "Squat", weight: 80, reps: 5, durationSeconds: null, tracking: "weight" },
        { exerciseName: "Push-up", weight: null, reps: 12, durationSeconds: null, tracking: "reps" },
        { exerciseName: "Plank", weight: null, reps: 0, durationSeconds: 60, tracking: "hold" },
      ]),
    ]);
    expect(bests.find((row) => row.name === "Squat")?.topWeight).toBe(80);
    expect(bests.find((row) => row.name === "Push-up")?.bestReps).toBe(12);
    expect(bests.find((row) => row.name === "Plank")?.bestHold).toBe(60);
  });

  it("uses the single heaviest set as the best", () => {
    const bests = exerciseBests([
      workout("2026-10-12T18:00:00Z", [
        { exerciseName: "Squat", weight: 80, reps: 8, durationSeconds: null, tracking: "weight" },
        { exerciseName: "Squat", weight: 100, reps: 1, durationSeconds: null, tracking: "weight" },
      ]),
    ]);
    expect(bests.find((row) => row.name === "Squat")?.topWeight).toBe(100);
  });
});

describe("placeholderSet", () => {
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
