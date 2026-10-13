import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { isTracking, libraryMatch, type ExerciseTracking } from "@/lib/exercise-library";

export type { ExerciseTracking };

export function exerciseKey(name: string) {
  return name.trim().toLocaleLowerCase("nl");
}

export async function findOrCreateExercise(
  userId: string,
  rawName: string,
  tracking?: string | null,
  defaults?: { defaultSets?: number; repGoal?: number | null; restSeconds?: number } | null
) {
  const name = rawName.trim();
  const nameKey = exerciseKey(name);
  if (!nameKey) return null;

  const existing = await prisma.exercise.findUnique({
    where: { userId_nameKey: { userId, nameKey } },
  });
  if (existing) return existing;

  const resolved: ExerciseTracking = isTracking(tracking)
    ? tracking
    : (libraryMatch(name)?.tracking ?? "weight");

  try {
    return await prisma.exercise.create({
      data: {
        userId,
        name,
        nameKey,
        tracking: resolved,
        defaultSets: defaults?.defaultSets ?? 3,
        repGoal: defaults?.repGoal ?? null,
        restSeconds: defaults?.restSeconds ?? 90,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.exercise.findUnique({
        where: { userId_nameKey: { userId, nameKey } },
      });
    }
    throw error;
  }
}
