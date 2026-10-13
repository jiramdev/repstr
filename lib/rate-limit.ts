import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const LOGIN_ATTEMPT_LIMIT = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const REGISTER_ATTEMPT_LIMIT = 3;
export const REGISTER_WINDOW_MS = 60 * 60 * 1000;

export const TOO_MANY_ATTEMPTS_NL = "Te veel pogingen. Probeer het later opnieuw.";

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
    if (process.env.NODE_ENV === "production") {
      console.error("Upstash Redis niet ingesteld; rate limit fail closed");
      return { limited: true };
    }
    const limited = isRateLimited(key, limit, windowMs);
    if (!limited) recordAttempt(key, windowMs);
    return { limited };
  }
  try {
    const result = await active.limit(key);
    return { limited: !result.success };
  } catch (error) {
    console.error("Rate limit controle mislukt:", error);
    if (process.env.NODE_ENV === "production") return { limited: true };
    const limited = isRateLimited(key, limit, windowMs);
    if (!limited) recordAttempt(key, windowMs);
    return { limited };
  }
}

/** Sign-in: 5 attempts per 15 minutes, enforced per email AND per IP. */
export async function limitSignIn(email: string, ip: string): Promise<LimitDecision> {
  const byEmail = await checkRateLimit(`signin:email:${email}`, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS);
  if (byEmail.limited) return byEmail;
  return checkRateLimit(`signin:ip:${ip}`, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS);
}

/** Sign-up: 3 attempts per hour per IP. */
export async function limitSignUp(ip: string): Promise<LimitDecision> {
  return checkRateLimit(`signup:ip:${ip}`, REGISTER_ATTEMPT_LIMIT, REGISTER_WINDOW_MS);
}
