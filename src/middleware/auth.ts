import type { RequestHandler } from 'express';
import { isAccessTokenRevoked, verifyAccessToken } from '../services/token.service.js';
import { unauthorized } from '../utils/errors.js';

declare global {
  namespace Express {
    interface Request { auth?: { userId: string; phone: string } }
  }
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get('authorization');
  if (!header?.startsWith('Bearer ')) return next(unauthorized('AUTH_REQUIRED', 'A bearer access token is required.'));
  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    return next(unauthorized('INVALID_TOKEN', 'Your access token is invalid or has expired.'));
  }
  try {
    if (await isAccessTokenRevoked(header.slice(7))) {
      return next(unauthorized('INVALID_TOKEN', 'Your session has ended. Please sign in again.'));
    }
    req.auth = { userId: payload.sub, phone: payload.phone };
    next();
  } catch (error) {
    next(error);
  }
};
