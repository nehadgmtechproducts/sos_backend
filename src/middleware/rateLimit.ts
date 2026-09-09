import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '../config/env.js';

// REST-based (no persistent connection needed), so it's safe to construct at
// module scope and reused across warm serverless invocations.
const redis = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
  : null;

if (!redis) {
  console.warn(
    '[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set — falling back to in-memory rate limiting. ' +
    'On serverless (Vercel), this is enforced per-instance, not globally, so real limits are weaker ' +
    'than configured. Fine for local dev; set both before going live on serverless.',
  );
}

export interface IpRateLimitOptions {
  windowMs: number;
  limit: number;
  message: string;
  /** Unique per limiter so two limiters' counters never collide in shared Redis. */
  keyPrefix: string;
}

/**
 * IP-keyed rate limiter with ONE response contract regardless of backend:
 * 429 with { error: { code: 'RATE_LIMITED', message } } — matches what the
 * client already handles, so which store is active is invisible to callers.
 */
export function createIpRateLimiter(opts: IpRateLimitOptions): RequestHandler {
  if (redis) {
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(opts.limit, `${opts.windowMs} ms`),
      prefix: opts.keyPrefix,
    });
    return async (req, res, next) => {
      try {
        // Bound the worst case explicitly: an unreachable/slow Upstash endpoint
        // should add ~1s, not the multi-second DNS/TCP timeout chain a hung
        // fetch can otherwise take before this falls through to fail open.
        const { success, limit, remaining, reset } = await Promise.race([
          ratelimit.limit(req.ip ?? 'unknown'),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('rate limit check timed out')), 1000)),
        ]);
        res.setHeader('RateLimit-Limit', String(limit));
        res.setHeader('RateLimit-Remaining', String(remaining));
        res.setHeader('RateLimit-Reset', String(Math.max(0, Math.ceil((reset - Date.now()) / 1000))));
        if (!success) {
          return res.status(429).json({ error: { code: 'RATE_LIMITED', message: opts.message } });
        }
        next();
      } catch (error) {
        // Redis being unreachable or slow must not take the whole API down
        // with it — fail open and let the request through.
        console.error('[rateLimit] Upstash request failed, allowing request through:', error);
        next();
      }
    };
  }

  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: opts.message } },
  });
}
