"use client";

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { motion } from "motion/react";
import { popTransition } from "@/lib/motion";
import { secondsRemaining as remainingSeconds } from "@/lib/notifications";
import { placeholderSet } from "@/lib/strength";
import {
  abandonWorkoutSession,
  deleteLoggedSet,
  finishWorkoutSession,
  logSet,
  skipSessionRest,
  startWorkoutSession,
  updateLoggedSet,
} from "./session-actions";
import {
  draftKey,
  migrateLegacyDraft,
  setsDraftKey,
  useDraftValue,
  writeDraft,
} from "@/lib/workout-draft";
import { enqueueOp, listOps, removeOp } from "@/lib/workout-outbox";

interface Exercise {
  id: string;
  exerciseId?: string | null;
  name: string;
  tracking?: "weight" | "reps" | "hold";
  targetSets: number;
  restSeconds?: number;
  repGoal?: number | null;
}

interface PreviousSet {
  weight: number | null;
  reps: number;
  durationSeconds?: number | null;
}

interface SessionEntry {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weight: number | null;
  durationSeconds: number | null;
}

interface InitialSession {
  id: string;
  planId: string | null;
  startedAt: string;
  entries: SessionEntry[];
}

interface ActiveWorkoutLoggerProps {
  userId: string;
  planId?: string | null;
  exercises: Exercise[];
  previousSets?: Record<string, PreviousSet[]>;
  initialSession?: InitialSession | null;
}

interface SetRow {
  key: string;
  entryId: string | null;
  setNumber: number;
  weight: string;
  reps: string;
  duration: string;
  isCompleted: boolean;
  pending: boolean;
}

function clientKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

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

function emptyRows(count: number): SetRow[] {
  const safe = Math.min(Math.max(count || 3, 1), 20);
  return Array.from({ length: safe }, (_, idx) => ({
    key: clientKey(),
    entryId: null,
    setNumber: idx + 1,
    weight: "",
    reps: "",
    duration: "",
    isCompleted: false,
    pending: false,
  }));
}

function sanitizeRows(raw: unknown, fallbackCount: number): SetRow[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rows = (raw as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) return null;
  const clean: SetRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") return null;
    const r = row as Partial<SetRow>;
    clean.push({
      key: typeof r.key === "string" && r.key ? r.key : clientKey(),
      entryId: typeof r.entryId === "string" ? r.entryId : null,
      setNumber: Number.isInteger(r.setNumber) && (r.setNumber as number) > 0 ? (r.setNumber as number) : clean.length + 1,
      weight: typeof r.weight === "string" ? r.weight : "",
      reps: typeof r.reps === "string" ? r.reps : "",
      duration: typeof r.duration === "string" ? r.duration : "",
      isCompleted: r.isCompleted === true,
      pending: false,
    });
  }
  if (clean.length === 0) return emptyRows(fallbackCount);
  return clean;
}

