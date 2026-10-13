export const REST_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  CANCELLED: "cancelled",
  FAILED: "failed",
} as const;

export type RestStatus = (typeof REST_STATUS)[keyof typeof REST_STATUS];

/** Countdown from the stored end timestamp. Ceil so a started timer shows its full length. */
export function secondsRemaining(endTimestamp: number, now: number) {
  return Math.max(0, Math.ceil((endTimestamp - now) / 1000));
}

/** A row counts as sent only if at least one push succeeded. */
export function resolveRestStatus(sent: number): RestStatus {
  return sent > 0 ? REST_STATUS.SENT : REST_STATUS.FAILED;
}

/**
 * Morning reminder gate: send only when Amsterdam local time is 07:00,
 * and only if this user has not been sent today's reminder yet.
 */
export function shouldSendMorning(amsterdamHour: number, lastSentDate: string | null, todayKey: string) {
  if (amsterdamHour !== 7) return false;
  if (lastSentDate === todayKey) return false;
  return true;
}
