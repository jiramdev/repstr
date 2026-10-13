import { describe, expect, it } from "vitest";
import {
  REST_STATUS,
  resolveRestStatus,
  secondsRemaining,
  shouldSendMorning,
} from "@/lib/notifications";

describe("secondsRemaining", () => {
  it("computes the countdown from the stored end timestamp", () => {
    const end = 1_000_000 + 90_000;
    expect(secondsRemaining(end, 1_000_000)).toBe(90);
    expect(secondsRemaining(end, 1_000_000 + 1_000)).toBe(89);
    expect(secondsRemaining(end, 1_000_000 + 89_500)).toBe(1);
  });

  it("never shows one second too many and never goes negative", () => {
    const end = 5_000_000;
    expect(secondsRemaining(end, end)).toBe(0);
    expect(secondsRemaining(end, end + 10_000)).toBe(0);
    // Just after a 90s timer starts the diff is a hair under 90s: still shows 90, never 91.
    expect(secondsRemaining(end, end - 90_000 + 5)).toBe(90);
    expect(secondsRemaining(end, end - 90_000)).toBe(90);
  });
});

describe("resolveRestStatus", () => {
  it("marks sent only when at least one push succeeded", () => {
    expect(resolveRestStatus(1)).toBe(REST_STATUS.SENT);
    expect(resolveRestStatus(3)).toBe(REST_STATUS.SENT);
    expect(resolveRestStatus(0)).toBe(REST_STATUS.FAILED);
  });
});

describe("shouldSendMorning", () => {
  it("sends only at 07:00 Amsterdam time", () => {
    expect(shouldSendMorning(7, null, "2026-10-13")).toBe(true);
    expect(shouldSendMorning(6, null, "2026-10-13")).toBe(false);
    expect(shouldSendMorning(8, null, "2026-10-13")).toBe(false);
  });

  it("sends each user exactly once per day", () => {
    expect(shouldSendMorning(7, "2026-10-13", "2026-10-13")).toBe(false);
    expect(shouldSendMorning(7, "2026-10-12", "2026-10-13")).toBe(true);
  });
});
