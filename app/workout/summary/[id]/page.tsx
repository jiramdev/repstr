// app/workout/summary/[id]/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import SubpageHeader from "@/components/SubpageHeader";
import { formatAmsterdamDate } from "@/lib/amsterdam";
import { asTracking } from "@/lib/exercise-library";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}

function formatDuration(startedAt: Date, completedAt: Date | null) {
  if (!completedAt) return "—";
  const minutes = Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function formatSet(entry: { weight: number | null; reps: number; durationSeconds: number | null; tracking: string }) {
  if (entry.tracking === "hold") return `${entry.durationSeconds ?? 0} sec`;
  if (entry.tracking === "weight") return `${entry.weight ?? 0} × ${entry.reps}`;
  return `${entry.reps} reps`;
}

export default async function WorkoutSummaryPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { from } = await searchParams;
  const backHref = from === "/analytics" ? "/analytics" : "/";
  const workout = await prisma.workoutLog.findFirst({
    where: { id, userId: session.user.id },
    select: {
      startedAt: true,
      completedAt: true,
      plan: { select: { name: true } },
      entries: {
        select: {
          exerciseName: true,
          setNumber: true,
          weight: true,
          reps: true,
          durationSeconds: true,
          exercise: { select: { name: true, tracking: true } },
        },
        orderBy: [{ exerciseName: "asc" }, { setNumber: "asc" }],
      },
    },
  });
  if (!workout) notFound();

  const groups = new Map<string, { tracking: string; sets: { weight: number | null; reps: number; durationSeconds: number | null }[] }>();
  for (const entry of workout.entries) {
    const name = entry.exercise?.name || entry.exerciseName;
    const group = groups.get(name) ?? { tracking: asTracking(entry.exercise?.tracking), sets: [] };
    group.sets.push({ weight: entry.weight, reps: entry.reps, durationSeconds: entry.durationSeconds });
    groups.set(name, group);
  }

  const totalSets = workout.entries.length;
  const totalVolume = Math.round(
    workout.entries.reduce((sum, entry) => sum + (entry.weight ?? 0) * entry.reps, 0)
  );

  return (
    <div className="min-h-dvh bg-[#baa3d0] text-white pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4 px-4 select-none">
      <main className="max-w-sm mx-auto space-y-3.5">
        <SubpageHeader title="Workout" href={backHref} />

        <section className="bg-[#141416] border border-white/[0.08] rounded-[34px] px-6 py-8 text-center shadow-[0_16px_36px_rgba(0,0,0,0.25)] space-y-2">
          <p className="text-[12px] font-semibold tracking-[0.2em] text-[#baa3d0] uppercase">
            {formatAmsterdamDate(workout.completedAt ?? workout.startedAt)}
          </p>
          <h1 className="font-editorial text-[36px] tracking-wide text-white leading-none">
            {workout.plan?.name ?? "Workout"}
          </h1>
          <p className="text-[13px] text-[#a1a1aa]">
            {formatDuration(workout.startedAt, workout.completedAt)} · {totalSets}{" "}
            {totalSets === 1 ? "set" : "sets"} · {totalVolume} kg
          </p>
        </section>

        <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
              Exercises
            </span>
          </div>
          {groups.size === 0 ? (
            <div className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04]">
              <span className="text-[14px] font-medium text-[#71717a]">No sets logged</span>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {[...groups.entries()].map(([name, group]) => (
                <div
                  key={name}
                  className="bg-[#1b1b1e] rounded-2xl px-4 py-3 border border-white/[0.04]"
                >
                  <p className="text-[14px] font-medium text-white">{name}</p>
                  <p className="mt-1 text-[12px] text-[#a1a1aa]">
                    {group.sets.map((set) => formatSet({ ...set, tracking: group.tracking })).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <Link
          href={backHref}
          prefetch={true}
          className="block w-full bg-[#141416] border border-white/[0.08] rounded-[30px] py-4 text-center apple-press shadow-[0_12px_28px_rgba(0,0,0,0.2)]"
        >
          <span className="font-editorial text-[20px] tracking-wider text-[#baa3d0] uppercase leading-none block">
            DONE
          </span>
        </Link>
      </main>
    </div>
  );
}
