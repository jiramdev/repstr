import prisma from "@/lib/prisma";

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

const PUSH_HOST_ALLOWLIST: { exact?: string; suffix?: string }[] = [
  { exact: "fcm.googleapis.com" },
  { suffix: ".googleapis.com" },
  { suffix: ".push.apple.com" },
  { exact: "updates.push.services.mozilla.com" },
  { suffix: ".notify.windows.com" },
];

/**
 * Only known push service hosts may receive server-side requests.
 * Prevents using the subscription endpoint as an SSRF vector.
 */
export function isAllowedPushEndpoint(raw: string) {
  let host: string;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    host = url.hostname.toLowerCase();
  } catch {
    return false;
  }
  if (
    process.env.ALLOW_MEMORY_RATELIMIT === "1" &&
    (host === "localhost" || host === "127.0.0.1")
  ) {
    return true;
  }
  return PUSH_HOST_ALLOWLIST.some((rule) => {
    if (rule.exact) return host === rule.exact;
    if (rule.suffix) return host.endsWith(rule.suffix);
    return false;
  });
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
