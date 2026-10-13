import { describe, expect, it } from "vitest";
import {
  clampReviewSeconds,
  holdElapsedFraction,
  holdElapsedSeconds,
  holdPersonalBest,
  holdProgress,
  reachedGoal,
} from "@/lib/hold-timer";

describe("hold timer math", () => {
  it("measures whole seconds from timestamps", () => {
    expect(holdElapsedSeconds(1000, 1000)).toBe(0);
    expect(holdElapsedSeconds(1000, 1999)).toBe(0);
    expect(holdElapsedSeconds(1000, 2000)).toBe(1);
    expect(holdElapsedSeconds(1000, 12500)).toBe(11);
    expect(holdElapsedSeconds(5000, 1000)).toBe(0);
  });

  it("measures fractional seconds for progress", () => {
    expect(holdElapsedFraction(1000, 1500)).toBeCloseTo(0.5, 5);
    expect(holdElapsedFraction(1000, 1000)).toBe(0);
  });

  it("auto-stops exactly at the goal", () => {
    expect(reachedGoal(11, 12)).toBe(false);
    expect(reachedGoal(12, 12)).toBe(true);
    expect(reachedGoal(13, 12)).toBe(true);
    expect(reachedGoal(5, null)).toBe(false);
    expect(reachedGoal(5, 0)).toBe(false);
  });

  it("fills progress towards the goal", () => {
    expect(holdProgress(6, 12)).toBeCloseTo(0.5, 5);
    expect(holdProgress(0, 12)).toBe(0);
    expect(holdProgress(20, 12)).toBe(1);
    expect(holdProgress(5, null)).toBeNull();
  });

  it("clamps review seconds to a minimum of 0", () => {
    expect(clampReviewSeconds(12.6)).toBe(13);
    expect(clampReviewSeconds(-3)).toBe(0);
    expect(clampReviewSeconds(Number.NaN)).toBe(0);
  });

  it("takes the personal best from previous hold sets", () => {
    expect(holdPersonalBest(undefined)).toBeNull();
    expect(holdPersonalBest([])).toBeNull();
    expect(
      holdPersonalBest([{ durationSeconds: 8 }, { durationSeconds: null }, { durationSeconds: 10 }])
    ).toBe(10);
    expect(holdPersonalBest([{ durationSeconds: 0 }])).toBeNull();
  });
});
