import prisma from "@/lib/prisma";

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Store a push subscription without ever moving an endpoint to another user:
 * same user updates keys, a different user deletes the old row and creates
 * a new one.
 */
export async function upsertPushSubscription(userId: string, subscription: StoredSubscription) {
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint: subscription.endpoint },
    select: { id: true, userId: true },
  });
  if (!existing) {
    await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    });
  } else if (existing.userId === userId) {
    await prisma.pushSubscription.update({
      where: { id: existing.id },
      data: { p256dh: subscription.p256dh, auth: subscription.auth },
    });
  } else {
    await prisma.pushSubscription.delete({ where: { id: existing.id } });
    await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    });
  }
}
