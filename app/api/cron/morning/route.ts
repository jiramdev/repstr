import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { scheduleNextReminder } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Safety net (daily Vercel Cron): reminders are scheduled per user via QStash
 * at their own local time. This route only re-creates schedules that are
 * missing or overdue — e.g. after a failed publish or a deleted message.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Fail closed: reject when CRON_SECRET is missing or does not match.
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  const now = new Date();
  const candidates = await prisma.user.findMany({
    where: {
      reminderEnabled: true,
      OR: [{ reminderNextRunAt: null }, { reminderNextRunAt: { lt: now } }],
      pushSubscriptions: { some: {} },
    },
    select: { id: true },
  });

  let ensured = 0;
  for (const candidate of candidates) {
    const result = await scheduleNextReminder(candidate.id, now);
    if ("success" in result) ensured += 1;
    else console.error("Safety net could not schedule reminder", { userId: candidate.id });
  }

  return NextResponse.json({ ensured, checked: candidates.length });
}
