import { requireAuth } from '../middleware/auth.js';
import { revokeAccessToken } from '../services/token.service.js';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateBody } from '../middleware/validate.js';
import {
  postRequestOtp,
  postVerifyOtp,
  requestOtpSchema,
  verifyOtpSchema,
} from '../controllers/auth.controller.js';

/** Per-IP ceiling on top of the per-phone cooldown inside the service. */
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' } },
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
