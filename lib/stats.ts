import { sessionMetric, type StrengthEntry, type StrengthWorkout, type TrackingMode } from "@/lib/strength";

export interface PlanWorkout extends StrengthWorkout {
  planId?: string | null;
  planName?: string | null;
}

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

function mondayKey(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  const dow = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - dow);
  return utc.toISOString().slice(0, 10);
}

/** Training volume (kg lifted) per week, keyed by Amsterdam Monday. */
export function volumePerWeek(workouts: StrengthWorkout[]) {
  const totals = new Map<string, number>();
  for (const workout of workouts) {
    const week = mondayKey(amsterdamDateKey(workout.completedAt));
    let volume = 0;
    for (const entry of workout.entries) {
      if (entry.tracking === "weight" && entry.weight != null) {
        volume += entry.weight * entry.reps;
      }
    }
    totals.set(week, (totals.get(week) ?? 0) + volume);
  }
  return [...totals.entries()]
    .map(([week, volume]) => ({ week, volume: Math.round(volume) }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/** Training volume per plan. */
export function volumePerPlan(workouts: PlanWorkout[]) {
  const totals = new Map<string, { name: string; volume: number; sessions: number }>();
  for (const workout of workouts) {
    const key = workout.planId ?? "other";
    const row = totals.get(key) ?? { name: workout.planName ?? "Zonder plan", volume: 0, sessions: 0 };
    row.sessions += 1;
    for (const entry of workout.entries) {
      if (entry.tracking === "weight" && entry.weight != null) {
        row.volume += entry.weight * entry.reps;
      }
    }
    totals.set(key, row);
  }
  return [...totals.values()]
    .map((row) => ({ ...row, volume: Math.round(row.volume) }))
    .sort((a, b) => b.volume - a.volume);
}

/** Completed workouts per week, keyed by Amsterdam Monday. */
export function workoutsPerWeek(workouts: StrengthWorkout[]) {
  const counts = new Map<string, number>();
  for (const workout of workouts) {
    const week = mondayKey(amsterdamDateKey(workout.completedAt));
    counts.set(week, (counts.get(week) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([week, sessions]) => ({ week, sessions }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

function shiftDateKey(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

/**
 * Current and longest streak against the schedule: consecutive scheduled
 * training days (dayOfWeek with a plan) that each have a logged workout.
 */
export function scheduleStreaks(
  workoutDateKeys: string[],
  scheduledDays: number[],
  todayKey: string
) {
  const trained = new Set(workoutDateKeys);
  const scheduled = new Set(scheduledDays);
  if (scheduled.size === 0) return { current: 0, longest: 0 };

  const hasTraining = (key: string) => {
    const dow = new Date(`${key}T12:00:00Z`).getUTCDay();
    return scheduled.has(dow) && trained.has(key);
  };
  const isScheduled = (key: string) => scheduled.has(new Date(`${key}T12:00:00Z`).getUTCDay());

  // Walk back from today over scheduled days only.
  let current = 0;
  let cursor = todayKey;
  if (!isScheduled(cursor)) {
    // Today is a rest day: streak counts up to the latest scheduled day.
    for (let i = 0; i < 7 && !isScheduled(cursor); i++) {
      cursor = shiftDateKey(cursor, -1);
    }
  }
  while (hasTraining(cursor)) {
    current += 1;
    do {
      cursor = shiftDateKey(cursor, -1);
    } while (!isScheduled(cursor));
  }

  // Longest run across the whole history (bounded scan).
  let longest = 0;
  let run = 0;
  let day = shiftDateKey(todayKey, -730);
  while (day <= todayKey) {
    if (!isScheduled(day)) {
      day = shiftDateKey(day, 1);
      continue;
    }
    if (trained.has(day)) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
    day = shiftDateKey(day, 1);
  }

  return { current, longest };
}

export interface ExerciseSeriesPoint {
  date: string;
  score: number;
}

/** Per-exercise progress series (one score per session) for charts. */
export function exerciseSeries(workouts: StrengthWorkout[]): Record<string, { tracking: TrackingMode; points: ExerciseSeriesPoint[] }> {
  const series: Record<string, { tracking: TrackingMode; points: ExerciseSeriesPoint[] }> = {};
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

/** Best per exercise: top weight, estimated 1RM, best reps, best hold. */
export function exerciseBests(workouts: StrengthWorkout[]) {
  const bests = new Map<
    string,
    { tracking: TrackingMode; topWeight: number; e1rm: number; bestReps: number; bestHold: number }
  >();
  for (const workout of workouts) {
    for (const entry of workout.entries) {
      const name = entry.exerciseName.trim() || "Oefening";
      const row = bests.get(name) ?? { tracking: entry.tracking, topWeight: 0, e1rm: 0, bestReps: 0, bestHold: 0 };
      row.tracking = entry.tracking;
      if (entry.tracking === "weight" && entry.weight != null) {
        row.topWeight = Math.max(row.topWeight, entry.weight);
        const estimate = entry.reps === 1 ? entry.weight : entry.reps > 0 ? entry.weight * (1 + entry.reps / 30) : 0;
        row.e1rm = Math.max(row.e1rm, estimate);
      } else if (entry.tracking === "reps") {
        row.bestReps = Math.max(row.bestReps, entry.reps);
      } else if (entry.tracking === "hold" && entry.durationSeconds != null) {
        row.bestHold = Math.max(row.bestHold, entry.durationSeconds);
      }
      bests.set(name, row);
    }
  }
  return [...bests.entries()]
    .map(([name, row]) => ({ name, ...row }))
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));
}
