// app/schedule/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { refreshUserCache } from "@/lib/queries";
import { revalidateTabs } from "@/lib/revalidate-tabs";
import { z } from "zod";
import { dayOfWeekSchema, idSchema, nameSchema } from "@/lib/validation";

// 1. Koppel een plan aan een specifieke dag (0 = Zo, 1 = Ma ... 6 = Za)
export async function assignPlanToDay(dayOfWeek: number, planId: string | null) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");

  const parsed = z
    .object({ day: dayOfWeekSchema, planId: idSchema.nullable() })
    .safeParse({ day: dayOfWeek, planId });
  if (!parsed.success) {
    throw new Error("Ongeldige dag");
  }

  const userId = session.user.id;

  if (parsed.data.planId) {
    const plan = await prisma.workoutPlan.findFirst({
      where: { id: parsed.data.planId, userId },
      select: { id: true },
    });
    if (!plan) throw new Error("Plan niet gevonden");
  }

  // Zorg dat het WeeklySchedule record bestaat voor de gebruiker
  const weeklySchedule = await prisma.weeklySchedule.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  // Koppel plan of zet op rustdag (planId: null)
  await prisma.scheduleDay.upsert({
    where: {
      scheduleId_dayOfWeek: {
        scheduleId: weeklySchedule.id,
        dayOfWeek: parsed.data.day,
      },
    },
    update: {
      planId: parsed.data.planId || null,
    },
    create: {
      scheduleId: weeklySchedule.id,
      dayOfWeek: parsed.data.day,
      planId: parsed.data.planId || null,
    },
  });

  refreshUserCache(userId);
  revalidateTabs();
}

// 2. Nieuw trainingsplan aanmaken
export async function createWorkoutPlan(name: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");

  const parsed = nameSchema.safeParse(name?.trim());
  if (!parsed.success) return null;

  const plan = await prisma.workoutPlan.create({
    data: {
      userId: session.user.id,
      name: parsed.data,
    },
  });

  refreshUserCache(session.user.id);
  revalidateTabs();
  return plan;
}