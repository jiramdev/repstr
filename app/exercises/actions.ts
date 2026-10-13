// app/exercises/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { refreshUserCache } from "@/lib/queries";
import { exerciseKey } from "@/lib/exercises";
import { z } from "zod";
import { idSchema, nameSchema } from "@/lib/validation";

const detailsSchema = z.object({
  name: nameSchema,
  tracking: z.enum(["weight", "reps", "hold"]),
  defaultSets: z.number().int().min(1).max(20),
  repGoal: z.number().int().min(1).max(10000).nullish(),
  restSeconds: z.number().int().min(0).max(600),
});

async function requireUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Niet ingelogd");
  return session.user.id;
}

function refresh(userId: string) {
  refreshUserCache(userId);
  revalidatePath("/exercises");
  revalidatePath("/schedule");
}

export async function createExercise(input: unknown) {
  const userId = await requireUserId();
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { error: "Controleer de velden." };

  const key = exerciseKey(parsed.data.name);
  const clash = await prisma.exercise.findFirst({
    where: { userId, nameKey: key },
    select: { id: true },
  });
  if (clash) return { error: "Die oefening bestaat al." };

  const created = await prisma.exercise.create({
    data: {
      userId,
      name: parsed.data.name,
      nameKey: key,
      tracking: parsed.data.tracking,
      defaultSets: parsed.data.defaultSets,
      repGoal: parsed.data.repGoal ?? null,
      restSeconds: parsed.data.restSeconds,
    },
    select: { id: true },
  });

  refresh(userId);
  return { success: true as const, id: created.id };
}

export async function updateExerciseDetails(exerciseId: unknown, input: unknown) {
  const userId = await requireUserId();
  if (!idSchema.safeParse(exerciseId).success) return { error: "Oefening niet gevonden." };
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { error: "Controleer de velden." };

  const owned = await prisma.exercise.findFirst({
    where: { id: exerciseId as string, userId },
    select: { id: true },
  });
  if (!owned) return { error: "Oefening niet gevonden." };

  const key = exerciseKey(parsed.data.name);
  const clash = await prisma.exercise.findFirst({
    where: { userId, nameKey: key, NOT: { id: owned.id } },
    select: { id: true },
  });
  if (clash) return { error: "Die oefening bestaat al." };

  await prisma.$transaction([
    prisma.exercise.update({
      where: { id: owned.id },
      data: {
        name: parsed.data.name,
        nameKey: key,
        tracking: parsed.data.tracking,
        defaultSets: parsed.data.defaultSets,
        repGoal: parsed.data.repGoal ?? null,
        restSeconds: parsed.data.restSeconds,
      },
    }),
    // History stays linked by exerciseId; the snapshot follows the new name.
    prisma.planExercise.updateMany({
      where: { exerciseId: owned.id },
      data: { name: parsed.data.name },
    }),
    prisma.logEntry.updateMany({
      where: { exerciseId: owned.id },
      data: { exerciseName: parsed.data.name },
    }),
  ]);

  refresh(userId);
  return { success: true as const };
}

const archiveSchema = z.object({ exerciseId: idSchema, archived: z.boolean() });

export async function setExerciseArchived(input: unknown) {
  const userId = await requireUserId();
  const parsed = archiveSchema.safeParse(input);
  if (!parsed.success) return { error: "Oefening niet gevonden." };

  const updated = await prisma.exercise.updateMany({
    where: { id: parsed.data.exerciseId, userId },
    data: { archived: parsed.data.archived },
  });
  if (updated.count === 0) return { error: "Oefening niet gevonden." };

  refresh(userId);
  return { success: true as const };
}
