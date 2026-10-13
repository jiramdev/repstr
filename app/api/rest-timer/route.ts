// app/api/rest-timer/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Client } from "@upstash/qstash";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { REST_STATUS } from "@/lib/notifications";
import { upsertPushSubscription, isAllowedPushEndpoint } from "@/lib/push";
import { delaySecondsSchema, planIdSchema, tokenSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000).refine(isAllowedPushEndpoint, "Push service not allowed"),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

const postSchema = z.object({
  subscription: subscriptionSchema,
  delaySeconds: delaySecondsSchema.default(90),
  exerciseName: z.string().trim().max(80).optional().default(""),
  planId: planIdSchema,
  token: tokenSchema,
  workoutLogId: z.string().min(1).max(64).nullish(),
});

function appOrigin() {
  const raw = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  return raw;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const userId = session.user.id;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { subscription, delaySeconds, exerciseName, planId, token, workoutLogId } = parsed.data;

    const qstashToken = process.env.QSTASH_TOKEN;
    const origin = appOrigin();
    if (!qstashToken) {
      console.error("QSTASH_TOKEN missing");
      return NextResponse.json({ error: "QStash token missing" }, { status: 500 });
    }
    if (!origin) {
      console.error("APP_URL missing");
      return NextResponse.json({ error: "APP_URL missing" }, { status: 500 });
    }

    await upsertPushSubscription(userId, {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });

    // Link the timer to the user's own in-progress session when provided.
    let sessionId: string | null = null;
    if (workoutLogId) {
      const owned = await prisma.workoutLog.findFirst({
        where: { id: workoutLogId, userId, status: "in_progress" },
        select: { id: true },
      });
      sessionId = owned?.id ?? null;
    }

    const fireAt = new Date(Date.now() + delaySeconds * 1000);

    // Replace the session's other pending timers atomically with the new one,
    // in the same transaction. Stale QStash callbacks find a non-pending row
    // and skip. (logSet never cancels timers; the race is gone.)
    await prisma.$transaction([
      ...(sessionId
        ? [
            prisma.restTimer.updateMany({
              where: {
                userId,
                workoutLogId: sessionId,
                status: REST_STATUS.PENDING,
                NOT: { token },
              },
              data: { status: REST_STATUS.CANCELLED },
            }),
          ]
        : []),
      prisma.restTimer.upsert({
        where: { userId_token: { userId, token } },
        create: { userId, token, status: REST_STATUS.PENDING, workoutLogId: sessionId, fireAt },
        update: { status: REST_STATUS.PENDING, workoutLogId: sessionId, qstashMessageId: null, fireAt },
      }),
    ]);

    const name = exerciseName.trim() ? exerciseName.trim() : "your exercise";

    let messageId: string | null = null;
    try {
      const client = new Client({ token: qstashToken });
      const headers: Record<string, string> = {};
      const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
      if (bypass) headers["x-vercel-protection-bypass"] = bypass;

      const published = await client.publishJSON({
        url: `${origin}/api/rest-timer/send`,
        body: {
          exerciseName: name,
          planId: planId ?? null,
          userId,
          token,
          workoutLogId: sessionId,
        },
        delay: delaySeconds,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });
      messageId = typeof published.messageId === "string" ? published.messageId : null;
    } catch (error) {
      // A scheduling failure must never break logging a set: the set is already
      // stored via the workout server action; only this timer row fails.
      console.error("Failed to schedule QStash", { userId, token, delaySeconds, error });
      await prisma.restTimer.updateMany({
        where: { userId, token, status: REST_STATUS.PENDING },
        data: { status: REST_STATUS.FAILED },
      });
      return NextResponse.json({ error: "Couldn't schedule timer" }, { status: 500 });
    }

    await prisma.restTimer.updateMany({
      where: { userId, token },
      data: { qstashMessageId: messageId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("QStash delay request failed:", error);
    return NextResponse.json({ error: "Couldn't schedule timer" }, { status: 500 });
  }
}

const deleteSchema = z.object({ token: tokenSchema });

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "No timer" }, { status: 400 });
    }
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "No timer" }, { status: 400 });
    }

    // Cancel only pending rows of the user's own session.
    await prisma.restTimer.updateMany({
      where: { userId: session.user.id, token: parsed.data.token, status: REST_STATUS.PENDING },
      data: { status: REST_STATUS.CANCELLED },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel rest notification:", error);
    return NextResponse.json({ error: "Couldn't cancel notification" }, { status: 500 });
  }
}
