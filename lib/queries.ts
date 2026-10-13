import { Prisma } from "@prisma/client";
import { unstable_cache, updateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { amsterdamParts, amsterdamStartOfMonth } from "@/lib/amsterdam";
import { asTracking } from "@/lib/exercise-library";

export function userCacheTag(userId: string) {
  return `user:${userId}`;
}

export function refreshUserCache(userId: string) {
  updateTag(userCacheTag(userId));
}

function cached<T>(userId: string, key: string, load: () => Promise<T>) {
  return unstable_cache(load, [key, userId], {
    revalidate: 30,
    tags: [userCacheTag(userId)],
  })();
}

export function getDashboard(userId: string) {
  return cached(userId, "dashboard", async () => {
    const now = new Date();
    const { dayOfWeek } = amsterdamParts(now);
    const startOfMonth = amsterdamStartOfMonth(now);

    const [scheduleDay, latestWeight, sessionCount, user] = await Promise.all([
      prisma.scheduleDay.findFirst({
        where: {
          schedule: { userId },
          dayOfWeek,
        },
        select: {
          plan: {
            select: {
              id: true,
              name: true,
              _count: { select: { exercises: true } },
            },
          },
        },
      }),
      prisma.bodyWeightLog.findFirst({
        where: { userId },
        orderBy: { loggedAt: "desc" },
        select: { weight: true },
      }),
      prisma.workoutLog.count({
        where: { userId, completedAt: { gte: startOfMonth } },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
    ]);

    return {
      todayPlan: scheduleDay?.plan
        ? {
            id: scheduleDay.plan.id,
            name: scheduleDay.plan.name,
            exerciseCount: scheduleDay.plan._count.exercises,
          }
        : null,
      latestWeight: latestWeight?.weight ?? null,
      profileName: user?.name ?? null,
      profileEmail: user?.email ?? null,
      sessionCount,
      dayOfWeek,
    };
  });
}

export function getSchedule(userId: string) {
  return cached(userId, "schedule", async () => {
    const [rawPlans, weeklySchedule] = await Promise.all([
      prisma.workoutPlan.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          _count: { select: { exercises: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.weeklySchedule.findUnique({
        where: { userId },
        select: {
          days: { select: { dayOfWeek: true, planId: true } },
        },
      }),
    ]);

    const initialDays: Record<number, string> = {};
    for (const day of weeklySchedule?.days ?? []) {
      if (day.planId) initialDays[day.dayOfWeek] = day.planId;
    }

    return {
      plans: rawPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        exercisesCount: plan._count.exercises,
      })),
      initialDays,
    };
  });
}

export function getActiveWorkout(userId: string, planId?: string) {
  return cached(userId, `active-sets:${planId ?? "none"}`, async () => {
    const plan = planId
      ? await prisma.workoutPlan.findFirst({
          where: { id: planId, userId },
          select: {
            exercises: {
              select: {
                id: true,
                name: true,
                exerciseId: true,
                targetSets: true,
                restSeconds: true,
                exercise: { select: { name: true, tracking: true } },
              },
              orderBy: { order: "asc" },
            },
          },
        })
      : null;

    const exercises = (plan?.exercises ?? []).map((exercise) => ({
      id: exercise.id,
      exerciseId: exercise.exerciseId,
      name: exercise.exercise?.name ?? exercise.name,
      tracking: asTracking(exercise.exercise?.tracking),
      targetSets: exercise.targetSets,
      restSeconds: exercise.restSeconds,
    }));

    const exerciseIds = exercises
      .map((exercise) => exercise.exerciseId)
      .filter((id): id is string => Boolean(id));

    const latest =
      exerciseIds.length === 0
        ? []
        : await prisma.$queryRaw<Array<{ exerciseId: string; workoutLogId: string }>>(
            Prisma.sql`
              SELECT DISTINCT ON (le."exerciseId")
                le."exerciseId" AS "exerciseId",
                le."workoutLogId" AS "workoutLogId"
              FROM "LogEntry" le
              INNER JOIN "WorkoutLog" wl ON wl."id" = le."workoutLogId"
              WHERE le."exerciseId" IN (${Prisma.join(exerciseIds)})
                AND wl."userId" = ${userId}
                AND wl."completedAt" IS NOT NULL
              ORDER BY le."exerciseId", wl."completedAt" DESC
            `
          );

    const history =
      latest.length === 0
        ? []
        : await prisma.logEntry.findMany({
            where: {
              OR: latest.map((row) => ({
                exerciseId: row.exerciseId,
                workoutLogId: row.workoutLogId,
              })),
            },
            orderBy: { setNumber: "asc" },
            select: {
              exerciseId: true,
              setNumber: true,
              weight: true,
              reps: true,
              durationSeconds: true,
              workoutLogId: true,
            },
          });

    const setsByExercise = new Map<string, { weight: number | null; reps: number; durationSeconds: number | null }[]>();
    for (const entry of history) {
      if (!entry.exerciseId) continue;
      const sets = setsByExercise.get(entry.exerciseId) ?? [];
      sets[entry.setNumber - 1] = {
        weight: entry.weight,
        reps: entry.reps,
        durationSeconds: entry.durationSeconds,
      };
      setsByExercise.set(entry.exerciseId, sets);
    }

    const previousSets: Record<string, { weight: number | null; reps: number; durationSeconds: number | null }[]> = {};
    for (const exercise of exercises) {
      const sets = exercise.exerciseId ? setsByExercise.get(exercise.exerciseId) : undefined;
      if (sets?.length) previousSets[exercise.name] = sets;
    }

    return { exercises, previousSets };
  });
}

export function getAnalytics(userId: string) {
  return cached(userId, "analytics", async () => {
    const [workouts, weightLogs] = await Promise.all([
      prisma.workoutLog.findMany({
        where: { userId, completedAt: { not: null } },
        select: {
          completedAt: true,
          entries: {
            select: {
              exerciseName: true,
              weight: true,
              reps: true,
              durationSeconds: true,
              exercise: { select: { name: true, tracking: true } },
            },
          },
        },
        orderBy: { completedAt: "asc" },
      }),
      prisma.bodyWeightLog.findMany({
        where: { userId },
        orderBy: { loggedAt: "asc" },
        select: { weight: true, loggedAt: true },
      }),
    ]);

    return {
      workouts: workouts.map((workout) => ({
        completedAt: workout.completedAt!.toISOString(),
        entries: workout.entries.map((entry) => ({
          exerciseName: entry.exercise?.name || entry.exerciseName,
          weight: entry.weight,
          reps: entry.reps,
          durationSeconds: entry.durationSeconds,
          tracking: asTracking(entry.exercise?.tracking),
        })),
      })),
      weightLogs: weightLogs.map((log) => ({
        weight: log.weight,
        loggedAt: log.loggedAt.toISOString(),
      })),
    };
  });
}
