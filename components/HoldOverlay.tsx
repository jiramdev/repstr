"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Timer, X } from "lucide-react";
import {
  clampReviewSeconds,
  holdElapsedSeconds,
  reachedGoal,
} from "@/lib/hold-timer";

type Phase = "ready" | "holding" | "goal" | "review";

const READY_MS = 5000;
const GOAL_FLASH_MS = 1400;

function usePrefersReducedMotion() {
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

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    // iOS web apps cannot vibrate; never rely on it.
  }
}

export default function HoldOverlay({
  exerciseName,
  goalSeconds,
  personalBest,
  onSave,
  onDiscard,
}: {
  exerciseName: string;
  goalSeconds: number | null;
  personalBest: number | null;
  onSave: (seconds: number) => void;
  onDiscard: () => void;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("ready");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [readyLeft, setReadyLeft] = useState(Math.ceil(READY_MS / 1000));
  const [reviewValue, setReviewValue] = useState(0);
  const [passedPB, setPassedPB] = useState(false);
  const phaseRef = useRef<Phase>("ready");
  const readyStartRef = useRef(0);
  const holdStartRef = useRef(0);
  const passedPBRef = useRef(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  });

  const acquireWakeLock = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
        const lock = await (
          navigator as Navigator & { wakeLock: { request: (kind: string) => Promise<{ release: () => Promise<void> }> } }
        ).wakeLock.request("screen");
        wakeLockRef.current = lock;
      }
    } catch {
      // Unsupported or denied: the timer works without it.
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  const stopToReview = useCallback(
    (atMs: number) => {
      const seconds = holdElapsedSeconds(holdStartRef.current, atMs);
      vibrate(150);
      setReviewValue(seconds);
      setPhase("review");
    },
    []
  );

  const cancelAll = useCallback(() => {
    releaseWakeLock();
    onDiscard();
  }, [onDiscard, releaseWakeLock]);

  // Mount: wake lock + visibility handling. Backgrounding a hold goes to
  // review with the time so far; backgrounding the countdown cancels.
  useEffect(() => {
    readyStartRef.current = performance.now();
    holdStartRef.current = performance.now();
    void acquireWakeLock();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        releaseWakeLock();
        if (phaseRef.current === "holding") stopToReview(performance.now());
        else if (phaseRef.current === "ready") cancelAll();
      } else if (phaseRef.current === "holding") {
        void acquireWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      releaseWakeLock();
    };
  }, [acquireWakeLock, cancelAll, releaseWakeLock, stopToReview]);

  // Ready countdown + holding ticker, both derived from timestamps.
  // PB and goal transitions happen here (async tick), never in render.
  useEffect(() => {
    if (phase !== "ready" && phase !== "holding") return;
    const interval = window.setInterval(() => {
      const now = performance.now();
      if (phaseRef.current === "ready") {
        const left = Math.ceil((READY_MS - (now - readyStartRef.current)) / 1000);
        if (left <= 0) {
          holdStartRef.current = now;
          setElapsedMs(0);
          vibrate(200);
          setPhase("holding");
        } else {
          setReadyLeft(left);
        }
      } else if (phaseRef.current === "holding") {
        setElapsedMs(now - holdStartRef.current);
        const sec = holdElapsedSeconds(holdStartRef.current, now);
        if (personalBest != null && sec > personalBest && !passedPBRef.current) {
          passedPBRef.current = true;
          setPassedPB(true);
          vibrate(100);
        }
        if (reachedGoal(sec, goalSeconds)) {
          vibrate([150, 100, 300]);
          setPhase("goal");
        }
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [phase, goalSeconds, personalBest]);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const fraction = elapsedMs / 1000;

  // Goal flash, then review with the goal time.
  useEffect(() => {
    if (phase !== "goal") return;
    const timer = window.setTimeout(() => {
      setReviewValue(goalSeconds ?? elapsedSec);
      setPhase("review");
    }, GOAL_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [phase, goalSeconds, elapsedSec]);

  const atGoal = phase === "goal";
  const cardLavender = atGoal;
  const showPbFlash = passedPB && !atGoal && !reduceMotion;

  function handleCardClick(event: React.MouseEvent) {
    if ((event.target as HTMLElement).closest("button")) return;
    if (phaseRef.current === "holding") stopToReview(performance.now());
  }

  function handleClose() {
    if (phaseRef.current === "ready") cancelAll();
    else if (phaseRef.current === "holding") stopToReview(performance.now());
    else cancelAll();
  }

  const goalLabel = goalSeconds != null ? `GOAL ${goalSeconds} SEC` : null;
  const pbLabel = personalBest != null ? `PB ${personalBest} SEC` : null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-[#baa3d0] px-4 pt-4 flex flex-col"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Hold timer for ${exerciseName}`}
    >
      <div
        onClick={handleCardClick}
        className={`relative flex-1 w-full max-w-sm mx-auto rounded-[34px] border px-6 py-7 flex flex-col items-center justify-center text-center shadow-[0_24px_60px_rgba(0,0,0,0.55)] transition-colors ${
          cardLavender
            ? "bg-[#baa3d0] border-[#baa3d0]"
            : "bg-[#141416] border-white/[0.08]"
        } ${showPbFlash ? "animate-pulse" : ""}`}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close hold timer"
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center apple-press ${
            cardLavender ? "bg-black/10 text-[#141416]" : "bg-white/[0.06] text-[#a1a1aa]"
          }`}
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {phase === "ready" && (
          <>
            <p className="text-[12px] font-semibold tracking-[0.22em] text-[#baa3d0] uppercase">
              Get ready
            </p>
            <p
              className="mt-2 font-editorial leading-none tracking-tight text-white"
              style={{ fontSize: "38vh", lineHeight: 1 }}
            >
              {readyLeft}
            </p>
            <p className="mt-3 text-[12px] font-semibold tracking-[0.22em] text-[#a1a1aa] uppercase">
              {exerciseName}
            </p>
            {goalLabel && (
              <p className="mt-1 text-[12px] font-semibold tracking-[0.22em] text-[#baa3d0] uppercase">
                {goalLabel}
              </p>
            )}
          </>
        )}

        {(phase === "holding" || atGoal) && (
          <>
            <p className={`text-[12px] font-semibold tracking-[0.22em] uppercase ${cardLavender ? "text-[#141416]/70" : "text-[#baa3d0]"}`}>
              {atGoal ? "Goal" : "Holding"}
            </p>
            <p
              className={`mt-2 font-editorial leading-none tracking-tight ${cardLavender ? "text-[#141416]" : "text-white"}`}
              style={{ fontSize: "36vh", lineHeight: 1 }}
              aria-live="off"
            >
              {atGoal && goalSeconds != null ? goalSeconds : elapsedSec}
            </p>
            <div className="mt-3 flex items-center gap-3 text-[12px] font-semibold tracking-[0.22em] uppercase">
              {goalLabel && (
                <span className={cardLavender ? "text-[#141416]/70" : "text-[#baa3d0]"}>{goalLabel}</span>
              )}
              {pbLabel && (
                <span className={cardLavender ? "text-[#141416]/70" : "text-[#a1a1aa]"}>{pbLabel}</span>
              )}
            </div>
            {goalSeconds != null && (
              <div
                className={`mt-4 h-4 w-full rounded-full overflow-hidden ${cardLavender ? "bg-black/15" : "bg-white/10"}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={goalSeconds}
                aria-valuenow={Math.min(elapsedSec, goalSeconds)}
              >
                <div
                  className={`h-full rounded-full ${cardLavender ? "bg-[#141416]" : "bg-[#baa3d0]"}`}
                  style={{ width: `${Math.min(100, (fraction / goalSeconds) * 100)}%` }}
                />
              </div>
            )}
            {phase === "holding" && (
              <button
                type="button"
                onClick={() => stopToReview(performance.now())}
                className="mt-6 w-full bg-[#baa3d0] text-[#141416] rounded-full py-4 font-editorial text-[20px] tracking-wider apple-press"
              >
                STOP
              </button>
            )}
          </>
        )}

        {phase === "review" && (
          <>
            <p className="text-[12px] font-semibold tracking-[0.22em] text-[#baa3d0] uppercase">
              Time
            </p>
            <p
              className="mt-2 font-editorial leading-none tracking-tight text-white"
              style={{ fontSize: "24vh", lineHeight: 1 }}
            >
              {reviewValue}
              <span className="text-[18px] font-sans font-semibold tracking-[0.2em] text-[#a1a1aa]"> SEC</span>
            </p>
            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                aria-label="One second less"
                onClick={() => setReviewValue((v) => clampReviewSeconds(v - 1))}
                className="w-14 h-14 rounded-full bg-white/[0.06] text-white font-editorial text-[24px] apple-press"
              >
                −1
              </button>
              <button
                type="button"
                aria-label="One second more"
                onClick={() => setReviewValue((v) => clampReviewSeconds(v + 1))}
                className="w-14 h-14 rounded-full bg-white/[0.06] text-white font-editorial text-[24px] apple-press"
              >
                +1
              </button>
            </div>
            <div className="mt-5 w-full space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  releaseWakeLock();
                  onSave(reviewValue);
                }}
                className="w-full bg-[#baa3d0] text-[#141416] rounded-full py-4 font-editorial text-[20px] tracking-wider apple-press"
              >
                SAVE
              </button>
              <button
                type="button"
                onClick={cancelAll}
                className="w-full bg-white/[0.06] text-white rounded-full py-3.5 font-editorial text-[16px] tracking-wider apple-press"
              >
                DISCARD
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function HoldStartButton({ onStart }: { onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="flex items-center gap-1.5 border border-[#baa3d0]/60 text-[#baa3d0] rounded-full px-4 py-2.5 text-[12px] font-semibold tracking-[0.14em] uppercase apple-press shrink-0"
    >
      <Timer className="w-4 h-4" />
      Start hold
    </button>
  );
}
