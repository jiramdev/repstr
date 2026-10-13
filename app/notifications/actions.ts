"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { refreshUserCache } from "@/lib/queries";
import { z } from "zod";
import webpush from "web-push";
import { cancelReminderSchedule, scheduleNextReminder } from "@/lib/reminders";
import {
  normalizeReminderTime,
  normalizeTimezone,
} from "@/lib/reminder-time";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
});

export async function savePushSubscription(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return;
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return;
  const { endpoint, p256dh, auth } = parsed.data;

  // Never move an endpoint to another user.
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint },
    select: { id: true, userId: true },
  });
  if (!existing) {
    await prisma.pushSubscription.create({
      data: { userId: session.user.id, endpoint, p256dh, auth },
    });
  } else if (existing.userId === session.user.id) {
    await prisma.pushSubscription.update({
      where: { id: existing.id },
      data: { p256dh, auth },
    });
  } else {
    await prisma.pushSubscription.delete({ where: { id: existing.id } });
    await prisma.pushSubscription.create({
      data: { userId: session.user.id, endpoint, p256dh, auth },
    });
  }
}

export async function removePushSubscription(endpoint: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || typeof endpoint !== "string" || !endpoint) return;

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  });
}

export async function markNotificationsRead() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return;

  await prisma.appNotification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  revalidatePath("/");
}

export async function getReminderSettings() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      reminderEnabled: true,
      reminderTime: true,
      reminderTimezone: true,
      restTimerEnabled: true,
    },
  });
  return {
    reminderEnabled: user?.reminderEnabled ?? true,
    reminderTime: normalizeReminderTime(user?.reminderTime),
    reminderTimezone: normalizeTimezone(user?.reminderTimezone),
    restTimerEnabled: user?.restTimerEnabled ?? true,
  };
}

const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  time: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[05]\d$/, "Use HH:MM")
    .max(5),
  timezone: z.string().min(1).max(100),
});

export async function saveReminderSettings(input: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");
  const parsed = reminderSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the reminder settings." };
  const userId = session.user.id;

  await cancelReminderSchedule(userId);
  await prisma.user.update({
    where: { id: userId },
    data: {
      reminderEnabled: parsed.data.enabled,
      reminderTime: normalizeReminderTime(parsed.data.time),
      reminderTimezone: normalizeTimezone(parsed.data.timezone),
    },
  });

  let scheduled = false;
  if (parsed.data.enabled) {
    const result = await scheduleNextReminder(userId);
    scheduled = "success" in result;
  }

  refreshUserCache(userId);
  revalidatePath("/notifications");
  return { success: true as const, scheduled };
}

export async function saveRestTimerEnabled(enabled: unknown) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");
  if (typeof enabled !== "boolean") return { error: "Invalid value." };
  await prisma.user.update({
    where: { id: session.user.id },
    data: { restTimerEnabled: enabled },
  });
  refreshUserCache(session.user.id);
  return { success: true as const };
}

export async function sendTestNotification() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Not signed in");
  const userId = session.user.id;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) {
    return { error: "No device subscribed on this account yet." };
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return { error: "Push is not configured." };
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  let sent = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          title: "Test notification",
          body: "Notifications are working on this device.",
          url: "/",
          tag: "test",
        }),
        { urgency: "high", TTL: 60 }
      );
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { endpoint: subscription.endpoint } }).catch(() => {});
      } else {
        console.error("Failed to send test notification", { userId, status });
      }
    }
  }
  if (sent === 0) return { error: "Test notification failed." };
  return { success: true as const, sent };
}
