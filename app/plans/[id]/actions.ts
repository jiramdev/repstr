// app/plans/[id]/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { refreshUserCache } from "@/lib/queries";
import { exerciseKey, findOrCreateExercise } from "@/lib/exercises";
import { isTracking } from "@/lib/exercise-library";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { idSchema, nameSchema, restSecondsSchema, setsSchema } from "@/lib/validation";
import { redirect } from "next/navigation";

// 1. Naam van het plan bijwerken
export async function updatePlanName(planId: string, name: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");

  const parsed = z.object({ planId: idSchema, name: nameSchema }).safeParse({ planId, name: name?.trim() });
  if (!parsed.success) return;

  await prisma.workoutPlan.update({
    where: { id: parsed.data.planId, userId: session.user.id },
    data: { name: parsed.data.name },
  });

  refreshUserCache(session.user.id);
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/schedule");
  revalidatePath("/");
}

// 2. Add an exercise to the plan. An exercise may appear twice per plan;
// the order per plan stays unique. Empty values fall back to the defaults.
export async function addExerciseToPlan(
  planId: string,
  exerciseName: string,
  targetSets?: number | null,
  restSeconds?: number | null,
  exerciseId?: string | null,
  tracking?: string | null,
  repGoal?: number | null
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");

  const userId = session.user.id;
  if (!idSchema.safeParse(planId).success) return { error: "Plan not found." };
  const plan = await prisma.workoutPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!plan) return { error: "Plan not found." };

  const parsed = z
    .object({
      sets: setsSchema.nullish(),
      rest: restSecondsSchema.nullish(),
      goal: z.number().int().min(1).max(10000).nullish(),
    })
    .safeParse({
      sets: targetSets ?? null,
      rest: restSeconds ?? null,
      goal: repGoal ?? null,
    });
  if (!parsed.success) {
    return { error: "Check sets, target and rest." };
  }
  const { sets, rest, goal } = parsed.data;

  const fallbackSets = sets ?? 3;
  const fallbackRest = rest ?? 90;
  const exercise = exerciseId
    ? await prisma.exercise.findFirst({ where: { id: exerciseId, userId } })
    : await findOrCreateExercise(userId, exerciseName, tracking, {
        defaultSets: fallbackSets,
        repGoal: goal,
        restSeconds: fallbackRest,
      });
  if (!exercise) return { error: "Enter a name." };

  const resolvedSets = sets ?? exercise.defaultSets;
  const resolvedRest = rest ?? exercise.restSeconds;
  const resolvedGoal = goal ?? exercise.repGoal;

  const createWithOrder = async (order: number) =>
    prisma.planExercise.create({
      data: {
        planId,
        exerciseId: exercise.id,
        name: exercise.name,
        targetSets: resolvedSets,
        restSeconds: resolvedRest,
        setsOverride: sets,
        repGoalOverride: goal,
        restOverride: rest,
        order,
      },
    });

  const last = await prisma.planExercise.findFirst({
    where: { planId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  try {
    await createWithOrder((last?.order ?? -1) + 1);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const max = await prisma.planExercise.findFirst({
        where: { planId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      await createWithOrder((max?.order ?? -1) + 1);
    } else {
      throw error;
    }
  }

  refreshUserCache(userId);
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/schedule");
  revalidatePath("/");
  return { success: true };
}

export async function updateExercise(
  planId: string,
  exerciseId: string,
  exerciseName: string,
  targetSets?: number | null,
  restSeconds?: number | null,
  tracking?: string | null,
  repGoal?: number | null
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");

  const parsed = z
    .object({
      planId: idSchema,
      placementId: idSchema,
      name: nameSchema,
      sets: setsSchema.nullish(),
      rest: restSecondsSchema.nullish(),
      goal: z.number().int().min(1).max(10000).nullish(),
    })
    .safeParse({
      planId,
      placementId: exerciseId,
      name: exerciseName?.trim(),
      sets: targetSets ?? null,
      rest: restSeconds ?? null,
      goal: repGoal ?? null,
    });
  if (!parsed.success) return { error: "Check the fields." };
  const { name, sets, rest, goal } = parsed.data;

  const placement = await prisma.planExercise.findFirst({
    where: { id: exerciseId, planId, plan: { userId: session.user.id } },
    select: { id: true, exerciseId: true, name: true },
  });
  if (!placement) return { error: "Exercise not found." };

  const shared =
    (placement.exerciseId
      ? await prisma.exercise.findFirst({
          where: { id: placement.exerciseId, userId: session.user.id },
        })
      : null) ?? (await findOrCreateExercise(session.user.id, placement.name));
  if (!shared) return { error: "Enter a name." };

  const key = exerciseKey(name);
  const clash = await prisma.exercise.findFirst({
    where: { userId: session.user.id, nameKey: key, NOT: { id: shared.id } },
    select: { id: true },
  });
  if (clash) return { error: "That exercise already exists." };

  await prisma.$transaction([
    prisma.exercise.update({
      where: { id: shared.id },
      data: {
        name,
        nameKey: key,
        ...(isTracking(tracking) ? { tracking } : {}),
      },
    }),
    prisma.planExercise.updateMany({
      where: { exerciseId: shared.id },
      data: { name },
    }),
    prisma.logEntry.updateMany({
      where: { exerciseId: shared.id },
      data: { exerciseName: name },
    }),
    prisma.planExercise.update({
      where: { id: placement.id },
      data: {
        exerciseId: shared.id,
        name,
        targetSets: sets ?? shared.defaultSets,
        restSeconds: rest ?? shared.restSeconds,
        setsOverride: sets,
        repGoalOverride: goal,
        restOverride: rest,
      },
    }),
  ]);

  refreshUserCache(session.user.id);
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/schedule");
  revalidatePath("/");
  return { success: true };
}

export async function reorderExercises(planId: string, orderedIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");

  const parsed = z.object({ planId: idSchema, orderedIds: z.array(idSchema).min(1).max(200) }).safeParse({ planId, orderedIds });
  if (!parsed.success) {
    return { error: "Couldn't save the order." };
  }
  const { planId: validPlanId, orderedIds: validIds } = parsed.data;

  const existing = await prisma.planExercise.findMany({
    where: { planId: validPlanId, plan: { userId: session.user.id } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((exercise) => exercise.id));
  if (
    validIds.length !== existing.length ||
    validIds.some((id) => !existingIds.has(id))
  ) {
    return { error: "Couldn't save the order." };
  }

  await prisma.$transaction(
    validIds.map((id, order) =>
      prisma.planExercise.update({
        where: { id },
        data: { order },
      })
    )
  );

  refreshUserCache(session.user.id);
  revalidatePath(`/plans/${validPlanId}`);
  revalidatePath("/schedule");
  revalidatePath("/");
  return { success: true };
}

// 3. Oefening verwijderen uit het plan
export async function removeExerciseFromPlan(planId: string, exerciseId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");

  const placement = await prisma.planExercise.findFirst({
    where: { id: exerciseId, planId, plan: { userId: session.user.id } },
    select: { id: true },
  });
  if (!placement) return;

  await prisma.planExercise.delete({
    where: { id: placement.id },
  });

  refreshUserCache(session.user.id);
  revalidatePath(`/plans/${planId}`);
  revalidatePath("/schedule");
  revalidatePath("/");
}

// 4. Volledig trainingsplan verwijderen
export async function deletePlan(planId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");

  const plan = await prisma.workoutPlan.findFirst({
    where: { id: planId, userId: session.user.id },
    select: { id: true },
  });
  if (!plan) return;

  await prisma.$transaction([
    prisma.scheduleDay.deleteMany({ where: { planId: plan.id } }),
    prisma.planExercise.deleteMany({ where: { planId: plan.id } }),
    prisma.workoutPlan.delete({ where: { id: plan.id } }),
  ]);

  refreshUserCache(session.user.id);
  revalidatePath("/schedule");
  revalidatePath("/");
  redirect("/schedule");
}