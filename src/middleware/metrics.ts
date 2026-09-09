import type { RequestHandler, Request } from 'express';

/**
 * Zero-dependency performance monitor.
 *
 * Design goals: negligible CPU and bounded memory. We keep only *aggregates*
 * per route (count, total, max, errors) — never an array of samples — so memory
 * is O(number of routes), not O(number of requests). Timing uses a single
 * `hrtime.bigint()` read at start and finish (a few nanoseconds each).
 */

interface RouteStat {
  count: number;
  totalNs: bigint;
  maxNs: bigint;
  errors: number; // responses with status >= 500
  slow: number; // responses slower than SLOW_MS
}

const SLOW_MS = Number(process.env.SLOW_REQUEST_MS ?? 500);
const MAX_ROUTES = 64; // cap the map so path-scanning 404s can't grow it forever
const stats = new Map<string, RouteStat>();

/**
 * Stable, low-cardinality key. We use the full request path (sans query string),
 * which is consistent whether the request succeeded or fell through to the error
 * handler — unlike req.baseUrl/req.route, which aren't reliably set at `finish`
 * time on error paths. This API has no path params; if that changes, the
 * MAX_ROUTES cap below still bounds cardinality by spilling into an __other__
 * bucket, but you'd then want to switch to a route template here.
 */
function routeKey(req: Request): string {
  const path = req.originalUrl.split('?', 1)[0];
  const key = `${req.method} ${path}`;
  if (stats.has(key) || stats.size < MAX_ROUTES) return key;
  return `${req.method} __other__`;
}

export const metrics: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ns = process.hrtime.bigint() - start;
    const key = routeKey(req);
    let s = stats.get(key);
    if (!s) stats.set(key, (s = { count: 0, totalNs: 0n, maxNs: 0n, errors: 0, slow: 0 }));
    s.count++;
    s.totalNs += ns;
    if (ns > s.maxNs) s.maxNs = ns;
    if (res.statusCode >= 500) s.errors++;
    if (ns > BigInt(SLOW_MS) * 1_000_000n) {
      s.slow++;
      console.warn(`[slow] ${key} took ${(Number(ns) / 1e6).toFixed(1)}ms (status ${res.statusCode})`);
    }
  });
  next();
};

const ms = (ns: bigint) => Number(ns) / 1e6;

/** Snapshot for the /metrics endpoint — computed on read, not per request. */
export function snapshot() {
  const mem = process.memoryUsage();
  const routes = [...stats.entries()]
    .map(([route, s]) => ({
      route,
      count: s.count,
      avgMs: +(ms(s.totalNs) / s.count).toFixed(2),
      maxMs: +ms(s.maxNs).toFixed(2),
      slow: s.slow,
      errors: s.errors,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    uptimeSec: +process.uptime().toFixed(0),
    memory: {
      rssMb: +(mem.rss / 1048576).toFixed(1),
      heapUsedMb: +(mem.heapUsed / 1048576).toFixed(1),
    },
    slowThresholdMs: SLOW_MS,
    routes,
  };
}
