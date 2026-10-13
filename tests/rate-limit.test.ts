import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TOO_MANY_ATTEMPTS_MESSAGE,
  checkRateLimit,
  consumeSignInFailure,
  isRateLimited,
  limitSignUp,
  peekSignIn,
  recordAttempt,
} from "@/lib/rate-limit";

describe("rate limit", () => {
  it("blocks a key after the configured number of attempts", () => {
    const key = `test:${Math.random()}`;
    const now = 1_000_000;
    expect(isRateLimited(key, 3, 1000, now)).toBe(false);
    recordAttempt(key, 1000, now);
    recordAttempt(key, 1000, now);
    recordAttempt(key, 1000, now);
    expect(isRateLimited(key, 3, 1000, now)).toBe(true);
    expect(isRateLimited(key, 3, 1000, now + 1000)).toBe(false);
  });
});

describe("upstash rate limit fallback", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllEnvs();
  });

  it("peeks without consuming: 5 failures then limited per email", async () => {
    const email = `user-${Math.random()}@example.com`;
    for (let i = 0; i < 5; i++) {
      expect((await peekSignIn(email, `10.0.0.${i}`)).limited).toBe(false);
      await consumeSignInFailure(email, `10.0.0.${i}`);
    }
    expect((await peekSignIn(email, "10.0.0.99")).limited).toBe(true);
  });

  it("peeking alone never locks anyone out", async () => {
    const email = `peek-${Math.random()}@example.com`;
    for (let i = 0; i < 10; i++) {
      expect((await peekSignIn(email, "10.1.2.3")).limited).toBe(false);
    }
  });

  it("limits sign-in per IP as well", async () => {
    const ip = `10.9.9.${Math.floor(Math.random() * 100000)}`;
    for (let i = 0; i < 5; i++) {
      expect((await peekSignIn(`other-${Math.random()}-${i}@example.com`, ip)).limited).toBe(false);
      await consumeSignInFailure(`ipuser-${Math.random()}-${i}@example.com`, ip);
    }
    // Same IP, fresh email: still limited because the IP key is exhausted.
    expect((await peekSignIn("fresh@example.com", ip)).limited).toBe(true);
  });

  it("limits sign-up after 3 attempts per IP without Upstash configured", async () => {
    const ip = `192.0.2.${Math.floor(Math.random() * 100000)}`;
    for (let i = 0; i < 3; i++) {
      expect((await limitSignUp(ip)).limited).toBe(false);
    }
    expect((await limitSignUp(ip)).limited).toBe(true);
  });

  it("fails closed in production when Upstash vars are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect((await checkRateLimit(`closed:${Math.random()}`, 5, 60000)).limited).toBe(true);
  });

  it("uses the too-many-attempts message", () => {
    expect(TOO_MANY_ATTEMPTS_MESSAGE).toBe("Too many attempts, try again later.");
  });
});
