/**
 * Shared rate limiter for public Bayaan Hub money routes.
 *
 * Production uses Upstash Redis over REST when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are configured. Local development falls back to an
 * in-memory bucket so tests and preview branches keep working.
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
  retryAfterSeconds?: number;
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/**
 * Checks and increments a rate-limit bucket.
 *
 * @param key      Identifier for the bucket (e.g. client IP + route name).
 * @param max      Maximum requests allowed in the window.
 * @param windowMs Window length in milliseconds.
 */
function hasUpstashConfig(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL!.replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  const redisKey = `rate:${key}`;
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  const response = await fetch(`${baseUrl}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['EXPIRE', redisKey, ttlSeconds, 'NX'],
      ['TTL', redisKey],
    ]),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Upstash rate-limit request failed: ${response.status}`);
  }

  const results = (await response.json()) as Array<{ result?: unknown; error?: string }>;
  const count = Number(results[0]?.result ?? 0);
  const ttl = Math.max(1, Number(results[2]?.result ?? ttlSeconds));
  const resetAt = Date.now() + ttl * 1000;

  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    resetAt,
  };
}

function inMemoryRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
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

export async function rateLimit(
  key: string,
  maxOrOptions: number | RateLimitOptions,
  maybeWindowMs?: number,
): Promise<RateLimitResult> {
  const max = typeof maxOrOptions === 'number' ? maxOrOptions : maxOrOptions.limit;
  const windowMs =
    typeof maxOrOptions === 'number' ? (maybeWindowMs ?? 60_000) : maxOrOptions.windowMs;
  const withRetryAfter = (result: RateLimitResult): RateLimitResult => ({
    ...result,
    retryAfterSeconds: Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
  });

  if (hasUpstashConfig()) {
    try {
      return withRetryAfter(await upstashRateLimit(key, max, windowMs));
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[rate-limit] shared limiter unavailable; failing closed', {
          key,
          error: error instanceof Error ? error.message : error,
        });
        return withRetryAfter({ allowed: false, remaining: 0, resetAt: Date.now() + windowMs });
      }
      console.warn('[rate-limit] shared limiter unavailable; using local fallback', {
        key,
        error: error instanceof Error ? error.message : error,
      });
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN missing; failing closed', {
      key,
    });
    return withRetryAfter({ allowed: false, remaining: 0, resetAt: Date.now() + windowMs });
  }

  return withRetryAfter(inMemoryRateLimit(key, max, windowMs));
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
