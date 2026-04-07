/**
 * Lightweight in-memory rate limiter for Phase 1 Bayaan Hub donation routes.
 *
 * WHY in-memory: Phase 1 runs on a single Next.js instance (or preview) and
 * the only goal is keeping an anonymous donor route from spamming Pay.nl.
 * Upstash/Redis is deferred to production rollout (see plan "out of scope").
 *
 * WHY NOT more complex: anything fancier than a sliding counter is out of
 * scope for a pre-Alliance sandbox. Multi-instance / edge-runtime support
 * is a Phase 2 concern once the donation traffic pattern is known.
 *
 * Limit is per "bucket key" (typically the client IP). If the same IP makes
 * more than `max` requests within `windowMs`, further requests are rejected
 * until the window rolls over.
 */

interface BucketState {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, BucketState>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Checks and increments a rate-limit bucket.
 *
 * @param key      Identifier for the bucket (e.g. client IP + route name).
 * @param max      Maximum requests allowed in the window.
 * @param windowMs Window length in milliseconds.
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: max - 1, resetAt };
  }

  if (existing.count >= max) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: max - existing.count, resetAt: existing.resetAt };
}

/** Best-effort client IP extraction from Next.js request headers. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; first entry is the client.
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-real-ip') || '0.0.0.0';
}

/** Test-only: clear all buckets between test cases. */
export function __resetRateLimitBucketsForTests(): void {
  buckets.clear();
}
