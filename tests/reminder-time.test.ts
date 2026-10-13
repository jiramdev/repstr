import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER_TIME,
  DEFAULT_TIMEZONE,
  isAlreadySentToday,
  nextDailyOccurrence,
  normalizeReminderTime,
  normalizeTimezone,
  zonedDateKey,
} from "@/lib/reminder-time";

describe("nextDailyOccurrence", () => {
  it("schedules later today when the time is still ahead (winter, CET)", () => {
    // 2026-01-10 06:00 Amsterdam = 05:00Z; 07:00 is still ahead.
    const next = nextDailyOccurrence(new Date("2026-01-10T05:00:00.000Z"), "07:00", "Europe/Amsterdam");
    expect(next.toISOString()).toBe("2026-01-10T06:00:00.000Z");
  });

  it("schedules tomorrow when today's time passed", () => {
    // 2026-01-10 08:00 Amsterdam = 07:00Z.
    const next = nextDailyOccurrence(new Date("2026-01-10T07:00:00.000Z"), "07:00", "Europe/Amsterdam");
    expect(next.toISOString()).toBe("2026-01-11T06:00:00.000Z");
  });

  it("hits 07:00 Amsterdam across the spring-forward DST change", () => {
    // DST starts 2026-03-29 02:00 -> 03:00 (CET -> CEST).
    // Saturday 2026-03-28 noon UTC: next 07:00 local is Sunday 07:00 CEST = 05:00Z.
    const next = nextDailyOccurrence(new Date("2026-03-28T12:00:00.000Z"), "07:00", "Europe/Amsterdam");
    expect(next.toISOString()).toBe("2026-03-29T05:00:00.000Z");
    // Sunday after the change: next is Monday 07:00 CEST = 05:00Z (23-hour day handled).
    const after = nextDailyOccurrence(new Date("2026-03-29T12:00:00.000Z"), "07:00", "Europe/Amsterdam");
    expect(after.toISOString()).toBe("2026-03-30T05:00:00.000Z");
  });

  it("hits 07:00 Amsterdam across the fall-back DST change", () => {
    // DST ends 2026-10-25 03:00 -> 02:00 (CEST -> CET, 25-hour day).
    // 07:00 that day is after the fallback, so CET: 06:00Z.
    const next = nextDailyOccurrence(new Date("2026-10-24T12:00:00.000Z"), "07:00", "Europe/Amsterdam");
    expect(next.toISOString()).toBe("2026-10-25T06:00:00.000Z");
    const after = nextDailyOccurrence(new Date("2026-10-25T12:00:00.000Z"), "07:00", "Europe/Amsterdam");
    expect(after.toISOString()).toBe("2026-10-26T06:00:00.000Z");
  });

  it("respects other timezones", () => {
    // 12:00Z = 07:00 in New York (EST, UTC-5) in January.
    const next = nextDailyOccurrence(new Date("2026-01-10T12:00:00.000Z"), "07:00", "America/New_York");
    expect(next.toISOString()).toBe("2026-01-11T12:00:00.000Z");
  });

  it("falls back to defaults for invalid input", () => {
    expect(normalizeReminderTime("25:00")).toBe(DEFAULT_REMINDER_TIME);
    expect(normalizeReminderTime(null)).toBe(DEFAULT_REMINDER_TIME);
    expect(normalizeReminderTime("07:05")).toBe("07:05");
    expect(normalizeTimezone("Mars/Olympus")).toBe(DEFAULT_TIMEZONE);
    expect(normalizeTimezone(null)).toBe(DEFAULT_TIMEZONE);
    const next = nextDailyOccurrence(new Date("2026-01-10T05:00:00.000Z"), "bogus", "bogus");
    expect(next.toISOString()).toBe("2026-01-10T06:00:00.000Z");
  });
});

describe("once per day", () => {
  it("sends at most once per local date", () => {
    expect(isAlreadySentToday("2026-10-13", "2026-10-13")).toBe(true);
    expect(isAlreadySentToday("2026-10-12", "2026-10-13")).toBe(false);
    expect(isAlreadySentToday(null, "2026-10-13")).toBe(false);
  });

  it("keys dates in the user's timezone", () => {
    // 2026-10-13 23:30Z is already 2026-10-14 in Amsterdam (CEST).
    expect(zonedDateKey(new Date("2026-10-13T23:30:00.000Z"), "Europe/Amsterdam")).toBe("2026-10-14");
    expect(zonedDateKey(new Date("2026-10-13T23:30:00.000Z"), "America/New_York")).toBe("2026-10-13");
  });
});
