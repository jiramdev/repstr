-- RestTimer.fireAt records when the delayed push should fire, for observability.
ALTER TABLE "RestTimer" ADD COLUMN IF NOT EXISTS "fireAt" TIMESTAMP(3);
