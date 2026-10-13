import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache, updateTag } from "next/cache";
import prisma from "@/lib/prisma";
import { amsterdamParts, amsterdamStartOfMonth } from "@/lib/amsterdam";
import { asTracking } from "@/lib/exercise-library";

export function userCacheTag(userId: string) {
  return `user:${userId}`;
}

/** Only finished sessions ever count. Abandoned or cancelled workouts stay out. */
export function finishedSessionCountWhere(userId: string, startOfMonth: Date) {
  return { userId, status: "finished", completedAt: { gte: startOfMonth } };
}

export function refreshUserCache(userId: string) {
  const tag = userCacheTag(userId);
  // updateTag covers "use cache" entries; revalidateTag covers unstable_cache.
  // This codebase reads through unstable_cache, so revalidateTag does the work.
  updateTag(tag);
  revalidateTag(tag, "max");
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
        where: finishedSessionCountWhere(userId, startOfMonth),
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

export async function getActiveWorkout(userId: string, planId?: string) {
  // NOTE: intentionally uncached. This read must reflect sets logged seconds
  // ago; a stale entry here shows wrong placeholders mid-workout.
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
                setsOverride: true,
                repGoalOverride: true,
                restOverride: true,
                exercise: {
                  select: { name: true, tracking: true, defaultSets: true, repGoal: true, restSeconds: true },
                },
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
      targetSets: exercise.setsOverride ?? exercise.exercise?.defaultSets ?? exercise.targetSets,
      restSeconds: exercise.restOverride ?? exercise.exercise?.restSeconds ?? exercise.restSeconds,
      repGoal: exercise.repGoalOverride ?? exercise.exercise?.repGoal ?? null,
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
                AND wl."status" = 'finished'
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

    // Keyed by exerciseId so renaming an exercise keeps its history.
    const previousSets: Record<string, { weight: number | null; reps: number; durationSeconds: number | null }[]> = {};
    for (const exercise of exercises) {
      const sets = exercise.exerciseId ? setsByExercise.get(exercise.exerciseId) : undefined;
      if (sets?.length && exercise.exerciseId) previousSets[exercise.exerciseId] = sets;
    }

    return { exercises, previousSets };
}

export async function getActiveSession(userId: string) {
  return prisma.workoutLog.findFirst({
    where: { userId, status: "in_progress" },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      planId: true,
      startedAt: true,
      entries: {
        select: {
          id: true,
          exerciseId: true,
          exerciseName: true,
          setNumber: true,
          reps: true,
          weight: true,
          durationSeconds: true,
        },
        orderBy: [{ exerciseName: "asc" }, { setNumber: "asc" }],
      },
    },
  });
}

export function getAnalytics(userId: string) {
  return cached(userId, "analytics", async () => {
    // Sequential on purpose: serverless pools are tiny (connection_limit=1),
    // so parallel queries would each hold a connection and starve the pool.
    const workouts = await prisma.workoutLog.findMany({
      where: { userId, status: "finished", completedAt: { not: null } },
      select: {
        id: true,
        planId: true,
        plan: { select: { name: true } },
        completedAt: true,
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
      orderBy: { completedAt: "asc" },
    });
    const weightLogs = await prisma.bodyWeightLog.findMany({
      where: { userId },
      orderBy: { loggedAt: "asc" },
      select: { weight: true, loggedAt: true },
    });

    return {
      workouts: workouts.map((workout) => ({
        id: workout.id,
        planId: workout.planId,
        planName: workout.plan?.name ?? null,
        completedAt: workout.completedAt!.toISOString(),
        entries: workout.entries.map((entry) => ({
          exerciseName: entry.exercise?.name || entry.exerciseName,
          setNumber: entry.setNumber,
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
