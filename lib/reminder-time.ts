export const DEFAULT_REMINDER_TIME = "07:00";
export const DEFAULT_TIMEZONE = "Europe/Amsterdam";

const TIME_RE = /^(?:[01]\d|2[0-3]):[05]\d$/;

export function isValidReminderTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

export function normalizeReminderTime(value: string | null | undefined) {
  return isValidReminderTime(value) ? value : DEFAULT_REMINDER_TIME;
}

export function normalizeTimezone(value: string | null | undefined) {
  if (typeof value !== "string" || !value) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function zonedParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function tzOffsetMs(timeZone: string, date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

/** Resolve a wall-clock time in a timezone to an instant. Iteration absorbs DST gaps. */
function zonedTimeToUtc(timeZone: string, year: number, month: number, day: number, hour: number, minute: number) {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 3; i++) {
    guess = Date.UTC(year, month - 1, day, hour, minute) - tzOffsetMs(timeZone, new Date(guess));
  }
  return new Date(guess);
}

/**
 * Next occurrence of a daily HH:MM wall time in the given timezone.
 * "Tomorrow" is calendar-based in that zone, so DST transitions (23/25-hour
 * days) still yield exactly one run per local day.
 */
export function nextDailyOccurrence(now: Date, timeHHMM: string, timeZone: string) {
  const time = normalizeReminderTime(timeHHMM);
  const zone = normalizeTimezone(timeZone);
  const [hour, minute] = time.split(":").map(Number);
  const today = zonedParts(now, zone);
  let candidate = zonedTimeToUtc(zone, today.year, today.month, today.day, hour, minute);
  if (candidate.getTime() <= now.getTime()) {
    const tomorrowUtc = new Date(Date.UTC(today.year, today.month - 1, today.day, 12) + 86400000);
    candidate = zonedTimeToUtc(
      zone,
      tomorrowUtc.getUTCFullYear(),
      tomorrowUtc.getUTCMonth() + 1,
      tomorrowUtc.getUTCDate(),
      hour,
      minute
    );
  }
  return candidate;
}

/** Once-per-day gate: a user gets at most one reminder per local date key. */
export function isAlreadySentToday(lastSentDate: string | null, todayKey: string) {
  return lastSentDate === todayKey;
}

/** Amsterdam-style YYYY-MM-DD key of an instant in a timezone. */
export function zonedDateKey(date: Date, timeZone: string) {
  const { year, month, day } = zonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day of week (0 = Sunday) of an instant in a timezone. */
export function zonedDayOfWeek(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return WEEKDAYS.indexOf(parts);
}
