/** Whole seconds elapsed between two performance.now() timestamps. */
export function holdElapsedSeconds(startedAt: number, now: number) {
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/** Fractional seconds elapsed, for smooth progress. */
export function holdElapsedFraction(startedAt: number, now: number) {
  return Math.max(0, (now - startedAt) / 1000);
}

/** Auto-stop once the elapsed whole seconds reach the goal. */
export function reachedGoal(elapsedSeconds: number, goalSeconds: number | null) {
  return goalSeconds != null && goalSeconds > 0 && elapsedSeconds >= goalSeconds;
}

/** Progress 0..1 towards the goal (null when there is no goal). */
export function holdProgress(elapsedFraction: number, goalSeconds: number | null) {
  if (goalSeconds == null || goalSeconds <= 0) return null;
  return Math.min(1, Math.max(0, elapsedFraction / goalSeconds));
}

/** Review value clamped to a minimum of 0 whole seconds. */
export function clampReviewSeconds(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

/** Personal best across previous hold sets (null when none). */
export function holdPersonalBest(previous: { durationSeconds?: number | null }[] | undefined) {
  if (!previous?.length) return null;
  const best = Math.max(0, ...previous.map((set) => set.durationSeconds ?? 0));
  return best > 0 ? best : null;
}
