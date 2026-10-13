// app/plans/[id]/page.tsx
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import PlanEditor from "./PlanEditor";
import SubpageHeader from "@/components/SubpageHeader";
import { asTracking } from "@/lib/exercise-library";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPlanPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const [plan, library] = await Promise.all([
    prisma.workoutPlan.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
                tracking: true,
                defaultSets: true,
                repGoal: true,
                restSeconds: true,
              },
            },
          },
        },
      },
    }),
    prisma.exercise.findMany({
      where: { userId: session.user.id, archived: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        tracking: true,
        defaultSets: true,
        repGoal: true,
        restSeconds: true,
      },
    }),
  ]);

  if (!plan) {
    notFound();
  }

  const formattedExercises = plan.exercises.map((exercise) => ({
    id: exercise.id,
    exerciseId: exercise.exerciseId,
    name: exercise.exercise?.name ?? exercise.name,
    tracking: asTracking(exercise.exercise?.tracking),
    targetSets: exercise.setsOverride ?? exercise.exercise?.defaultSets ?? exercise.targetSets,
    restSeconds: exercise.restOverride ?? exercise.exercise?.restSeconds ?? exercise.restSeconds,
    repGoal: exercise.repGoalOverride ?? exercise.exercise?.repGoal ?? null,
    setsOverride: exercise.setsOverride,
    restOverride: exercise.restOverride,
    repGoalOverride: exercise.repGoalOverride,
    defaultSets: exercise.exercise?.defaultSets ?? null,
    defaultRepGoal: exercise.exercise?.repGoal ?? null,
    defaultRest: exercise.exercise?.restSeconds ?? null,
  }));

  return (
    <div className="min-h-screen bg-[#baa3d0] text-white pb-32 pt-4 px-4 select-none">
      <main className="max-w-sm mx-auto space-y-3.5">
        <SubpageHeader title="Edit plan" href="/schedule" />

        {/* Het interactieve bewerkingsscherm */}
        <PlanEditor
          planId={plan.id}
          initialName={plan.name}
          exercises={formattedExercises}
          library={library}
        />
      </main>
    </div>
  );
}