import type { StrengthEntry, StrengthWorkout, TrackingMode } from "@/lib/strength";

export interface HistorySet {
  exerciseName: string;
  weight: number | null;
  reps: number;
  durationSeconds: number | null;
  tracking: TrackingMode;
}

export interface HistoryWorkout {
  id: string;
  completedAt: string;
  planName: string | null;
  entries: HistorySet[];
}

function amsterdamDateKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Real maximum per session: top weight, best reps, best hold. No estimates. */
export function sessionTop(entries: StrengthEntry[]) {
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

  const score = Math.max(0, ...entries.map((entry) => entry.weight ?? 0));
  return score > 0 ? { tracking: "weight" as const, score } : null;
}

export interface ExerciseSeriesPoint {
  date: string;
  score: number;
}

/** Per-exercise progress series (one top score per session) for charts. */
export function exerciseSeries(workouts: StrengthWorkout[]): Record<string, { tracking: TrackingMode; points: ExerciseSeriesPoint[] }> {
  const series: Record<string, { tracking: TrackingMode; points: ExerciseSeriesPoint[] }> = {};
  for (const workout of workouts) {
    const grouped = new Map<string, StrengthEntry[]>();
    for (const entry of workout.entries) {
      const name = entry.exerciseName.trim() || "Exercise";
      const list = grouped.get(name) ?? [];
      list.push(entry);
      grouped.set(name, list);
    }
    for (const [name, entries] of grouped) {
      const metric = sessionTop(entries);
      if (!metric) continue;
      const row = series[name] ?? { tracking: metric.tracking, points: [] };
      row.tracking = metric.tracking;
      row.points.push({ date: amsterdamDateKey(workout.completedAt), score: metric.score });
      series[name] = row;
    }
  }
  for (const row of Object.values(series)) {
    row.points.sort((a, b) => a.date.localeCompare(b.date));
  }
  return series;
}

/** Best per exercise: top weight, best reps, best hold. Entries that
    contribute nothing (null/zero) never produce a phantom "0 kg" row. */
export function exerciseBests(workouts: StrengthWorkout[]) {
  const bests = new Map<
    string,
    { tracking: TrackingMode; topWeight: number; bestReps: number; bestHold: number }
  >();
  for (const workout of workouts) {
    for (const entry of workout.entries) {
      const name = entry.exerciseName.trim() || "Exercise";
      if (entry.tracking === "weight") {
        if (entry.weight == null || entry.weight <= 0) continue;
        const row = bests.get(name) ?? { tracking: entry.tracking, topWeight: 0, bestReps: 0, bestHold: 0 };
        row.tracking = entry.tracking;
        row.topWeight = Math.max(row.topWeight, entry.weight);
        bests.set(name, row);
      } else if (entry.tracking === "reps") {
        if (entry.reps <= 0) continue;
        const row = bests.get(name) ?? { tracking: entry.tracking, topWeight: 0, bestReps: 0, bestHold: 0 };
        row.tracking = entry.tracking;
        row.bestReps = Math.max(row.bestReps, entry.reps);
        bests.set(name, row);
      } else if (entry.tracking === "hold") {
        if (entry.durationSeconds == null || entry.durationSeconds <= 0) continue;
        const row = bests.get(name) ?? { tracking: entry.tracking, topWeight: 0, bestReps: 0, bestHold: 0 };
        row.tracking = entry.tracking;
        row.bestHold = Math.max(row.bestHold, entry.durationSeconds);
        bests.set(name, row);
      }
    }
  }
  return [...bests.entries()]
    .map(([name, row]) => ({ name, ...row }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}
