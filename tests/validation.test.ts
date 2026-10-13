import { describe, expect, it } from "vitest";
import {
  completedSetsSchema,
  delaySecondsSchema,
  emailSchema,
  idSchema,
  repsSchema,
  restSecondsSchema,
  setsSchema,
  tokenSchema,
  weightSchema,
} from "@/lib/validation";

describe("validation", () => {
  it("rejects empty ids", () => {
    expect(idSchema.safeParse("").success).toBe(false);
    expect(idSchema.safeParse("abc123").success).toBe(true);
  });

  it("normalizes emails", () => {
    expect(emailSchema.safeParse("User@Example.COM").data).toBe("user@example.com");
    expect(emailSchema.safeParse("geen-email").success).toBe(false);
  });

  it("rejects negative numbers and enforces maxima", () => {
    expect(setsSchema.safeParse(0).success).toBe(false);
    expect(setsSchema.safeParse(21).success).toBe(false);
    expect(setsSchema.safeParse(4).success).toBe(true);
    expect(weightSchema.safeParse(-1).success).toBe(false);
    expect(weightSchema.safeParse(1001).success).toBe(false);
    expect(repsSchema.safeParse(-1).success).toBe(false);
    expect(restSecondsSchema.safeParse(3601).success).toBe(false);
    expect(delaySecondsSchema.safeParse(0).success).toBe(false);
  });

  it("validates completed set arrays with size limits", () => {
    const ok = completedSetsSchema.safeParse([
      { exerciseName: "Squat", setNumber: 1, weight: 80, reps: 5, durationSeconds: null },
      { exerciseName: "Plank", setNumber: 1, weight: null, reps: 0, durationSeconds: 60 },
    ]);
    expect(ok.success).toBe(true);
    expect(completedSetsSchema.safeParse([{ exerciseName: "", setNumber: 1 }]).success).toBe(false);
    expect(
      completedSetsSchema.safeParse(new Array(501).fill({ exerciseName: "Squat", setNumber: 1 }))
        .success
    ).toBe(false);
  });

  it("rejects empty tokens", () => {
    expect(tokenSchema.safeParse("").success).toBe(false);
    expect(tokenSchema.safeParse("tok-1").success).toBe(true);
  });
});
