import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { challengeStore, userStore } from '../store/database.store.js';
import { badRequest, tooManyRequests, unauthorized } from '../utils/errors.js';
import { otpMessage, sms, exposeOtpInResponse } from './sms.service.js';
import { sendOtpPush } from './firebase.service.js';

const generateOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** OTPs are never stored in the clear — only an HMAC of them. */
const hashOtp = (otp: string, salt: string) =>
  createHmac('sha256', env.OTP_PEPPER).update(`${salt}:${otp}`).digest('hex');

const safeEqual = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

export async function requestOtp(phone: string, fcmToken?: string) {
  const lastSent = await challengeStore.lastSentAt(phone);
  if (lastSent) {
    const waited = (Date.now() - lastSent) / 1000;
    if (waited < env.OTP_RESEND_COOLDOWN_SECONDS) {
      throw tooManyRequests(
        'RESEND_TOO_SOON',
        `Please wait ${Math.ceil(env.OTP_RESEND_COOLDOWN_SECONDS - waited)}s before requesting another code.`,
      );
    }
  }

  const otp = generateOtp();
  const challenge = await challengeStore.create({
    phone,
    otpHash: '',
    expiresAt: Date.now() + env.OTP_TTL_SECONDS * 1000,
  });
  challenge.otpHash = hashOtp(otp, challenge.id);
  await challengeStore.save(challenge);

  if (fcmToken) {
    await sendOtpPush(fcmToken, otp, env.OTP_TTL_SECONDS);
  } else {
    // Keeps local development and SMS fallback working when a device token was
    // not supplied. Production clients should send fcmToken with this request.
    await sms.send(phone, otpMessage(otp));
  }

  return {
    requestId: challenge.id,
    expiresIn: env.OTP_TTL_SECONDS,
    resendAfter: env.OTP_RESEND_COOLDOWN_SECONDS,
    delivery: fcmToken ? 'push' : 'console',
    ...(exposeOtpInResponse ? { devOtp: otp } : {}),
  };
}

export async function verifyOtp(requestId: string, otp: string) {
  const challenge = await challengeStore.find(requestId);
  if (!challenge) throw badRequest('INVALID_REQUEST', 'This verification request is no longer valid. Please start again.');
  if (challenge.consumed) throw badRequest('ALREADY_USED', 'This code has already been used. Please request a new one.');
  if (challenge.expiresAt < Date.now()) throw badRequest('OTP_EXPIRED', 'That code has expired. Please request a new one.');

  if (challenge.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw tooManyRequests('TOO_MANY_ATTEMPTS', 'Too many incorrect attempts. Please request a new code.');
  }

  challenge.attempts += 1;
  await challengeStore.save(challenge);

  if (!safeEqual(hashOtp(otp, challenge.id), challenge.otpHash)) {
    const left = Math.max(0, env.OTP_MAX_ATTEMPTS - challenge.attempts);
    throw unauthorized('INVALID_OTP', `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`);
  }

  challenge.consumed = true;
  await challengeStore.save(challenge);

  const existing = await userStore.findByPhone(challenge.phone);
  const user = existing ?? await userStore.create(challenge.phone);
  return { user, isNewUser: !existing };
}
