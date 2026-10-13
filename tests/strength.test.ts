import { describe, expect, it } from "vitest";
import { placeholderSet } from "@/lib/strength";

describe("placeholderSet", () => {
  it("uses the same set number, falling back to the last set", () => {
    const previous = [
      { exerciseName: "Squat", weight: 80, reps: 5, durationSeconds: null, tracking: "weight" as const },
      { exerciseName: "Squat", weight: 82.5, reps: 5, durationSeconds: null, tracking: "weight" as const },
    ];
    expect(placeholderSet(previous, 1)?.weight).toBe(80);
    expect(placeholderSet(previous, 2)?.weight).toBe(82.5);
    expect(placeholderSet(previous, 9)?.weight).toBe(82.5);
    expect(placeholderSet(undefined, 1)).toBeUndefined();
    expect(placeholderSet([], 1)).toBeUndefined();
  });
});
