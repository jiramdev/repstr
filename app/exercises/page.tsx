// app/exercises/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import SubpageHeader from "@/components/SubpageHeader";
import { asTracking } from "@/lib/exercise-library";
import ExerciseLibrary from "./ExerciseLibrary";

export default async function ExercisesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const exercises = await prisma.exercise.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      tracking: true,
      defaultSets: true,
      repGoal: true,
      restSeconds: true,
      archived: true,
    },
  });

  return (
    <div className="min-h-screen bg-[#baa3d0] text-white pb-32 pt-4 px-4 select-none">
      <main className="max-w-sm mx-auto space-y-3.5">
        <SubpageHeader title="Oefeningen" href="/schedule" />
        <ExerciseLibrary
          initial={exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            tracking: asTracking(exercise.tracking),
            defaultSets: exercise.defaultSets,
            repGoal: exercise.repGoal,
            restSeconds: exercise.restSeconds,
            archived: exercise.archived,
          }))}
        />
      </main>
    </div>
  );
}
