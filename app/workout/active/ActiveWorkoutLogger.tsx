"use client";

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import { popTransition } from "@/lib/motion";
import { finishWorkout } from "./actions";
import {
  draftKey,
  migrateLegacyDraft,
  setsDraftKey,
  useDraftValue,
  writeDraft,
} from "@/lib/workout-draft";

interface Exercise {
  id: string;
  exerciseId?: string | null;
  name: string;
  tracking?: "weight" | "reps" | "hold";
  targetSets: number;
  restSeconds?: number;
}

interface PreviousSet {
  weight: number | null;
  reps: number;
  durationSeconds?: number | null;
}

interface ActiveWorkoutLoggerProps {
  userId: string;
  planId?: string | null;
  exercises: Exercise[];
  previousSets: Record<string, PreviousSet[]>;
}

interface SetRow {
  setNumber: number;
  weight: string;
  reps: string;
  duration: string;
  isCompleted: boolean;
}

const EMPTY_ROWS: SetRow[] = [];
const emptyCache = new Map<string, Record<string, SetRow[]>>();

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

function emptySets(exercises: Exercise[]): Record<string, SetRow[]> {
  const initial: Record<string, SetRow[]> = {};
  for (const ex of exercises) {
    initial[ex.name] = Array.from({ length: ex.targetSets || 3 }, (_, idx) => ({
      setNumber: idx + 1,
      weight: "",
      reps: "",
      duration: "",
      isCompleted: false,
    }));
  }
  return initial;
}

function cachedEmpty(exercises: Exercise[]) {
  const signature = exercises.map((exercise) => `${exercise.id}:${exercise.targetSets}`).join("|");
  const hit = emptyCache.get(signature);
  if (hit) return hit;
  const value = emptySets(exercises);
  emptyCache.set(signature, value);
  return value;
}

function parseSets(raw: string | null, exercises: Exercise[]) {
  if (!raw) return cachedEmpty(exercises);
  try {
    const parsed = JSON.parse(raw) as Record<string, SetRow[]>;
    for (const rows of Object.values(parsed)) {
      if (!Array.isArray(rows)) return cachedEmpty(exercises);
      for (const row of rows) row.duration = row.duration ?? "";
    }
    return parsed;
  } catch (error) {
    console.error("Fout bij uitlezen sets cache:", error);
    return cachedEmpty(exercises);
  }
}

function parseTarget(raw: string | null) {
  if (!raw) return null;
  const target = parseInt(raw, 10);
  if (!target || target <= Date.now()) return null;
  return target;
}

function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

function RestTimer({
  target,
  onCancel,
  onExpire,
}: {
  target: number | null;
  onCancel: () => void;
  onExpire: () => void;
}) {
  const reduce = useReducedMotion();
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (target == null) return;
    let stopped = false;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      if (remaining <= 0) {
        if (!stopped) {
          stopped = true;
          setSecondsRemaining(null);
          onExpireRef.current();
        }
        return;
      }
      setSecondsRemaining((current) => (current === remaining ? current : remaining));
    };
    const kick = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [target]);

  if (target == null || secondsRemaining == null) return null;

  const body = (
    <>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Timer stoppen"
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/[0.06] text-[#a1a1aa] flex items-center justify-center apple-press"
      >
        <X className="w-4 h-4 stroke-[2.5]" />
      </button>
      <p className="text-[12px] font-semibold tracking-[0.22em] text-[#baa3d0] uppercase">Rust</p>
      <p className="mt-2 font-editorial text-[92px] leading-none tracking-tight text-white">
        {Math.floor(secondsRemaining / 60)}:{(secondsRemaining % 60).toString().padStart(2, "0")}
      </p>
    </>
  );

  const frameClass =
    "pointer-events-auto relative mx-auto max-w-sm bg-[#141416] border border-[#baa3d0]/50 rounded-[34px] px-6 py-7 text-center shadow-[0_24px_60px_rgba(0,0,0,0.55)]";

  return (
    <div className="fixed top-3 left-0 right-0 z-[70] px-4 pointer-events-none">
      {reduce ? (
        <div className={frameClass}>{body}</div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={popTransition}
          className={frameClass}
        >
          {body}
        </motion.div>
      )}
    </div>
  );
}

