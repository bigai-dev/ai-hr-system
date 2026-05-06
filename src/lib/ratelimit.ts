import { turso } from './turso';
import { log } from './log';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Sliding-window rate limit backed by Turso. Suitable for low-volume public
 * endpoints (apply form, screening). For high-throughput rate limiting, swap
 * to Upstash Redis.
 *
 * Best-effort, not strictly atomic — under heavy concurrency a small number of
 * extra requests may slip through. Acceptable for hiring-form volume.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = nowSec - windowSeconds;

  try {
    const countResult = await turso.execute({
      sql: 'SELECT COUNT(*) as c FROM rate_limit_events WHERE key = ? AND ts > ?',
      args: [key, windowStart],
    });
    const count = Number((countResult.rows[0] as Record<string, unknown>).c ?? 0);

    if (count >= max) {
      const oldestResult = await turso.execute({
        sql: 'SELECT MIN(ts) as oldest FROM rate_limit_events WHERE key = ? AND ts > ?',
        args: [key, windowStart],
      });
      const oldest = Number((oldestResult.rows[0] as Record<string, unknown>).oldest ?? nowSec);
      const retryAfter = Math.max(1, oldest + windowSeconds - nowSec);
      return { allowed: false, remaining: 0, retryAfterSeconds: retryAfter };
    }

    await turso.execute({
      sql: 'INSERT INTO rate_limit_events (key, ts) VALUES (?, ?)',
      args: [key, nowSec],
    });

    if (Math.random() < 0.05) {
      await turso
        .execute({
          sql: 'DELETE FROM rate_limit_events WHERE ts < ?',
          args: [nowSec - 60 * 60 * 24 * 2],
        })
        .catch(() => undefined);
    }

    return { allowed: true, remaining: max - count - 1, retryAfterSeconds: 0 };
  } catch (e) {
    log.error('rate_limit_check_failed', { key, error: e instanceof Error ? e.message : 'unknown' });
    return { allowed: true, remaining: max, retryAfterSeconds: 0 };
  }
}

export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}