function buildInitialRows(
  exercises: Exercise[],
  cached: Record<string, unknown> | null,
  session: InitialSession | null
): Record<string, SetRow[]> {
  const initial: Record<string, SetRow[]> = {};
  const byExerciseId = new Map<string, SessionEntry[]>();
  const byName = new Map<string, SessionEntry[]>();
  for (const entry of session?.entries ?? []) {
    if (entry.exerciseId) {
      const list = byExerciseId.get(entry.exerciseId) ?? [];
      list.push(entry);
      byExerciseId.set(entry.exerciseId, list);
    }
    const named = byName.get(entry.exerciseName) ?? [];
    named.push(entry);
    byName.set(entry.exerciseName, named);
  }
  const claimedIds = new Set<string>();

  for (const ex of exercises) {
    const fromCache = cached ? sanitizeRows(cached[ex.id], ex.targetSets || 3) : null;
    // Server is the source of truth: logged entries always win over the cache.
    const serverEntries =
      (ex.exerciseId && !claimedIds.has(ex.exerciseId)
        ? byExerciseId.get(ex.exerciseId)
        : undefined) ?? byName.get(ex.name) ?? [];
    if (ex.exerciseId) claimedIds.add(ex.exerciseId);

    const rows: SetRow[] = serverEntries.map((entry) => ({
      key: clientKey(),
      entryId: entry.id,
      setNumber: entry.setNumber,
      weight: entry.weight != null ? String(entry.weight) : "",
      reps: entry.reps ? String(entry.reps) : "",
      duration: entry.durationSeconds != null ? String(entry.durationSeconds) : "",
      isCompleted: true,
      pending: false,
    }));

    if (fromCache) {
      for (const cachedRow of fromCache) {
        if (cachedRow.entryId && rows.some((row) => row.entryId === cachedRow.entryId)) continue;
        if (!cachedRow.entryId && !cachedRow.isCompleted) rows.push({ ...cachedRow, pending: false });
      }
      rows.sort((a, b) => a.setNumber - b.setNumber);
    }

    const target = Math.min(Math.max(ex.targetSets || 3, 1), 20);
    let next = rows.reduce((max, row) => Math.max(max, row.setNumber), 0);
    while (rows.length < target) {
      next += 1;
      rows.push({
        key: clientKey(),
        entryId: null,
        setNumber: next,
        weight: "",
        reps: "",
        duration: "",
        isCompleted: false,
        pending: false,
      });
    }
    initial[ex.id] = rows;
  }
  return initial;
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
  onSkip,
  onExpire,
}: {
  target: number | null;
  onSkip: () => void;
  onExpire: () => void;
}) {
  const reduce = useReducedMotion();
  const [left, setLeft] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (target == null) return;
    let stopped = false;
    const tick = () => {
      const remaining = remainingSeconds(target, Date.now());
      if (remaining <= 0) {
        if (!stopped) {
          stopped = true;
          setLeft(null);
          onExpireRef.current();
        }
        return;
      }
      setLeft((current) => (current === remaining ? current : remaining));
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

  if (target == null || left == null) return null;

  const body = (
    <>
      <p className="text-[12px] font-semibold tracking-[0.22em] text-[#baa3d0] uppercase">Rest</p>
      <p className="mt-2 font-editorial text-[92px] leading-none tracking-tight text-white">
        {Math.floor(left / 60)}:{(left % 60).toString().padStart(2, "0")}
      </p>
      <button
        type="button"
        onClick={onSkip}
        aria-label="Skip rest"
        className="mt-4 bg-[#baa3d0] text-[#141416] rounded-full px-6 py-2.5 font-editorial text-[15px] tracking-wider apple-press"
      >
        SKIP
      </button>
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

function setPayload(
  exercise: Exercise,
  row: SetRow,
  previous?: PreviousSet
): { exerciseId?: string; exerciseName: string; setNumber: number; weight: number | null; reps: number; durationSeconds: number | null } {
  const mode = exercise.tracking ?? "weight";
  const num = (raw: string, fallback: number | null | undefined, integer: boolean) => {
    if (raw.trim() === "") return fallback ?? 0;
    const parsed = integer ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback ?? 0;
  };
  return {
    ...(exercise.exerciseId ? { exerciseId: exercise.exerciseId } : {}),
    exerciseName: exercise.name,
    setNumber: row.setNumber,
    weight: mode === "weight" ? num(row.weight, previous?.weight, false) : null,
    reps: mode === "hold" ? 0 : num(row.reps, previous?.reps, true),
    durationSeconds:
      mode === "hold" ? num(row.duration, previous?.durationSeconds, true) : null,
  };
}

export default function ActiveWorkoutLogger({
  userId,
  planId,
  exercises,
  previousSets = {},
  initialSession = null,
}: ActiveWorkoutLoggerProps) {
  const router = useRouter();
  const setsKey = setsDraftKey(userId, planId);
  const stepKey = draftKey(userId, `step:${planId ?? "none"}`);
  const targetKey = draftKey(userId, "rest_target");
  const tokenKey = draftKey(userId, "rest_token");
  const exerciseKey = draftKey(userId, "rest_exercise");
  const pushGen = useRef(0);
  const draining = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(initialSession?.id ?? null);
  const [starting, setStarting] = useState(!initialSession);
  const [isFinishing, setFinishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [rowsByExercise, setRowsByExercise] = useState<Record<string, SetRow[]>>(() =>
    buildInitialRows(exercises, null, initialSession)
  );
  const [step, setStep] = useState(0);
  const mergedCache = useRef(false);

  useEffect(() => {
    // Merge the local cache after mount (client only, so SSR stays clean).
    // The server is the source of truth: logged entries always win.
    if (mergedCache.current) return;
    mergedCache.current = true;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time local cache hydration after mount */
    let cached: Record<string, unknown> | null = null;
    try {
      const raw = localStorage.getItem(setsKey);
      cached = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      cached = null;
    }
    if (cached) setRowsByExercise(buildInitialRows(exercises, cached, initialSession));
    const rawStep = Number(localStorage.getItem(stepKey));
    if (Number.isInteger(rawStep) && rawStep >= 0 && rawStep < exercises.length) {
      setStep(rawStep);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [exercises, initialSession, setsKey, stepKey]);

  const restTarget = useDraftValue(targetKey, parseTarget, null);

  useEffect(() => {
    migrateLegacyDraft(userId, planId);
    // Refresh the route on mount so a revisit to the same workout URL never
    // shows a cached document: placeholders and session state come fresh
    // from the server. Props flow straight into the placeholders below.
    router.refresh();
  }, [userId, planId, router]);

  // Start (or resume) the server-side session. The server is the source of truth.
  useEffect(() => {
    if (initialSession) return;
    let cancelled = false;
    startWorkoutSession(planId)
      .then((result) => {
        if (cancelled) return;
        if ("sessionId" in result) setSessionId(result.sessionId);
        else setSaveError("Couldn't start the session. Try again.");
        setStarting(false);
      })
      .catch(() => {
        if (!cancelled) {
          setSaveError("Couldn't start the session. Try again.");
          setStarting(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialSession, planId]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Failed to register service worker:", err);
    });
  }, []);

  const goStep = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), exercises.length - 1);
      setStep(clamped);
      writeDraft(stepKey, String(clamped));
    },
    [exercises.length, stepKey]
  );

  const persistRows = useCallback(
    (next: Record<string, SetRow[]>) => {
      setRowsByExercise(next);
      try {
        const slim: Record<string, { rows: SetRow[] }> = {};
        for (const [key, rows] of Object.entries(next)) slim[key] = { rows };
        writeDraft(setsKey, JSON.stringify(slim));
      } catch {
        // Cache writes must never break the workout.
      }
    },
    [setsKey]
  );

  const drainOutbox = useCallback(
    async (activeSessionId: string) => {
      if (draining.current) return;
      draining.current = true;
      try {
        const ops = (await listOps())
          .filter((op) => op.sessionId === activeSessionId)
          .sort((a, b) => a.createdAt - b.createdAt);
        for (const op of ops) {
          try {
            if (op.kind === "create") {
              const result = await logSet(activeSessionId, op.set);
              if ("success" in result) {
                const entryId = result.entryId;
                if (typeof entryId !== "string") {
                  await removeOp(op.id);
                  continue;
                }
                const key = op.clientKey;
                setRowsByExercise((current) => {
                  const next = { ...current };
                  for (const [exId, rows] of Object.entries(next)) {
                    next[exId] = rows.map((row) =>
                      row.key === key ? { ...row, entryId, pending: false } : row
                    );
                  }
                  return next;
                });
                await removeOp(op.id);
              } else {
                await removeOp(op.id);
                setSaveError(result.error ?? "Save failed.");
              }
            } else if (op.kind === "update") {
              const result = await updateLoggedSet(activeSessionId, op.entryId, op.set);
              await removeOp(op.id);
              if (!("success" in result)) setSaveError(result.error ?? "Save failed.");
              else {
                setRowsByExercise((current) => {
                  const next = { ...current };
                  for (const [exId, rows] of Object.entries(next)) {
                    next[exId] = rows.map((row) =>
                      row.key === op.clientKey ? { ...row, pending: false } : row
                    );
                  }
                  return next;
                });
              }
            } else {
              const result = await deleteLoggedSet(activeSessionId, op.entryId);
              await removeOp(op.id);
              if (!("success" in result)) setSaveError(result.error ?? "Delete failed.");
            }
          } catch {
            // Offline or transient: keep the op queued and retry later.
            break;
          }
        }
      } finally {
        draining.current = false;
      }
    },
    []
  );

  useEffect(() => {
    if (!sessionId) return;
    drainOutbox(sessionId);
    const onOnline = () => drainOutbox(sessionId);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sessionId, drainOutbox]);

  const cancelRestNotification = useCallback((token: string) => {
    fetch("/api/rest-timer", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch((err) => console.error("Failed to cancel rest notification:", err));
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
      if (!sessionId) return;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) return;

      const gen = ++pushGen.current;
      const token = crypto.randomUUID();
      const activeSession = sessionId;

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
              workoutLogId: activeSession,
            }),
          });
          if (!response.ok || pushGen.current !== gen) {
            cancelRestNotification(token);
            return;
          }
          writeDraft(tokenKey, token);
        })
        .catch((err) => console.error("Failed to schedule background push:", err));
    },
    [cancelRestNotification, planId, sessionId, tokenKey]
  );

  const clearTimer = useCallback(() => {
    writeDraft(targetKey, null);
    writeDraft(exerciseKey, null);
  }, [exerciseKey, targetKey]);

  const stopTimer = useCallback(() => {
    dismissRestNotification();
    clearTimer();
  }, [clearTimer, dismissRestNotification]);

  const skipRest = useCallback(() => {
    stopTimer();
    if (sessionId) skipSessionRest(sessionId).catch(() => {});
  }, [sessionId, stopTimer]);

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
    (exerciseId: string, setIndex: number, field: "weight" | "reps" | "duration", value: string) => {
      const rows = rowsByExercise[exerciseId];
      if (!rows || rows[setIndex]?.isCompleted) return;
      const nextRows = [...rows];
      nextRows[setIndex] = { ...nextRows[setIndex], [field]: value };
      persistRows({ ...rowsByExercise, [exerciseId]: nextRows });
    },
    [rowsByExercise, persistRows]
  );

  const handleToggleSet = useCallback(
    (exercise: Exercise, setIndex: number) => {
      const rows = rowsByExercise[exercise.id];
      const current = rows?.[setIndex];
      if (!rows || !current || !sessionId) return;
      const restDuration = exercise.restSeconds || 90;
      const previous = (exercise.exerciseId ? previousSets[exercise.exerciseId] : undefined)?.[
        current.setNumber - 1
      ];

      if (!current.isCompleted) {
        const nextRows = [...rows];
        nextRows[setIndex] = { ...current, isCompleted: true, pending: true };
        persistRows({ ...rowsByExercise, [exercise.id]: nextRows });
        const payload = setPayload(exercise, current, previous);
        enqueueOp({ kind: "create", clientKey: current.key, sessionId, set: payload })
          .then(() => drainOutbox(sessionId))
          .catch((err) => console.error("Failed to save set:", err));
        startRestTimer(restDuration, exercise.name);
      } else {
        // Unchecking removes the logged set from the server; values stay editable.
        const nextRows = [...rows];
        nextRows[setIndex] = { ...current, isCompleted: false, entryId: null, pending: false };
        persistRows({ ...rowsByExercise, [exercise.id]: nextRows });
        if (current.entryId) {
          const entryId = current.entryId;
          enqueueOp({ kind: "delete", clientKey: current.key, sessionId, entryId })
            .then(() => drainOutbox(sessionId))
            .catch((err) => console.error("Failed to delete set:", err));
        }
      }
    },
    [rowsByExercise, persistRows, sessionId, previousSets, drainOutbox, startRestTimer]
  );

  const handleDelete = useCallback(
    (exercise: Exercise, setIndex: number) => {
      const rows = rowsByExercise[exercise.id];
      const current = rows?.[setIndex];
      if (!rows || !current || !sessionId) return;
      const nextRows = rows.filter((_, idx) => idx !== setIndex);
      persistRows({ ...rowsByExercise, [exercise.id]: nextRows.length ? nextRows : emptyRows(1) });
      if (current.entryId) {
        const entryId = current.entryId;
        enqueueOp({ kind: "delete", clientKey: current.key, sessionId, entryId })
          .then(() => drainOutbox(sessionId))
          .catch((err) => console.error("Failed to delete set:", err));
      }
    },
    [rowsByExercise, persistRows, sessionId, drainOutbox]
  );

  const handleAddSet = useCallback(
    (exercise: Exercise) => {
      const rows = rowsByExercise[exercise.id] ?? [];
      const nextNumber = rows.reduce((max, row) => Math.max(max, row.setNumber), 0) + 1;
      persistRows({
        ...rowsByExercise,
        [exercise.id]: [
          ...rows,
          { key: clientKey(), entryId: null, setNumber: nextNumber, weight: "", reps: "", duration: "", isCompleted: false, pending: false },
        ],
      });
    },
    [rowsByExercise, persistRows]
  );

  const handleSameAsLast = useCallback(
    (exercise: Exercise) => {
      const last = exercise.exerciseId ? previousSets[exercise.exerciseId]?.at(-1) : undefined;
      if (!last) return;
      const rows = rowsByExercise[exercise.id] ?? [];
      const idx = rows.findIndex((row) => !row.isCompleted);
      if (idx === -1) return;
      const nextRows = [...rows];
      const mode = exercise.tracking ?? "weight";
      nextRows[idx] = {
        ...nextRows[idx],
        weight: mode === "weight" && last.weight != null ? String(last.weight) : nextRows[idx].weight,
        reps: mode !== "hold" ? String(last.reps) : nextRows[idx].reps,
        duration: mode === "hold" && last.durationSeconds != null ? String(last.durationSeconds) : nextRows[idx].duration,
      };
      persistRows({ ...rowsByExercise, [exercise.id]: nextRows });
    },
    [rowsByExercise, persistRows, previousSets]
  );

  const clearDrafts = useCallback(() => {
    writeDraft(setsKey, null);
    writeDraft(stepKey, null);
  }, [setsKey, stepKey]);

  const handleFinish = async () => {
    if (!sessionId) return;
    const completed = Object.values(rowsByExercise).flat().filter((row) => row.isCompleted);
    if (completed.length === 0) {
      if (!confirm("No sets logged yet. Finish anyway?")) return;
    }
    setFinishing(true);
    setSaveError(null);
    try {
      await drainOutbox(sessionId);
      const result = await finishWorkoutSession(sessionId);
      if (!("success" in result)) {
        setSaveError(result.error ?? "Save failed.");
        setFinishing(false);
        return;
      }
    } catch {
      setSaveError("Save failed. Your sets are still on this device.");
      setFinishing(false);
      return;
    }
    stopTimer();
    clearDrafts();
    router.push("/");
  };

  const handleAbandon = async () => {
    if (!sessionId) return;
    if (!confirm("Leave workout? Logged sets will be kept as an abandoned session.")) return;
    try {
      await abandonWorkoutSession(sessionId);
    } catch {
      setSaveError("Leaving failed. Try again.");
      return;
    }
    stopTimer();
    clearDrafts();
    router.push("/");
  };

  const exercise = exercises[step];
  const rows = exercise ? (rowsByExercise[exercise.id] ?? []) : [];
  const doneCount = rows.filter((row) => row.isCompleted).length;
  const currentSetNumber = Math.min(doneCount + 1, Math.max(rows.length, 1));
  const previous = exercise?.exerciseId ? previousSets[exercise.exerciseId] : undefined;

  return (
    <div className="space-y-3.5">
      <header className="flex items-center justify-between px-1 py-1">
        <button
          type="button"
          onClick={handleAbandon}
          disabled={isFinishing || starting}
          aria-label="Leave workout"
          className="w-10 h-10 rounded-full bg-[#141416] border border-white/[0.08] flex items-center justify-center text-white apple-press shadow-[0_4px_12px_rgba(0,0,0,0.15)] disabled:opacity-50"
        >
          <X className="w-5 h-5 stroke-[1.8]" />
        </button>
        <div className="h-10 bg-[#141416] border border-white/[0.08] px-4 rounded-full flex items-center gap-2 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
          <span className="w-2 h-2 rounded-full bg-[#baa3d0]" />
          <span className="font-editorial text-[14px] tracking-wider text-white leading-none uppercase">
            Exercise {exercises.length ? step + 1 : 0} of {exercises.length}
          </span>
        </div>
        <div className="h-10 bg-[#141416] border border-white/[0.08] px-4 rounded-full flex items-center shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
          <span className="font-editorial text-[14px] tracking-wider text-white leading-none uppercase">
            Set {currentSetNumber} of {Math.max(rows.length, 1)}
          </span>
        </div>
      </header>

      <RestTimer key={restTarget ?? "off"} target={restTarget} onSkip={skipRest} onExpire={clearTimer} />

      {starting || !exercise ? (
        <section className="bg-[#141416] border border-white/[0.08] rounded-[30px] p-5 text-center shadow-[0_12px_28px_rgba(0,0,0,0.2)]">
          <p className="font-editorial text-[22px] tracking-wide text-white leading-none">Starting session…</p>
        </section>
      ) : (
        <ExerciseStep
          key={exercise.id}
          exercise={exercise}
          rows={rows}
          previousSets={previous}
          onUpdate={(idx, field, value) => handleUpdate(exercise.id, idx, field, value)}
          onToggle={(idx) => handleToggleSet(exercise, idx)}
          onDelete={(idx) => handleDelete(exercise, idx)}
          onAddSet={() => handleAddSet(exercise)}
          onSameAsLast={() => handleSameAsLast(exercise)}
        />
      )}

      <nav className="flex items-center gap-2.5" aria-label="Exercises">
        <button
          type="button"
          onClick={() => goStep(step - 1)}
          disabled={step === 0 || starting}
          className="flex-1 bg-[#141416] border border-white/[0.08] rounded-full py-3.5 flex items-center justify-center gap-1 text-white apple-press disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="font-editorial text-[15px] tracking-wider uppercase leading-none">Previous</span>
        </button>
        <button
          type="button"
          onClick={() => goStep(step + 1)}
          disabled={step >= exercises.length - 1 || starting}
          className="flex-1 bg-[#141416] border border-white/[0.08] rounded-full py-3.5 flex items-center justify-center gap-1 text-white apple-press disabled:opacity-40"
        >
          <span className="font-editorial text-[15px] tracking-wider uppercase leading-none">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </nav>

      {saveError && (
        <p role="alert" className="px-1 text-[13px] text-red-300">
          {saveError}
        </p>
      )}

      <div className="h-24" aria-hidden="true" />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pt-6 bg-gradient-to-t from-[#baa3d0] via-[#baa3d0]/95 to-transparent"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handleFinish}
          disabled={isFinishing || starting}
          className="w-full max-w-sm mx-auto block bg-[#141416] border border-white/[0.08] rounded-[30px] py-4 text-center transition apple-press shadow-[0_12px_28px_rgba(0,0,0,0.2)] disabled:opacity-50"
        >
          <span className="font-editorial text-[20px] tracking-wider text-[#baa3d0] uppercase leading-none block">
            {isFinishing ? "SAVING..." : "FINISH WORKOUT"}
          </span>
        </button>
      </div>
    </div>
  );
}

