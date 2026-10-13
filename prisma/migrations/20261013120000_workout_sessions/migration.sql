-- Additive, nullable or defaulted. Safe on the live database with real data.
-- Back up first: pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%Y%m%d-%H%M).dump
-- Never drops user data. Existing per-plan values are copied into the new override columns.

-- 1. Exercise library fields (defaults, archived flag).
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "defaultSets" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "repGoal" INTEGER;
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "restSeconds" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "Exercise" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;

-- 2. PlanExercise nullable overrides, backfilled from the existing per-plan values.
ALTER TABLE "PlanExercise" ADD COLUMN IF NOT EXISTS "setsOverride" INTEGER;
ALTER TABLE "PlanExercise" ADD COLUMN IF NOT EXISTS "repGoalOverride" INTEGER;
ALTER TABLE "PlanExercise" ADD COLUMN IF NOT EXISTS "restOverride" INTEGER;
UPDATE "PlanExercise" SET "setsOverride" = "targetSets" WHERE "setsOverride" IS NULL;
UPDATE "PlanExercise" SET "restOverride" = "restSeconds" WHERE "restOverride" IS NULL;

-- 3. Allow an exercise twice per plan. Renumber first so the per-plan order is unique.
UPDATE "PlanExercise" AS pe SET "order" = sub.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "planId" ORDER BY "order", "id") - 1 AS rn
  FROM "PlanExercise"
) AS sub
WHERE pe."id" = sub."id";
DROP INDEX IF EXISTS "PlanExercise_planId_exerciseId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PlanExercise_planId_order_key" ON "PlanExercise"("planId", "order");

-- 4. LogEntry.weight becomes nullable. Bodyweight and hold sets store NULL, not 0.
ALTER TABLE "LogEntry" ALTER COLUMN "weight" DROP NOT NULL;
UPDATE "LogEntry" AS le SET "weight" = NULL
FROM "Exercise" AS ex
WHERE le."exerciseId" = ex."id"
  AND le."weight" = 0
  AND ex."tracking" <> 'weight';

-- 5. Server-side workout sessions: status on WorkoutLog (in_progress / finished / abandoned).
-- Existing rows are completed workouts, so they default to finished.
ALTER TABLE "WorkoutLog" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'finished';
CREATE INDEX IF NOT EXISTS "WorkoutLog_userId_status_idx" ON "WorkoutLog"("userId", "status");

-- 6. Rest notification status tracking (pending / sent / cancelled / failed).
ALTER TABLE "RestTimer" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "RestTimer" ADD COLUMN IF NOT EXISTS "workoutLogId" TEXT;
ALTER TABLE "RestTimer" ADD COLUMN IF NOT EXISTS "qstashMessageId" TEXT;
DO $$ BEGIN
  ALTER TABLE "RestTimer" ADD CONSTRAINT "RestTimer_workoutLogId_fkey" FOREIGN KEY ("workoutLogId") REFERENCES "WorkoutLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "RestTimer_workoutLogId_idx" ON "RestTimer"("workoutLogId");

-- 7. Morning reminder once-per-day tracking (Amsterdam date key YYYY-MM-DD per user).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastMorningSentDate" TEXT;