const ExerciseSection = memo(function ExerciseSection({
  exercise,
  rows,
  previousSets,
  onUpdate,
  onToggle,
}: {
  exercise: Exercise;
  rows: SetRow[];
  previousSets?: PreviousSet[];
  onUpdate: (
    exerciseName: string,
    setIndex: number,
    field: "weight" | "reps" | "duration",
    value: string
  ) => void;
  onToggle: (exerciseName: string, setIndex: number, restDuration: number) => void;
}) {
  const restDuration = exercise.restSeconds || 90;
  const tracking = exercise.tracking ?? "weight";
  const columns =
    tracking === "weight" ? "grid-cols-[28px_1fr_1fr_36px]" : "grid-cols-[28px_1fr_36px]";

  return (
    <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 space-y-3 shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-editorial text-[22px] tracking-wide text-white leading-none">
          {exercise.name}
        </h2>
        <span className="text-[11px] font-semibold tracking-[0.18em] text-[#baa3d0] uppercase">
          {rows.length} {rows.length === 1 ? "SET" : "SETS"}
        </span>
      </div>

      <div className={`grid ${columns} gap-2.5 px-2 text-[10px] uppercase font-semibold text-[#71717a] text-center`}>
        <span>#</span>
        {tracking === "weight" && <span>KG</span>}
        <span>{tracking === "hold" ? "SEC" : "REPS"}</span>
        <span className="sr-only">Afgevinkt</span>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => {
          const isDone = row.isCompleted;
          const previous = previousSets?.[idx];

          return (
            <div
              key={row.setNumber}
              className={`grid ${columns} gap-2.5 items-center rounded-2xl px-2 py-1.5 transition ${
                isDone
                  ? "bg-[#1d1d22] border border-white/[0.06]"
                  : "bg-[#18181b] border border-transparent"
              }`}
            >
              <span className="text-center font-editorial text-[16px] text-[#71717a]">
                {row.setNumber}
              </span>

              {tracking === "weight" && (
                <input
                  type="number"
                  inputMode="decimal"
                  aria-label={`Set ${row.setNumber} gewicht in kilo`}
                  placeholder={previous ? String(previous.weight) : "—"}
                  value={row.weight}
                  disabled={isDone}
                  onChange={(e) => onUpdate(exercise.name, idx, "weight", e.target.value)}
                  className="w-full bg-[#121214] border border-white/[0.06] rounded-xl py-2 text-center font-mono text-[15px] font-medium text-white outline-none placeholder:text-[#71717a] focus:border-[#baa3d0] disabled:opacity-40"
                />
              )}

              <input
                type="number"
                inputMode="numeric"
                aria-label={
                  tracking === "hold"
                    ? `Set ${row.setNumber} seconden`
                    : `Set ${row.setNumber} herhalingen`
                }
                placeholder={
                  tracking === "hold"
                    ? previous?.durationSeconds
                      ? String(previous.durationSeconds)
                      : "—"
                    : previous
                      ? String(previous.reps)
                      : "—"
                }
                value={tracking === "hold" ? row.duration : row.reps}
                disabled={isDone}
                onChange={(e) =>
                  onUpdate(exercise.name, idx, tracking === "hold" ? "duration" : "reps", e.target.value)
                }
                className="w-full bg-[#121214] border border-white/[0.06] rounded-xl py-2 text-center font-mono text-[15px] font-medium text-white outline-none placeholder:text-[#71717a] focus:border-[#baa3d0] disabled:opacity-40"
              />

              <button
                type="button"
                aria-pressed={isDone}
                aria-label={isDone ? `Set ${row.setNumber} afgevinkt` : `Set ${row.setNumber} afvinken`}
                onClick={() => onToggle(exercise.name, idx, restDuration)}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition apple-press ${
                  isDone
                    ? "bg-[#baa3d0] text-[#141416]"
                    : "border border-white/20 text-transparent hover:border-[#baa3d0] hover:text-[#baa3d0]"
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
});

function loggedNumber(typed: string, previous: number | null | undefined, asInteger = false) {
  if (typed.trim() === "") return previous ?? 0;
  const parsed = asInteger ? parseInt(typed, 10) : Number(typed);
  return Number.isFinite(parsed) ? parsed : previous ?? 0;
}

export default function ActiveWorkoutLogger({
  userId,
  planId,
  exercises,
  previousSets = {},
}: ActiveWorkoutLoggerProps) {
  const router = useRouter();
  const setsKey = setsDraftKey(userId, planId);
  const startKey = draftKey(userId, "started_at");
  const targetKey = draftKey(userId, "rest_target");
  const tokenKey = draftKey(userId, "rest_token");
  const exerciseKey = draftKey(userId, "rest_exercise");
  const pushGen = useRef(0);
  const [isFinishing, setFinishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startedAt = useDraftValue(startKey, (raw) => raw ?? "", "");
  const setsData = useDraftValue(setsKey, (raw) => parseSets(raw, exercises), cachedEmpty(exercises));
  const restTarget = useDraftValue(targetKey, parseTarget, null);

  useEffect(() => {
    migrateLegacyDraft(userId, planId);
    if (!localStorage.getItem(startKey)) writeDraft(startKey, new Date().toISOString());
  }, [userId, planId, startKey]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registreren mislukt:", err);
    });
  }, []);

  const cancelRestNotification = useCallback((token: string) => {
    fetch("/api/rest-timer", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch((err) => console.error("Rustmelding annuleren mislukt:", err));
  }, []);

  const dismissRestNotification = useCallback(() => {
    pushGen.current += 1;
    const token = localStorage.getItem(tokenKey);
    writeDraft(tokenKey, null);
    if (token) cancelRestNotification(token);
  }, [cancelRestNotification, tokenKey]);

  const scheduleServerPush = useCallback(
    (seconds: number, exerciseName: string) => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) return;

      const gen = ++pushGen.current;
      const token = crypto.randomUUID();

      navigator.serviceWorker.ready
        .then(async (reg) => {
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
            });
          }
          if (!sub || pushGen.current !== gen) return;

          const response = await fetch("/api/rest-timer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subscription: sub,
              delaySeconds: seconds,
              exerciseName,
              planId,
              token,
            }),
          });
          if (!response.ok || pushGen.current !== gen) {
            cancelRestNotification(token);
            return;
          }
          writeDraft(tokenKey, token);
        })
        .catch((err) => console.error("Achtergrond push plannen mislukt:", err));
    },
    [cancelRestNotification, planId, tokenKey]
  );

  const clearTimer = useCallback(() => {
    writeDraft(targetKey, null);
    writeDraft(exerciseKey, null);
  }, [exerciseKey, targetKey]);

  const stopTimer = useCallback(() => {
    dismissRestNotification();
    clearTimer();
  }, [clearTimer, dismissRestNotification]);

  const startRestTimer = useCallback(
    (seconds: number, exerciseName: string) => {
      const targetTimestamp = Date.now() + seconds * 1000;
      writeDraft(targetKey, targetTimestamp.toString());
      writeDraft(exerciseKey, exerciseName);
      dismissRestNotification();
      scheduleServerPush(seconds, exerciseName);
    },
    [dismissRestNotification, exerciseKey, scheduleServerPush, targetKey]
  );

  const handleUpdate = useCallback(
    (exerciseName: string, setIndex: number, field: "weight" | "reps" | "duration", value: string) => {
      const rows = setsData[exerciseName];
      if (!rows) return;
      const nextRows = [...rows];
      nextRows[setIndex] = { ...nextRows[setIndex], [field]: value };
      writeDraft(setsKey, JSON.stringify({ ...setsData, [exerciseName]: nextRows }));
    },
    [setsData, setsKey]
  );

  const handleToggleSet = useCallback(
    (exerciseName: string, setIndex: number, restDuration: number = 90) => {
      const rows = setsData[exerciseName];
      const current = rows?.[setIndex];
      if (!rows || !current) return;
      const nextState = !current.isCompleted;
      const nextRows = [...rows];
      nextRows[setIndex] = { ...current, isCompleted: nextState };
      writeDraft(setsKey, JSON.stringify({ ...setsData, [exerciseName]: nextRows }));
      if (nextState) startRestTimer(restDuration, exerciseName);
    },
    [setsData, setsKey, startRestTimer]
  );

  const handleFinish = async () => {
    const completedSets = Object.entries(setsData).flatMap(([exerciseName, rows]) =>
      rows
        .filter((r) => r.isCompleted)
        .map((r) => {
          const exercise = exercises.find((item) => item.name === exerciseName);
          const previous = previousSets[exerciseName]?.[r.setNumber - 1];
          const mode = exercise?.tracking ?? "weight";
          return {
            exerciseId: exercise?.exerciseId,
            exerciseName,
            setNumber: r.setNumber,
            weight: mode === "weight" ? loggedNumber(r.weight, previous?.weight) : null,
            reps: mode === "hold" ? 0 : loggedNumber(r.reps, previous?.reps, true),
            durationSeconds:
              mode === "hold"
                ? loggedNumber(r.duration, previous?.durationSeconds ?? undefined, true)
                : null,
          };
        })
    );

    if (completedSets.length === 0) {
      if (!confirm("Nog geen sets afgevinkt. Toch voltooien?")) return;
    }

    setFinishing(true);
    setSaveError(null);
    try {
      const result = await finishWorkout({ planId, startedAt, sets: completedSets });
      if (!result?.success) {
        setSaveError(result?.error ?? "Opslaan mislukt. Je sets staan nog op dit apparaat.");
        setFinishing(false);
        return;
      }
    } catch {
      setSaveError("Opslaan mislukt. Je sets staan nog op dit apparaat.");
      setFinishing(false);
      return;
    }

    stopTimer();
    writeDraft(setsKey, null);
    writeDraft(startKey, null);
    router.push("/");
  };

  function handleCancel() {
    if (!confirm("Workout annuleren? Er wordt niets opgeslagen.")) return;
    stopTimer();
    writeDraft(setsKey, null);
    writeDraft(startKey, null);
    router.push("/");
  }

  return (
    <LoggerView
      exercises={exercises}
      setsData={setsData}
      previousSets={previousSets}
      restTarget={restTarget}
      saveError={saveError}
      isFinishing={isFinishing}
      onCancel={handleCancel}
      onFinish={handleFinish}
      onUpdate={handleUpdate}
      onToggle={handleToggleSet}
      onStopTimer={stopTimer}
      onClearTimer={clearTimer}
    />
  );
}

