export type ExerciseTracking = "weight" | "reps" | "hold";

export const TRACKING_OPTIONS: { id: ExerciseTracking; label: string }[] = [
  { id: "weight", label: "Weight" },
  { id: "reps", label: "Bodyweight" },
  { id: "hold", label: "Hold" },
];

export function isTracking(value: string | null | undefined): value is ExerciseTracking {
  return value === "weight" || value === "reps" || value === "hold";
}

export function asTracking(value: string | null | undefined): ExerciseTracking {
  return isTracking(value) ? value : "weight";
}

export const EXERCISE_LIBRARY: { name: string; tracking: ExerciseTracking }[] = [
  { name: "Bench Press", tracking: "weight" },
  { name: "Incline Bench Press", tracking: "weight" },
  { name: "Dumbbell Bench Press", tracking: "weight" },
  { name: "Overhead Press", tracking: "weight" },
  { name: "Squat", tracking: "weight" },
  { name: "Front Squat", tracking: "weight" },
  { name: "Deadlift", tracking: "weight" },
  { name: "Romanian Deadlift", tracking: "weight" },
  { name: "Barbell Row", tracking: "weight" },
  { name: "Lat Pulldown", tracking: "weight" },
  { name: "Leg Press", tracking: "weight" },
  { name: "Hip Thrust", tracking: "weight" },
  { name: "Bulgarian Split Squat", tracking: "weight" },
  { name: "Lunge", tracking: "weight" },
  { name: "Bicep Curl", tracking: "weight" },
  { name: "Tricep Pushdown", tracking: "weight" },
  { name: "Lateral Raise", tracking: "weight" },
  { name: "Face Pull", tracking: "weight" },
  { name: "Calf Raise", tracking: "weight" },
  { name: "Push-up", tracking: "reps" },
  { name: "Diamond Push-up", tracking: "reps" },
  { name: "Pike Push-up", tracking: "reps" },
  { name: "Dip", tracking: "reps" },
  { name: "Pull-up", tracking: "reps" },
  { name: "Chin-up", tracking: "reps" },
  { name: "Handstand Push-up", tracking: "reps" },
  { name: "Muscle-up", tracking: "reps" },
  { name: "Inverted Row", tracking: "reps" },
  { name: "Pistol Squat", tracking: "reps" },
  { name: "Hanging Leg Raise", tracking: "reps" },
  { name: "Burpee", tracking: "reps" },
  { name: "Plank", tracking: "hold" },
  { name: "Side Plank", tracking: "hold" },
  { name: "Hollow Hold", tracking: "hold" },
  { name: "L-sit", tracking: "hold" },
  { name: "Dead Hang", tracking: "hold" },
  { name: "Wall Sit", tracking: "hold" },
  { name: "Handstand Hold", tracking: "hold" },
  { name: "Front Lever", tracking: "hold" },
  { name: "Back Lever", tracking: "hold" },
  { name: "Planche", tracking: "hold" },
];

export function libraryMatch(name: string) {
  const key = name.trim().toLocaleLowerCase("nl");
  return EXERCISE_LIBRARY.find((exercise) => exercise.name.toLocaleLowerCase("nl") === key) ?? null;
}
