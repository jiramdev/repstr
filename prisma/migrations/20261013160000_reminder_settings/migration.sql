-- Daily reminder preferences and QStash scheduling state. All additive,
-- nullable or defaulted. Existing users keep working: reminders on by default.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reminderTime" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reminderTimezone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reminderEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "restTimerEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reminderQstashId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reminderNextRunAt" TIMESTAMP(3);
