import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedPushEndpoint } from "@/lib/push";

describe("isAllowedPushEndpoint", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllEnvs();
  });

  it("accepts known push service hosts", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://xyz.push.apple.com/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v1/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2.notify.windows.com/?token=abc")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isAllowedPushEndpoint("https://example.com/push")).toBe(false);
    expect(isAllowedPushEndpoint("https://push.apple.com.evil.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://evilpush.apple.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isAllowedPushEndpoint("not-a-url")).toBe(false);
    expect(isAllowedPushEndpoint("")).toBe(false);
  });

  it("rejects localhost unless the test hatch is set", () => {
    expect(isAllowedPushEndpoint("https://localhost:3220/fake-push/e2e")).toBe(false);
    vi.stubEnv("ALLOW_MEMORY_RATELIMIT", "1");
    expect(isAllowedPushEndpoint("https://localhost:3220/fake-push/e2e")).toBe(true);
    expect(isAllowedPushEndpoint("https://127.0.0.1:3220/fake-push/e2e")).toBe(true);
    expect(isAllowedPushEndpoint("https://example.com/x")).toBe(false);
  });
});
