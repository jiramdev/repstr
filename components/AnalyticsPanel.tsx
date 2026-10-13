import dynamic from "next/dynamic";
import { Trophy } from "lucide-react";
import MonthCalendar from "@/components/MonthCalendar";
import type { StrengthEntry, TrackingMode } from "@/lib/strength";
import {
  exerciseBests,
  exerciseSeries,
  type HistoryWorkout,
} from "@/lib/stats";
import { formatAmsterdamDate } from "@/lib/amsterdam";

const ExerciseProgressChart = dynamic(() => import("@/components/ExerciseProgressChart"), {
  loading: () => (
    <div className="bg-[#1b1b1e] rounded-2xl px-4 py-6 border border-white/[0.04] animate-pulse">
      <div className="h-4 w-1/2 bg-white/[0.06] rounded-full" />
    </div>
  ),
});

const TZ = "Europe/Amsterdam";

function dateKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

type Workout = {
  id?: string;
  planId?: string | null;
  planName?: string | null;
  completedAt: string;
  entries: (StrengthEntry & { tracking: TrackingMode; setNumber?: number })[];
};

type WeightLog = { weight: number; loggedAt: string };

export default function AnalyticsPanel({
  workouts,
  weightLogs,
}: {
  workouts: Workout[];
  weightLogs: WeightLog[];
}) {
  const totalWorkouts = workouts.length;
  const workoutDates = workouts.map((workout) => dateKey(workout.completedAt));
  const todayKey = dateKey(new Date().toISOString());

  const latestWeight = weightLogs.at(-1)?.weight;

  const series = exerciseSeries(workouts);
  const bests = exerciseBests(workouts);
  const history: HistoryWorkout[] = [...workouts]
    .reverse()
    .map((workout, idx) => ({
      id: workout.id ?? `workout-${idx}`,
      completedAt: workout.completedAt,
      planName: workout.planName ?? null,
      entries: workout.entries.map((entry) => ({
        exerciseName: entry.exerciseName,
        weight: entry.weight,
        reps: entry.reps,
        durationSeconds: entry.durationSeconds,
        tracking: entry.tracking,
      })),
    }));

  return (
    <div className="min-h-screen bg-[#baa3d0] text-white pb-32 pt-4 px-4 select-none">
      <main className="max-w-sm mx-auto space-y-3.5">
        <header className="flex items-center px-1 py-1">
          <div className="h-10 bg-[#141416] border border-white/[0.08] px-4 rounded-full flex items-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
            <span className="w-2 h-2 rounded-full bg-[#baa3d0]" />
            <span className="font-editorial text-[14px] tracking-wider text-white leading-none uppercase">
              STATISTICS
            </span>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 text-center flex flex-col justify-between items-center aspect-square shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
              Weight
            </span>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[48px] font-editorial tracking-tight text-white leading-none block">
                {latestWeight == null ? "--" : Number(latestWeight.toFixed(1))}
              </span>
            </div>
            <span className="text-[12px] text-[#a1a1aa] font-medium">kg</span>
          </div>

          <div className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 text-center flex flex-col justify-between items-center aspect-square shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
              Workouts
            </span>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[48px] font-editorial tracking-tight text-white leading-none block">
                {totalWorkouts}
              </span>
            </div>
            <span className="text-[12px] text-[#a1a1aa] font-medium">completed</span>
          </div>
        </div>

        <MonthCalendar workoutDates={workoutDates} todayKey={todayKey} />

        <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
              PRs
            </span>
            <Trophy className="w-3.5 h-3.5 text-[#baa3d0]" />
          </div>
          {bests.length === 0 ? (
            <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04]">
              <span className="text-[14px] font-medium text-[#71717a]">No PRs yet</span>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {bests.map((pr) => (
                <div
                  key={pr.name}
                  className="bg-[#1b1b1e] rounded-2xl px-4 py-3 flex items-center justify-between gap-3 border border-white/[0.04]"
                >
                  <span className="text-[14px] font-medium text-white truncate">{pr.name}</span>
                  <div className="flex items-baseline gap-1.5 shrink-0">
                    <span className="font-editorial text-[22px] text-[#baa3d0] tracking-wider leading-none">
                      {pr.tracking === "weight"
                        ? Number(pr.topWeight.toFixed(1))
                        : pr.tracking === "reps"
                          ? pr.bestReps
                          : pr.bestHold}
                    </span>
                    <span className="text-[11px] text-[#71717a] font-medium">
                      {pr.tracking === "weight" ? "kg" : pr.tracking === "reps" ? "reps" : "sec"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
              Progress per exercise
            </span>
          </div>
          <ExerciseProgressChart series={series} bests={bests} />
        </section>

        <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
              History
            </span>
          </div>
          {history.length === 0 ? (
            <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04]">
              <span className="text-[14px] font-medium text-[#71717a]">No workouts yet</span>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {history.map((workout) => (
                <details
                  key={workout.id}
                  className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04] group"
                >
                  <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                    <span className="text-[14px] font-medium text-white truncate">
                      {formatAmsterdamDate(workout.completedAt)}
                      {workout.planName ? ` · ${workout.planName}` : ""}
                    </span>
                    <span className="text-[11px] text-[#71717a] font-medium shrink-0">
                      {workout.entries.length} {workout.entries.length === 1 ? "set" : "sets"}
                    </span>
                  </summary>
                  <div className="pt-2 space-y-1">
                    {workout.entries.map((entry, idx) => (
                      <p key={idx} className="text-[12px] text-[#a1a1aa]">
                        {entry.exerciseName} ·{" "}
                        {entry.tracking === "hold"
                          ? `${entry.durationSeconds ?? 0} sec`
                          : entry.tracking === "weight"
                            ? `${entry.reps}x ${entry.weight ?? 0} kg`
                            : `${entry.reps} reps`}
                      </p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
