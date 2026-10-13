// app/workout/active/page.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveSession, getActiveWorkout } from "@/lib/queries";
import { redirect } from "next/navigation";
import SubpageHeader from "@/components/SubpageHeader";
import ActiveWorkoutLogger from "./ActiveWorkoutLogger";

interface PageProps {
  searchParams: Promise<{ planId?: string }>;
}

export default async function ActiveWorkoutPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { planId } = await searchParams;
  // Resume the in-progress session from the server, even on another device.
  const activeSession = await getActiveSession(session.user.id);
  const effectivePlanId = activeSession?.planId ?? planId;
  const workout = await getActiveWorkout(session.user.id, effectivePlanId ?? undefined);

  return (
    <div className="min-h-screen bg-[#baa3d0] text-white pb-10 pt-4 px-4 select-none">
      <main className="max-w-sm mx-auto space-y-3.5">
        {workout.exercises.length === 0 ? (
          <>
            <SubpageHeader title="Workout" href="/schedule" />
            <section className="bg-[#141416] border border-white/[0.08] rounded-[34px] px-6 py-12 text-center shadow-[0_16px_36px_rgba(0,0,0,0.25)]">
              <p className="font-editorial text-[28px] text-white leading-none">Geen oefeningen</p>
              <p className="mt-3 text-[13px] text-[#a1a1aa]">
                Dit plan heeft nog geen oefeningen. Voeg ze toe in je schema.
              </p>
              <Link
                href="/schedule"
                className="mt-6 inline-block bg-[#baa3d0] text-[#141416] rounded-full px-5 py-3 font-editorial text-[16px] tracking-wider apple-press"
              >
                NAAR SCHEMA
              </Link>
            </section>
          </>
        ) : (
          <ActiveWorkoutLogger
            userId={session.user.id}
            planId={effectivePlanId}
            exercises={workout.exercises}
            previousSets={workout.previousSets}
            initialSession={
              activeSession
                ? {
                    id: activeSession.id,
                    planId: activeSession.planId,
                    startedAt: activeSession.startedAt.toISOString(),
                    entries: activeSession.entries,
                  }
                : null
            }
          />
        )}
      </main>
    </div>
  );
}
