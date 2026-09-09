import { requireAuth } from '../middleware/auth.js';
import { revokeAccessToken } from '../services/token.service.js';
import { Router } from 'express';
import { createIpRateLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import {
  postRequestOtp,
  postVerifyOtp,
  requestOtpSchema,
  verifyOtpSchema,
} from '../controllers/auth.controller.js';

/** Per-IP ceiling on top of the per-phone cooldown inside the service. */
const otpRequestLimiter = createIpRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many requests. Please try again later.',
  keyPrefix: 'otp-request',
});

const otpVerifyLimiter = createIpRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many attempts. Please try again later.',
  keyPrefix: 'otp-verify',
});

const router = Router();

router.post('/otp/request', otpRequestLimiter, validateBody(requestOtpSchema), postRequestOtp);
router.post('/otp/verify', otpVerifyLimiter, validateBody(verifyOtpSchema), postVerifyOtp);

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await revokeAccessToken(req.get('authorization')!.slice(7));
    res.status(204).send();
  } catch (error) { next(error); }
});

export default router;
