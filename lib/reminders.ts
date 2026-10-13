import { Client } from "@upstash/qstash";
import prisma from "@/lib/prisma";
import {
  nextDailyOccurrence,
  normalizeReminderTime,
  normalizeTimezone,
} from "@/lib/reminder-time";

function appOrigin() {
  const raw = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  return raw;
}

function qstashClient() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  return new Client({ token });
}

export type ReminderPrefs = {
  enabled: boolean;
  time: string;
  timezone: string;
};

/** Schedule the next daily reminder as a delayed QStash message. Chainable. */
export async function scheduleNextReminder(
  userId: string,
  now = new Date()
): Promise<{ success: true } | { error: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      reminderEnabled: true,
      reminderTime: true,
      reminderTimezone: true,
      reminderQstashId: true,
    },
  });
  if (!user || !user.reminderEnabled) return { error: "Reminders off" };

  const time = normalizeReminderTime(user.reminderTime);
  const timezone = normalizeTimezone(user.reminderTimezone);
  const runAt = nextDailyOccurrence(now, time, timezone);

  const client = qstashClient();
  const origin = appOrigin();
  if (!client || !origin) {
    console.error("Cannot schedule reminder", { userId });
    return { error: "Scheduler not configured" };
  }

  try {
    if (user.reminderQstashId) {
      await client.messages.delete(user.reminderQstashId).catch((error) => {
        console.error("Old reminder message delete failed", { userId, error });
      });
    }
    const delaySeconds = Math.max(
      1,
      Math.round((runAt.getTime() - now.getTime()) / 1000)
    );
    const headers: Record<string, string> = {};
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (bypass) headers["x-vercel-protection-bypass"] = bypass;
    const published = await client.publishJSON({
      url: `${origin}/api/reminders/send`,
      body: { userId },
      delay: delaySeconds,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
    const messageId = typeof published.messageId === "string" ? published.messageId : null;
    await prisma.user.update({
      where: { id: userId },
      data: { reminderQstashId: messageId, reminderNextRunAt: runAt },
    });
    return { success: true as const };
  } catch (error) {
    // Prefs stay saved; the safety-net cron recreates the schedule later.
    console.error("Failed to schedule reminder", { userId, error });
    return { error: "Could not schedule reminder" };
  }
}

/** Cancel a pending reminder schedule (toggle off / reschedule). */
export async function cancelReminderSchedule(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reminderQstashId: true },
  });
  if (user?.reminderQstashId) {
    const client = qstashClient();
    if (client) {
      await client.messages.delete(user.reminderQstashId).catch((error) => {
        console.error("Reminder message delete failed", { userId, error });
      });
    }
  }
  await prisma.user.update({
    where: { id: userId },
    data: { reminderQstashId: null, reminderNextRunAt: null },
  });
}
