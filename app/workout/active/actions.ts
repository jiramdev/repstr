// app/workout/active/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { refreshUserCache } from "@/lib/queries";
import { revalidateTabs } from "@/lib/revalidate-tabs";
import { exerciseKey } from "@/lib/exercises";

const MAX_SETS = 200;

interface CompletedSet {
  exerciseId?: string | null;
  exerciseName: string;
  setNumber: number;
  weight: number | null;
  reps: number;
  durationSeconds?: number | null;
}

function isCompletedSet(value: CompletedSet) {
  return Boolean(value) && typeof value.exerciseName === "string";
}

export async function finishWorkout({
  planId,
  startedAt,
  sets,
}: {
  planId?: string | null;
  startedAt: string;
  sets: CompletedSet[];
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Niet ingelogd");

  const started = new Date(startedAt);
  if (typeof startedAt !== "string" || Number.isNaN(started.getTime())) {
    return { error: "Ongeldige starttijd." };
  }
  if (!Array.isArray(sets) || sets.length > MAX_SETS || sets.some((set) => !isCompletedSet(set))) {
    return { error: "De sessie kon niet worden opgeslagen." };
  }

  const completedAt = new Date();
  const userId = session.user.id;
  const requestedPlanId = typeof planId === "string" && planId ? planId : null;
  const ownedPlan = requestedPlanId
    ? await prisma.workoutPlan.findFirst({
        where: { id: requestedPlanId, userId },
        select: { id: true },
      })
    : null;
  const keys = [...new Set(sets.map((set) => exerciseKey(set.exerciseName)).filter(Boolean))];
  const known = keys.length
    ? await prisma.exercise.findMany({
        where: { userId, nameKey: { in: keys } },
        select: { id: true, nameKey: true, name: true },
      })
    : [];
  const byKey = new Map(known.map((exercise) => [exercise.nameKey, exercise]));

  const workoutLog = await prisma.workoutLog.create({
    data: {
      userId,
      planId: ownedPlan?.id ?? null,
      startedAt: started,
      completedAt,
      entries: {
        create: sets.map((set) => {
          const match = byKey.get(exerciseKey(set.exerciseName));
          return {
            exerciseId: match?.id ?? null,
            exerciseName: match?.name || set.exerciseName,
            setNumber: set.setNumber,
            weight: set.weight == null ? null : Number(set.weight) || 0,
            reps: Number(set.reps) || 0,
            durationSeconds:
              set.durationSeconds == null ? null : Number(set.durationSeconds) || 0,
          };
        }),
      },
    },
  });

  refreshUserCache(userId);
  revalidateTabs();
  return { success: true, workoutLogId: workoutLog.id };
}