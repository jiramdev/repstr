"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
