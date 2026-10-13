"use client";

import { signOut } from "next-auth/react";
import { clearWorkoutDraft } from "@/lib/workout-draft";
import { clearOutboxAndStorage } from "@/lib/workout-outbox";

/** Sign out everywhere: caches, IndexedDB outbox and local storage are cleared. */
export async function fullSignOut(callbackUrl = "/login") {
  try {
    await clearWorkoutDraft();
  } catch {
    // Draft cleanup must never block signing out.
  }
  clearOutboxAndStorage();
  try {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  } catch {
    // CacheStorage unavailable: nothing to clear.
  }
  await signOut({ callbackUrl });
}