const ExerciseStep = memo(function ExerciseStep({
  exercise,
  rows,
  previousSets,
  onUpdate,
  onToggle,
  onDelete,
  onAddSet,
  onSameAsLast,
}: {
  exercise: Exercise;
  rows: SetRow[];
  previousSets?: PreviousSet[];
  onUpdate: (setIndex: number, field: "weight" | "reps" | "duration", value: string) => void;
  onToggle: (setIndex: number) => void;
  onDelete: (setIndex: number) => void;
  onAddSet: () => void;
  onSameAsLast: () => void;
}) {
  const restDuration = exercise.restSeconds || 90;
  const tracking = exercise.tracking ?? "weight";
  const columns =
    tracking === "weight" ? "grid-cols-[28px_1fr_1fr_36px]" : "grid-cols-[28px_1fr_36px]";
  const lastPrevious = previousSets?.at(-1);

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

      {(exercise.repGoal != null || lastPrevious) && (
        <div className="flex items-center justify-between px-1 gap-2">
          <span className="text-[12px] text-[#a1a1aa] font-medium">
            {exercise.repGoal != null
              ? `Target: ${exercise.repGoal} ${tracking === "hold" ? "sec" : "reps"} · Rest ${restDuration}s`
              : `Rest ${restDuration}s`}
          </span>
          {lastPrevious && (
            <button
              type="button"
              onClick={onSameAsLast}
              className="text-[12px] font-semibold text-[#baa3d0] apple-press shrink-0"
            >
              Same as last time
            </button>
          )}
        </div>
      )}

      <div className={`grid ${columns} gap-2.5 px-2 text-[10px] uppercase font-semibold text-[#71717a] text-center`}>
        <span>#</span>
        {tracking === "weight" && <span>KG</span>}
        <span>{tracking === "hold" ? "SEC" : "REPS"}</span>
        <span className="sr-only">Afgevinkt</span>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => {
          const isDone = row.isCompleted;
          const previous = placeholderSet(previousSets, row.setNumber);

          return (
            <div
              key={row.key}
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
                  aria-label={`Set ${row.setNumber} weight in kilos`}
                  placeholder={previous?.weight != null ? String(previous.weight) : "—"}
                  value={row.weight}
                  disabled={isDone}
                  onChange={(e) => onUpdate(idx, "weight", e.target.value)}
                  className="w-full bg-[#121214] border border-white/[0.06] rounded-xl py-2 text-center font-mono text-[15px] font-medium text-white outline-none placeholder:text-[#71717a] focus:border-[#baa3d0] disabled:opacity-40"
                />
              )}

              <input
                type="number"
                inputMode="numeric"
                aria-label={
                  tracking === "hold"
                    ? `Set ${row.setNumber} seconds`
                    : `Set ${row.setNumber} reps`
                }
                placeholder={
                  tracking === "hold"
                    ? previous?.durationSeconds != null
                      ? String(previous.durationSeconds)
                      : "—"
                    : previous
                      ? String(previous.reps)
                      : "—"
                }
                value={tracking === "hold" ? row.duration : row.reps}
                disabled={isDone}
                onChange={(e) =>
                  onUpdate(idx, tracking === "hold" ? "duration" : "reps", e.target.value)
                }
                className="w-full bg-[#121214] border border-white/[0.06] rounded-xl py-2 text-center font-mono text-[15px] font-medium text-white outline-none placeholder:text-[#71717a] focus:border-[#baa3d0] disabled:opacity-40"
              />

              <div className="flex items-center gap-1">
                {isDone && (
                  <button
                    type="button"
                    aria-label={`Delete set ${row.setNumber}`}
                    onClick={() => onDelete(idx)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[#71717a] hover:text-red-300 apple-press"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={isDone}
                  aria-label={isDone ? `Set ${row.setNumber} checked off` : `Check off set ${row.setNumber}`}
                  onClick={() => onToggle(idx)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition apple-press ${
                    isDone
                      ? "bg-[#baa3d0] text-[#141416]"
                      : "border border-white/20 text-transparent hover:border-[#baa3d0] hover:text-[#baa3d0]"
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={onAddSet}
          className="flex-1 border border-white/[0.08] rounded-full py-2.5 flex items-center justify-center gap-1.5 text-[#a1a1aa] apple-press"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[12px] font-semibold tracking-[0.14em] uppercase">Add set</span>
        </button>
      </div>
      <p className="px-1 text-[11px] text-[#71717a]">
        Tip: uncheck a set to edit it, or delete it with the trash icon.
      </p>
    </section>
  );
});
