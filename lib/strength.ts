export type TrackingMode = "weight" | "reps" | "hold";

export type StrengthEntry = {
  exerciseName: string;
  weight: number | null;
  reps: number;
  durationSeconds: number | null;
  tracking: TrackingMode;
};

export type StrengthWorkout = {
  completedAt: string;
  entries: StrengthEntry[];
};

/** Placeholder source for a set: the same set number last time, else the last set. */
export function placeholderSet<T>(previous: T[] | undefined, setNumber: number): T | undefined {
  if (!previous?.length) return undefined;
  return previous[setNumber - 1] ?? previous[previous.length - 1];
}
