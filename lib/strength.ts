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

export type ExerciseProgress = {
  name: string;
  tracking: TrackingMode;
  best: number;
  unit: "kg" | "reps" | "sec";
  changePct: number | null;
};

function epley(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function sessionMetric(entries: StrengthEntry[]) {
  if (entries.length === 0) return null;
  const tracking = entries[0]?.tracking ?? "weight";

  if (tracking === "hold") {
    const score = Math.max(0, ...entries.map((entry) => entry.durationSeconds ?? 0));
    return score > 0 ? { tracking, score } : null;
  }

  if (tracking === "reps") {
    const score = Math.max(0, ...entries.map((entry) => entry.reps));
    return score > 0 ? { tracking, score } : null;
  }

  let best = 0;
  let reps = 0;
  for (const entry of entries) {
    const estimate = epley(entry.weight ?? 0, entry.reps);
    if (estimate > best) best = estimate;
    reps = Math.max(reps, entry.reps);
  }
  if (best > 0) return { tracking: "weight" as const, score: best };
  if (reps > 0) return { tracking: "reps" as const, score: reps };

  const hold = Math.max(0, ...entries.map((entry) => entry.durationSeconds ?? 0));
  return hold > 0 ? { tracking: "hold" as const, score: hold } : null;
}

const UNIT = { weight: "kg", reps: "reps", hold: "sec" } as const;

export function exerciseProgress(workouts: StrengthWorkout[]): ExerciseProgress[] {
  const series = new Map<string, { tracking: TrackingMode; scores: number[] }>();

  for (const workout of workouts) {
    const grouped = new Map<string, StrengthEntry[]>();
    for (const entry of workout.entries) {
      const name = entry.exerciseName.trim() || "Oefening";
      const list = grouped.get(name) ?? [];
      list.push(entry);
      grouped.set(name, list);
    }

    for (const [name, entries] of grouped) {
      const metric = sessionMetric(entries);
      if (!metric) continue;
      const row = series.get(name) ?? { tracking: metric.tracking, scores: [] };
      row.tracking = metric.tracking;
      row.scores.push(metric.score);
      series.set(name, row);
    }
  }

  return [...series.entries()]
    .map(([name, row]) => {
      const first = row.scores[0] ?? 0;
      const last = row.scores[row.scores.length - 1] ?? 0;
      const changePct =
        row.scores.length >= 2 && first > 0 ? ((last - first) / first) * 100 : null;
      return {
        name,
        tracking: row.tracking,
        best: Math.max(...row.scores),
        unit: UNIT[row.tracking],
        changePct,
      };
    })
    .sort((a, b) => b.best - a.best || a.name.localeCompare(b.name));
}
