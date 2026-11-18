/**
 * Tiny in-memory rate limiter (per server process).
 *
 * Good enough for a single-instance storefront: stops order spam (each
 * placement costs SMS credit) and slows admin-login brute force. Keys are
 * arbitrary strings — typically `${scope}:${ip}`.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Keep the map from growing without bound: sweep expired entries now and then. */
function sweep(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * Count one hit against `key`. Returns { ok: false } once `limit` hits
 * inside a rolling `windowMs` have been used.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

/**
 * Best-effort client IP for rate-limit keys. Behind the gateway/proxy the
 * forwarded header carries the real visitor IP; fall back to a shared bucket
 * so unknowns are still limited collectively.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim();
  if (ip) return ip;
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
