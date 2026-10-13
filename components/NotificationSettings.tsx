"use client";

import { useLayoutEffect, useState } from "react";
import { AlarmClock, BellRing, Check, FlaskConical, Smartphone, Timer } from "lucide-react";
import { enableNotifications } from "@/lib/enable-notifications";
import {
  saveReminderSettings,
  saveRestTimerEnabled,
  sendTestNotification,
} from "@/app/notifications/actions";

export interface ReminderPrefs {
  reminderEnabled: boolean;
  reminderTime: string;
  reminderTimezone: string;
  restTimerEnabled: boolean;
}

const TIMEZONES = [
  "Europe/Amsterdam",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Rome",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

function detectTimezone(fallback: string) {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? fallback;
  } catch {
    return fallback;
  }
}

const rowClass =
  "bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]";
const labelClass =
  "text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase";
const fieldClass =
  "w-full bg-[#1b1b1e] border border-white/[0.04] rounded-2xl px-4 py-3 text-[14px] text-white outline-none focus:border-[#baa3d0]";

function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
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
  );
}

export default function NotificationSettings({ initial }: { initial: ReminderPrefs }) {
  const [deviceOn, setDeviceOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [busy, setBusy] = useState(false);

  const [restOn, setRestOn] = useState(initial.restTimerEnabled);
  const [reminderOn, setReminderOn] = useState(initial.reminderEnabled);
  const [reminderTime, setReminderTime] = useState(initial.reminderTime);
  const [reminderTimezone, setReminderTimezone] = useState(initial.reminderTimezone);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [testNote, setTestNote] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

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
      setDeviceOn(Notification.permission === "granted" && subscription != null);
      setReady(true);
      if (!TIMEZONES.includes(initial.reminderTimezone)) {
        setReminderTimezone(detectTimezone(initial.reminderTimezone));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableDevice() {
    if (!ready || busy || unsupported) return;
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setBlocked(true);
      return;
    }
    setBusy(true);
    const result = await enableNotifications();
    setDeviceOn(result === "granted");
    setBlocked(result === "denied");
    setUnsupported(result === "unsupported");
    setBusy(false);
  }

  async function toggleRest() {
    const next = !restOn;
    setRestOn(next);
    const result = await saveRestTimerEnabled(next);
    if ("error" in result) setRestOn(!next);
  }

  async function saveReminder(nextOn: boolean) {
    setSaving(true);
    setSavedNote(null);
    const result = await saveReminderSettings({
      enabled: nextOn,
      time: reminderTime,
      timezone: reminderTimezone,
    });
    setSaving(false);
    if ("error" in result) {
      setSavedNote(typeof result.error === "string" ? result.error : "Save failed.");
      return;
    }
    setReminderOn(nextOn);
    setSavedNote(result.scheduled ? "Reminder scheduled." : "Saved. The reminder will be scheduled shortly.");
  }

  async function sendTest() {
    setTesting(true);
    setTestNote(null);
    const result = await sendTestNotification();
    setTesting(false);
    setTestNote("error" in result && typeof result.error === "string" ? result.error : "Test sent. Check your device.");
  }

  return (
    <div className="space-y-3.5">
      <section className={rowClass}>
        <div className="flex items-center justify-between px-1">
          <span className={labelClass}>This device</span>
          <Smartphone className="w-3.5 h-3.5 text-[#baa3d0]" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-medium text-white">
            {deviceOn ? "Notifications on" : blocked ? "Blocked" : unsupported ? "Not supported" : "Notifications off"}
          </p>
          {!deviceOn && !unsupported && (
            <button
              type="button"
              onClick={enableDevice}
              disabled={!ready || busy}
              className="bg-[#baa3d0] text-[#141416] font-semibold px-4 py-2.5 rounded-2xl text-[12px] uppercase tracking-wider apple-press disabled:opacity-50 shrink-0"
            >
              {busy ? "Enabling..." : "Enable"}
            </button>
          )}
          {deviceOn && <Check className="w-4 h-4 text-[#baa3d0] shrink-0" />}
        </div>
        {!deviceOn && !unsupported && (
          <p className="px-1 text-[12px] leading-snug text-[#71717a]">
            iPhone: add the app to the Home Screen first, then tap Enable here.
          </p>
        )}
        {blocked && (
          <p className="px-1 text-[12px] leading-snug text-[#71717a]">
            Notifications are blocked in your browser settings.
          </p>
        )}
      </section>

      <section className={rowClass}>
        <div className="flex items-center justify-between px-1">
          <span className={labelClass}>Rest timer</span>
          <Timer className="w-3.5 h-3.5 text-[#baa3d0]" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-medium text-white">Nudge when rest is over</p>
          <Toggle on={restOn} onChange={toggleRest} label="Rest timer notifications" />
        </div>
      </section>

      <section className={rowClass}>
        <div className="flex items-center justify-between px-1">
          <span className={labelClass}>Daily reminder</span>
          <AlarmClock className="w-3.5 h-3.5 text-[#baa3d0]" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-medium text-white">Remind me on training days</p>
          <Toggle
            on={reminderOn}
            onChange={() => saveReminder(!reminderOn)}
            label="Daily workout reminder"
            disabled={saving}
          />
        </div>
        {reminderOn && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="px-1 text-[10px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
                Time
              </span>
              <input
                type="time"
                step={300}
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                aria-label="Reminder time"
                className={`${fieldClass} text-center`}
              />
            </label>
            <label className="block space-y-1">
              <span className="px-1 text-[10px] font-semibold tracking-[0.14em] text-[#71717a] uppercase">
                Timezone
              </span>
              <select
                value={TIMEZONES.includes(reminderTimezone) ? reminderTimezone : "Europe/Amsterdam"}
                onChange={(e) => setReminderTimezone(e.target.value)}
                aria-label="Reminder timezone"
                className={fieldClass}
              >
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {reminderOn && (
          <button
            type="button"
            onClick={() => saveReminder(true)}
            disabled={saving}
            className="w-full bg-[#baa3d0] text-[#141416] font-semibold py-3 rounded-2xl text-[12px] uppercase tracking-wider apple-press disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save reminder"}
          </button>
        )}
        {savedNote && <p className="px-1 text-[12px] text-[#baa3d0]">{savedNote}</p>}
      </section>

      <section className={rowClass}>
        <div className="flex items-center justify-between px-1">
          <span className={labelClass}>Test</span>
          <FlaskConical className="w-3.5 h-3.5 text-[#baa3d0]" />
        </div>
        <button
          type="button"
          onClick={sendTest}
          disabled={testing}
          className="w-full bg-[#1b1b1e] border border-white/[0.04] text-white font-semibold py-3 rounded-2xl text-[12px] uppercase tracking-wider apple-press disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <BellRing className="w-4 h-4" />
          {testing ? "Sending..." : "Send test notification"}
        </button>
        {testNote && <p className="px-1 text-[12px] text-[#a1a1aa]">{testNote}</p>}
      </section>
    </div>
  );
}
