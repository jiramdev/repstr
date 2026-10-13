// app/api/rest-timer/send/route.ts
import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import webpush from "web-push";
import prisma from "@/lib/prisma";
import { REST_STATUS, resolveRestStatus } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function statusCode(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return undefined;
  const code = error.statusCode;
  return typeof code === "number" ? code : undefined;
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
    const receiver = new Receiver({
      currentSigningKey,
      nextSigningKey,
      devMode: false,
    });
    const valid = await receiver.verify({ signature, body: bodyText });
    if (!valid) {
      return NextResponse.json({ error: "Not allowed" }, { status: 401 });
    }
  } catch (error) {
    console.error("Invalid QStash signature:", error);
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { exerciseName, planId, userId, token, workoutLogId } = payload as {
    exerciseName?: unknown;
    planId?: unknown;
    userId?: unknown;
    token?: unknown;
    workoutLogId?: unknown;
  };

  if (typeof userId !== "string" || !userId || typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Invalid timer" }, { status: 400 });
  }

  try {
    const timer = await prisma.restTimer.findUnique({
      where: { userId_token: { userId, token } },
    });
    const fireDelaySec =
      timer?.fireAt != null ? Math.round((Date.now() - timer.fireAt.getTime()) / 1000) : null;
    if (!timer || timer.status !== REST_STATUS.PENDING) {
      console.error("Rest timer skipped", {
        userId,
        token,
        status: timer?.status ?? "missing",
        fireDelaySec,
      });
      return NextResponse.json({ skipped: true });
    }

    const sessionId =
      typeof workoutLogId === "string" && workoutLogId
        ? workoutLogId
        : timer.workoutLogId;
    const tag = `rest-${token}`;
    const topic = `rest-${sessionId ?? token}`;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) {
      console.error("No push subscriptions for rest timer", { userId, token, fireDelaySec });
      await prisma.restTimer.update({
        where: { id: timer.id },
        data: { status: REST_STATUS.CANCELLED },
      });
      return NextResponse.json({ sent: 0 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    if (!publicKey || !privateKey || !subject) {
      return NextResponse.json({ error: "VAPID not configured" }, { status: 500 });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    const name =
      typeof exerciseName === "string" && exerciseName.trim()
        ? exerciseName.trim().slice(0, 80)
        : "your exercise";
    const redirectPath =
      typeof planId === "string" && planId
        ? `/workout/active?planId=${encodeURIComponent(planId)}`
        : "/workout/active";
    const pushBody = JSON.stringify({
      title: "Rest over ⚡️",
      body: `Time for your next set of ${name}!`,
      url: redirectPath,
      tag,
      renotify: true,
    });

    let sent = 0;
    const failedStatuses: (number | null)[] = [];
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          pushBody,
          { urgency: "high", TTL: 300, topic }
        );
        sent += 1;
      } catch (error) {
        const status = statusCode(error);
        if (status === 404 || status === 410) {
          console.error("Removing dead push subscription", {
            userId,
            token,
            subscriptionId: subscription.id,
            status,
          });
          await prisma.pushSubscription.delete({ where: { endpoint: subscription.endpoint } }).catch(() => {});
        } else {
          failedStatuses.push(status ?? null);
          console.error("Failed to send push", {
            userId,
            token,
            subscriptionId: subscription.id,
            status,
          });
        }
      }
    }

    // Mark sent only if at least one push succeeded, otherwise failed.
    const status = resolveRestStatus(sent);
    await prisma.restTimer.update({ where: { id: timer.id }, data: { status } }).catch((error) => {
      console.error("Failed to save rest timer status", { userId, token, status, error });
    });

    if (status === REST_STATUS.SENT) {
      console.error("Rest timer sent", { userId, token, sent, fireDelaySec });
    } else {
      console.error("Rest timer failed", {
        userId,
        token,
        sent,
        failedStatuses,
        fireDelaySec,
      });
    }

    if (sent === 0 && failedStatuses.length > 0) {
      return NextResponse.json({ error: "Push failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error("Failed to send push:", error);
    return NextResponse.json({ error: "Push failed" }, { status: 500 });
  }
}
