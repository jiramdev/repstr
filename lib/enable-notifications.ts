import { removePushSubscription, savePushSubscription } from "@/app/notifications/actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type NotificationChoice = "granted" | "denied" | "unsupported";

async function storeSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
  await savePushSubscription({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  });
}

export async function syncExistingPushSubscription() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await storeSubscription(subscription);
}

export async function enableNotifications(): Promise<NotificationChoice> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey || !("serviceWorker" in navigator)) return "granted";

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  await storeSubscription(subscription);
  return "granted";
}

export async function disableNotifications() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await removePushSubscription(endpoint);
}

/**
 * Refresh or upsert the current device subscription. Runs on every app open
 * while push permission is granted, so expired or rotated subscriptions heal.
 */
export async function refreshPushSubscription() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return;
  if (Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) return;
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    } catch {
      return;
    }
  }
  if (!subscription) return;
  await storeSubscription(subscription);
}
