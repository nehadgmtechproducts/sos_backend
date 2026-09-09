import type { RequestHandler } from 'express';

/**
 * Auth/OTP responses carry one-time codes and JWTs — they must never be stored
 * by a browser, shared proxy, or CDN. `no-store` is the strongest directive:
 * the response is not written to any cache at all. `Pragma`/`Expires` cover
 * legacy HTTP/1.0 intermediaries. Set once here so no handler can forget it.
 */
export const noStore: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};
