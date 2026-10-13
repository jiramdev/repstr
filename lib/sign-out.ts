"use client";

import { signOut } from "next-auth/react";
import { clearWorkoutDraft } from "@/lib/workout-draft";
import { clearOutboxAndStorage } from "@/lib/workout-outbox";
import { removePushSubscription } from "@/app/notifications/actions";

/** Delete this device's push subscription, server row included. */
async function forgetDeviceSubscription() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration ? await registration.pushManager.getSubscription() : null;
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => {});
    await removePushSubscription(endpoint);
  } catch {
    // Subscription cleanup must never block signing out.
  }
}

/** Sign out everywhere: caches, IndexedDB outbox and local storage are cleared. */
export async function fullSignOut(callbackUrl = "/login") {
  try {
    await clearWorkoutDraft();
  } catch {
    // Draft cleanup must never block signing out.
  }
  await forgetDeviceSubscription();
  clearOutboxAndStorage();
  try {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  } catch {
    // CacheStorage unavailable: nothing to clear.
  }
  await signOut({ callbackUrl });
}
