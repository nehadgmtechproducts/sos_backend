import type { RequestHandler } from 'express';
import { z } from 'zod';
import { normalisePhone, maskPhone } from '../utils/phone.js';
import { requestOtp, verifyOtp } from '../services/otp.service.js';
import { issueAccessToken } from '../services/token.service.js';

export const requestOtpSchema = z.object({
  phone: z.string().min(6, 'Please enter a valid mobile number.').max(20, 'Please enter a valid mobile number.'),
  fcmToken: z.string().min(20, 'Invalid Firebase device token.').max(4096, 'Invalid Firebase device token.').optional(),
});

export const verifyOtpSchema = z.object({
  requestId: z.string().uuid('Invalid verification request.'),
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

/** POST /api/v1/auth/otp/request  — screen 1: user enters their mobile number. */
export const postRequestOtp: RequestHandler = async (req, res, next) => {
  try {
    const phone = normalisePhone(req.body.phone);
    const result = await requestOtp(phone, req.body.fcmToken);
    res.status(201).json({ ...result, phone: maskPhone(phone) });
  } catch (err) {
    next(err);
  }
};

/** POST /api/v1/auth/otp/verify — screen 2: user enters the 6-digit code. */
export const postVerifyOtp: RequestHandler = async (req, res, next) => {
  try {
    const { user, isNewUser } = await verifyOtp(req.body.requestId, req.body.otp);
    res.status(200).json({
      accessToken: issueAccessToken(user),
      isNewUser,
      user: { id: user.id, phone: user.phone, profileComplete: user.profileComplete },
    });
  } catch (err) {
    next(err);
  }
};
