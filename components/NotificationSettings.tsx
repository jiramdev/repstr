"use client";

import { useLayoutEffect, useState } from "react";
import { disableNotifications, enableNotifications } from "@/lib/enable-notifications";

export default function NotificationSettings() {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    let cancelled = false;

    (async () => {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) {
          setUnsupported(true);
          setReady(true);
        }
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (cancelled) return;
      setBlocked(Notification.permission === "denied");
      setOn(Notification.permission === "granted" && subscription != null);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (!ready || busy || unsupported) return;
    if (!on && typeof Notification !== "undefined" && Notification.permission === "denied") {
      setBlocked(true);
      return;
    }

    setBusy(true);
    if (on) {
      await disableNotifications();
      setOn(false);
      setBlocked(false);
    } else {
      const result = await enableNotifications();
      setOn(result === "granted");
      setBlocked(result === "denied");
      setUnsupported(result === "unsupported");
    }
    setBusy(false);
  }

  return (
    <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] px-5 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-editorial text-[20px] tracking-wide text-white leading-none">Notifications</p>
          <p className="mt-2 text-[13px] text-[#a1a1aa]">
            A nudge every morning when a workout is scheduled.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Notifications"
          disabled={!ready || busy || unsupported}
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
            on ? "bg-[#baa3d0]" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              on ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {unsupported && (
        <p className="mt-3 text-[13px] text-[#a1a1aa]">This browser doesn't support notifications.</p>
      )}
      {blocked && !on && (
        <p className="mt-3 text-[13px] text-[#a1a1aa]">Notifications are blocked in your browser.</p>
      )}
    </section>
  );
}