function LoggerView({
  exercises,
  setsData,
  previousSets,
  restTarget,
  saveError,
  isFinishing,
  onCancel,
  onFinish,
  onUpdate,
  onToggle,
  onStopTimer,
  onClearTimer,
}: {
  exercises: Exercise[];
  setsData: Record<string, SetRow[]>;
  previousSets: Record<string, PreviousSet[]>;
  restTarget: number | null;
  saveError: string | null;
  isFinishing: boolean;
  onCancel: () => void;
  onFinish: () => void;
  onUpdate: (
    exerciseName: string,
    setIndex: number,
    field: "weight" | "reps" | "duration",
    value: string
  ) => void;
  onToggle: (exerciseName: string, setIndex: number, restDuration: number) => void;
  onStopTimer: () => void;
  onClearTimer: () => void;
}) {
  return (
    <div className="space-y-3.5">
      <header className="flex items-center justify-between px-1 py-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isFinishing}
          aria-label="Workout annuleren"
          className="w-10 h-10 rounded-full bg-[#141416] border border-white/[0.08] flex items-center justify-center text-white apple-press shadow-[0_4px_12px_rgba(0,0,0,0.15)] disabled:opacity-50"
        >
          <X className="w-5 h-5 stroke-[1.8]" />
        </button>
        <div className="h-10 bg-[#141416] border border-white/[0.08] px-4 rounded-full flex items-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
          <span className="w-2 h-2 rounded-full bg-[#baa3d0]" />
          <span className="font-editorial text-[14px] tracking-wider text-white leading-none uppercase">
            Workout
          </span>
        </div>
      </header>

      <RestTimer key={restTarget ?? "off"} target={restTarget} onCancel={onStopTimer} onExpire={onClearTimer} />

      {exercises.map((ex) => (
        <ExerciseSection
          key={ex.id}
          exercise={ex}
          rows={setsData[ex.name] ?? EMPTY_ROWS}
          previousSets={previousSets[ex.name]}
          onUpdate={onUpdate}
          onToggle={onToggle}
        />
      ))}

      {saveError && (
        <p role="alert" className="px-1 text-[13px] text-red-300">
          {saveError}
        </p>
      )}

      <button
        onClick={onFinish}
        disabled={isFinishing}
        className="w-full bg-[#141416] border border-white/[0.08] rounded-[30px] py-4 text-center transition apple-press shadow-[0_12px_28px_rgba(0,0,0,0.2)] disabled:opacity-50"
      >
        <span className="font-editorial text-[20px] tracking-wider text-[#baa3d0] uppercase leading-none block">
          {isFinishing ? "OPSLAAN..." : "SESSIE VOLTOOIEN"}
        </span>
      </button>
    </div>
  );
}
