// app/workout/active/session-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { refreshUserCache } from "@/lib/queries";
import { revalidateTabs } from "@/lib/revalidate-tabs";
import { exerciseKey } from "@/lib/exercises";
import { REST_STATUS } from "@/lib/notifications";
import {
  completedSetSchema,
  idSchema,
  planIdSchema,
} from "@/lib/validation";

async function requireUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");
  return session.user.id;
}

async function ownedSession(userId: string, sessionId: string) {
  const parsed = idSchema.safeParse(sessionId);
  if (!parsed.success) return null;
  return prisma.workoutLog.findFirst({
    where: { id: parsed.data, userId, status: "in_progress" },
    select: { id: true, planId: true },
  });
}

async function cancelSessionTimers(userId: string, sessionId: string) {
  await prisma.restTimer.updateMany({
    where: { userId, workoutLogId: sessionId, status: REST_STATUS.PENDING },
    data: { status: REST_STATUS.CANCELLED },
  });
}

/** Start a workout session, or resume the user's in-progress session (any device). */
export async function startWorkoutSession(planId?: string | null) {
  const userId = await requireUserId();

  const existing = await prisma.workoutLog.findFirst({
    where: { userId, status: "in_progress" },
    orderBy: { startedAt: "desc" },
    select: { id: true, planId: true, startedAt: true },
  });
  if (existing) return { success: true as const, sessionId: existing.id, resumed: true as const };

  const parsedPlan = planIdSchema.safeParse(planId ?? null);
  const requestedPlanId = parsedPlan.success ? parsedPlan.data : null;
  const ownedPlan = requestedPlanId
    ? await prisma.workoutPlan.findFirst({
        where: { id: requestedPlanId, userId },
        select: { id: true },
      })
    : null;

  const created = await prisma.workoutLog.create({
    data: {
      userId,
      planId: ownedPlan?.id ?? null,
      status: "in_progress",
      startedAt: new Date(),
    },
    select: { id: true },
  });
  return { success: true as const, sessionId: created.id, resumed: false as const };
}

const logSetSchema = completedSetSchema.omit({ setNumber: true }).extend({
  setNumber: completedSetSchema.shape.setNumber,
});

/** Save one set to the server as soon as it is logged. */
export async function logSet(sessionId: string, set: unknown) {
  const userId = await requireUserId();
  const session = await ownedSession(userId, sessionId);
  if (!session) return { error: "Session not found." };

  const parsed = logSetSchema.safeParse(set);
  if (!parsed.success) return { error: "Invalid set." };

  const match = await prisma.exercise.findFirst({
    where: { userId, nameKey: exerciseKey(parsed.data.exerciseName) },
    select: { id: true, name: true },
  });

  const entry = await prisma.logEntry.create({
    data: {
      workoutLogId: session.id,
      exerciseId: match?.id ?? null,
      exerciseName: match?.name || parsed.data.exerciseName.trim().slice(0, 80),
      setNumber: parsed.data.setNumber,
      weight: parsed.data.weight ?? null,
      reps: parsed.data.reps,
      durationSeconds: parsed.data.durationSeconds ?? null,
    },
    select: { id: true },
  });

  await cancelSessionTimers(userId, session.id);
  refreshUserCache(userId);
  return { success: true as const, entryId: entry.id };
}

const updateSetSchema = completedSetSchema.omit({ exerciseId: true, exerciseName: true, setNumber: true });

export async function updateLoggedSet(sessionId: string, entryId: string, set: unknown) {
  const userId = await requireUserId();
  const session = await ownedSession(userId, sessionId);
  if (!session) return { error: "Session not found." };
  if (!idSchema.safeParse(entryId).success) return { error: "Invalid set." };

  const parsed = updateSetSchema.safeParse(set);
  if (!parsed.success) return { error: "Invalid set." };

  const updated = await prisma.logEntry.updateMany({
    where: { id: entryId, workoutLogId: session.id, workoutLog: { userId } },
    data: {
      weight: parsed.data.weight ?? null,
      reps: parsed.data.reps,
      durationSeconds: parsed.data.durationSeconds ?? null,
    },
  });
  if (updated.count === 0) return { error: "Set not found." };
  refreshUserCache(userId);
  return { success: true as const };
}

export async function deleteLoggedSet(sessionId: string, entryId: string) {
  const userId = await requireUserId();
  const session = await ownedSession(userId, sessionId);
  if (!session) return { error: "Session not found." };
  if (!idSchema.safeParse(entryId).success) return { error: "Invalid set." };

  const deleted = await prisma.logEntry.deleteMany({
    where: { id: entryId, workoutLogId: session.id, workoutLog: { userId } },
  });
  if (deleted.count === 0) return { error: "Set not found." };
  refreshUserCache(userId);
  return { success: true as const };
}

/** Skip/next cancels only pending rows of the user's own session. */
export async function skipSessionRest(sessionId: string) {
  const userId = await requireUserId();
  const session = await ownedSession(userId, sessionId);
  if (!session) return { error: "Session not found." };
  await cancelSessionTimers(userId, session.id);
  return { success: true as const };
}

export async function finishWorkoutSession(sessionId: string) {
  const userId = await requireUserId();
  const session = await ownedSession(userId, sessionId);
  if (!session) return { error: "Session not found." };

  await prisma.$transaction([
    prisma.restTimer.updateMany({
      where: { userId, workoutLogId: session.id, status: REST_STATUS.PENDING },
      data: { status: REST_STATUS.CANCELLED },
    }),
    prisma.workoutLog.update({
      where: { id: session.id },
      data: { status: "finished", completedAt: new Date() },
    }),
  ]);

  refreshUserCache(userId);
  revalidateTabs();
  return { success: true as const, sessionId: session.id };
}

export async function abandonWorkoutSession(sessionId: string) {
  const userId = await requireUserId();
  const session = await ownedSession(userId, sessionId);
  if (!session) return { error: "Session not found." };

  await prisma.$transaction([
    prisma.restTimer.updateMany({
      where: { userId, workoutLogId: session.id, status: REST_STATUS.PENDING },
      data: { status: REST_STATUS.CANCELLED },
    }),
    prisma.workoutLog.update({
      where: { id: session.id },
      data: { status: "abandoned", completedAt: new Date() },
    }),
  ]);

  refreshUserCache(userId);
  revalidateTabs();
  return { success: true as const };
}
