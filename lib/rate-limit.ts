import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const LOGIN_ATTEMPT_LIMIT = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const REGISTER_ATTEMPT_LIMIT = 3;
export const REGISTER_WINDOW_MS = 60 * 60 * 1000;

export const TOO_MANY_ATTEMPTS_MESSAGE = "Too many attempts, try again later.";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function bucketFor(key: string, windowMs: number, now: number) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const created = { count: 0, resetAt: now + windowMs };
    buckets.set(key, created);
    return created;
  }
  return current;
}

/** Synchronous in-memory check, kept for unit tests and non-production fallback. */
export function isRateLimited(key: string, limit: number, windowMs: number, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) return false;
  return current.count >= limit;
}

/** Synchronous in-memory attempt, kept for unit tests and non-production fallback. */
export function recordAttempt(key: string, windowMs: number, now = Date.now()) {
  const current = bucketFor(key, windowMs, now);
  current.count += 1;
  if (buckets.size > 5000) {
    for (const [stored, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(stored);
    }
  }
}

export function clientIp(headerStore: { get(name: string): string | null }) {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerStore.get("x-real-ip")?.trim() || "unknown";
}

function redisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const limiterCache = new Map<string, Ratelimit>();

function limiter(limit: number, windowMs: number) {
  const redis = redisClient();
  if (!redis) return null;
  const cacheKey = `${limit}:${windowMs}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;
  const created = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
  });
  limiterCache.set(cacheKey, created);
  return created;
}

export type LimitDecision = { limited: boolean };

type Backend =
  | { kind: "upstash"; limiter: Ratelimit }
  | { kind: "memory" }
  | { kind: "closed" };

function resolveBackend(limit: number, windowMs: number): Backend {
  const active = limiter(limit, windowMs);
  if (active) return { kind: "upstash", limiter: active };
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_RATELIMIT !== "1") {
    console.error("Upstash Redis missing; rate limit fail closed");
    return { kind: "closed" };
  }
  if (process.env.NODE_ENV === "production") {
    console.warn("Rate limit falling back to memory (ALLOW_MEMORY_RATELIMIT, tests only)");
  }
  return { kind: "memory" };
}

async function upstashRemaining(
  active: Ratelimit,
  key: string
): Promise<number | null> {
  try {
    const { remaining } = await active.getRemaining(key);
    return remaining;
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return null;
  }
}

/**
 * Distributed rate-limit check. Uses Upstash when configured.
 * Missing Upstash vars: fail closed in production, in-memory fallback elsewhere.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<LimitDecision> {
  const active = limiter(limit, windowMs);
  if (!active) {
    // Test-only escape hatch for local e2e runs (never set in production).
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MEMORY_RATELIMIT !== "1") {
      console.error("Upstash Redis niet ingesteld; rate limit fail closed");
      return { limited: true };
    }
    if (process.env.NODE_ENV === "production") {
      console.warn("Rate limit falling back to memory (ALLOW_MEMORY_RATELIMIT, tests only)");
    }
    const limited = isRateLimited(key, limit, windowMs);
    if (!limited) recordAttempt(key, windowMs);
    return { limited };
  }
  try {
    const result = await active.limit(key);
    return { limited: !result.success };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    if (process.env.NODE_ENV === "production") return { limited: true };
    const limited = isRateLimited(key, limit, windowMs);
    if (!limited) recordAttempt(key, windowMs);
    return { limited };
  }
}

/**
 * Read-only sign-in check: reports whether the email or IP is out of
 * attempts WITHOUT consuming one. Used before verifying credentials.
 */
export async function peekSignIn(email: string, ip: string): Promise<LimitDecision> {
  const emailKey = `signin:email:${email}`;
  const ipKey = `signin:ip:${ip}`;
  const backend = resolveBackend(LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS);
  if (backend.kind === "closed") return { limited: true };
  if (backend.kind === "upstash") {
    const [emailRemaining, ipRemaining] = await Promise.all([
      upstashRemaining(backend.limiter, emailKey),
      upstashRemaining(backend.limiter, ipKey),
    ]);
    if (emailRemaining == null || ipRemaining == null) {
      if (process.env.NODE_ENV === "production") return { limited: true };
    } else {
      return { limited: emailRemaining <= 0 || ipRemaining <= 0 };
    }
  }
  return {
    limited:
      isRateLimited(emailKey, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS) ||
      isRateLimited(ipKey, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS),
  };
}

/**
 * Record one FAILED sign-in against both the email and the IP key.
 * Successful sign-ins never call this, so they use up no attempts.
 */
export async function consumeSignInFailure(email: string, ip: string): Promise<void> {
  const emailKey = `signin:email:${email}`;
  const ipKey = `signin:ip:${ip}`;
  const backend = resolveBackend(LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS);
  if (backend.kind === "closed") return;
  if (backend.kind === "upstash") {
    const results = await Promise.allSettled([
      backend.limiter.limit(emailKey),
      backend.limiter.limit(ipKey),
    ]);
    if (results.some((result) => result.status === "rejected")) {
      console.error("Rate limit consume failed");
      if (process.env.NODE_ENV !== "production" || process.env.ALLOW_MEMORY_RATELIMIT === "1") {
        recordAttempt(emailKey, LOGIN_WINDOW_MS);
        recordAttempt(ipKey, LOGIN_WINDOW_MS);
      }
    }
    return;
  }
  recordAttempt(emailKey, LOGIN_WINDOW_MS);
  recordAttempt(ipKey, LOGIN_WINDOW_MS);
}

/** Sign-up: 3 attempts per hour per IP. */
export async function limitSignUp(ip: string): Promise<LimitDecision> {
  return checkRateLimit(`signup:ip:${ip}`, REGISTER_ATTEMPT_LIMIT, REGISTER_WINDOW_MS);
}
