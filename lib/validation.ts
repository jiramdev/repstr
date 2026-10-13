import { z } from "zod";

export const idSchema = z.string().min(1).max(64);

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z.string().min(8).max(128);

export const nameSchema = z.string().trim().min(1).max(80);

export const setsSchema = z.number().int().min(1).max(20);

export const repsSchema = z.number().int().min(0).max(1000);

export const weightSchema = z.number().min(0).max(1000);

export const durationSchema = z.number().int().min(0).max(24 * 60 * 60);

export const restSecondsSchema = z.number().int().min(0).max(3600);

export const delaySecondsSchema = z.number().int().min(1).max(3600);

export const setNumberSchema = z.number().int().min(1).max(1000);

export const dayOfWeekSchema = z.number().int().min(0).max(6);

export const completedSetSchema = z.object({
  exerciseId: z.string().min(1).max(64).nullish(),
  exerciseName: z.string().trim().min(1).max(80),
  setNumber: setNumberSchema,
  weight: weightSchema.nullish(),
  reps: repsSchema,
  durationSeconds: durationSchema.nullish(),
});

export const completedSetsSchema = z.array(completedSetSchema).min(0).max(500);

export const planIdSchema = z.string().min(1).max(64).nullish();

export const tokenSchema = z.string().min(1).max(128);
