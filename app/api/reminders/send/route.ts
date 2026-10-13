// app/api/reminders/send/route.ts
import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { Prisma } from "@prisma/client";
import webpush from "web-push";
import prisma from "@/lib/prisma";
import { scheduleNextReminder } from "@/lib/reminders";
import {
  isAlreadySentToday,
  normalizeTimezone,
  zonedDateKey,
  zonedDayOfWeek,
} from "@/lib/reminder-time";
import { idSchema } from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ userId: idSchema });

function exerciseLine(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export async function POST(req: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) {
    return NextResponse.json({ error: "QStash signing keys missing" }, { status: 500 });
  }

  const signature = req.headers.get("upstash-signature");
  if (!signature) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  const bodyText = await req.text();
  try {
    const receiver = new Receiver({ currentSigningKey, nextSigningKey, devMode: false });
    const valid = await receiver.verify({ signature, body: bodyText });
    if (!valid) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  } catch (error) {
    console.error("Invalid QStash signature:", error);
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const { userId } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      reminderEnabled: true,
      reminderTime: true,
      reminderTimezone: true,
      lastMorningSentDate: true,
    },
  });
  if (!user) return NextResponse.json({ skipped: true });
  if (!user.reminderEnabled) return NextResponse.json({ skipped: true });

  // Always chain the next day first so the schedule survives this run.
  const chained = await scheduleNextReminder(userId);
  if (!("success" in chained)) {
    console.error("Reminder chain broken, safety net will recreate", { userId });
  }

  const now = new Date();
  const timezone = normalizeTimezone(user.reminderTimezone);
  const todayKey = zonedDateKey(now, timezone);
  if (isAlreadySentToday(user.lastMorningSentDate, todayKey)) {
    return NextResponse.json({ skipped: true });
  }

  const dayOfWeek = zonedDayOfWeek(now, timezone);
  if (dayOfWeek < 0 || dayOfWeek > 6) return NextResponse.json({ skipped: true });

  const scheduleDay = await prisma.scheduleDay.findFirst({
    where: { schedule: { userId }, dayOfWeek, planId: { not: null } },
    select: {
      plan: {
        select: {
          id: true,
          name: true,
          exercises: { orderBy: { order: "asc" }, select: { name: true } },
        },
      },
    },
  });
  // Only on days that have a plan scheduled.
  if (!scheduleDay?.plan) return NextResponse.json({ skipped: true });

  const plan = scheduleDay.plan;
  const names = exerciseLine(plan.exercises.map((exercise) => exercise.name));
  const title = "Today";
  const bodyText2 = names ? `${plan.name}: ${names}` : plan.name;
  const href = `/workout/active?planId=${plan.id}`;
  const dedupeKey = `morning:${todayKey}`;

  try {
    await prisma.appNotification.create({
      data: { userId, title, body: bodyText2, href, dedupeKey },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ skipped: true });
    }
    console.error("Failed to save morning notification:", error);
    return NextResponse.json({ skipped: true });
  }

  await prisma.user
    .update({ where: { id: userId }, data: { lastMorningSentDate: todayKey } })
    .catch((error) => {
      console.error("Failed to save morning notification date", { userId, dateKey: todayKey, error });
    });

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length > 0) {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (publicKey && privateKey && subject) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify({ title, body: bodyText2, url: href, tag: "morning" }),
            { urgency: "high", TTL: 60 * 60 * 12 }
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await prisma.pushSubscription.delete({ where: { endpoint: subscription.endpoint } }).catch(() => {});
          } else {
            console.error("Failed to send morning notification", { userId, status });
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
