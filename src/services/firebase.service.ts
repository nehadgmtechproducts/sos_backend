import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

let initialized = false;

function initialiseFirebase() {
  if (initialized) return;
  if (!env.FIREBASE_SERVICE_ACCOUNT_PATH && !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new AppError(503, 'PUSH_NOT_CONFIGURED', 'Push notification delivery is not configured on the server.');
  }
  try {
    // In production, prefer FIREBASE_SERVICE_ACCOUNT_JSON from the hosting
    // platform's secret manager. A path supports local development or a
    // container secret mounted as a file. Relative paths use the app root.
    const raw = env.FIREBASE_SERVICE_ACCOUNT_JSON
      ?? readFileSync(resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH!), 'utf8');
    const serviceAccount = JSON.parse(raw);
    if (getApps().length === 0) initializeApp({ credential: cert(serviceAccount) });
    initialized = true;
  } catch (error) {
    throw new AppError(503, 'PUSH_NOT_CONFIGURED', 'Firebase service-account configuration is invalid or unavailable.');
  }
}

export interface RingPushResult {
  successCount: number;
  failureCount: number;
  /** Tokens FCM reported as permanently invalid — safe for the caller to prune. */
  invalidTokens: string[];
}

/**
 * Fans a silent, high-priority "ring" command out to many devices at once. This
 * is a data-only message (no `notification` block) so the app is always handed
 * the payload to react to — it decides to raise the full-screen alarm rather
 * than the OS showing a passive banner.
 */
export async function sendRingPush(tokens: string[], fromName: string): Promise<RingPushResult> {
  initialiseFirebase();
  if (tokens.length === 0) return { successCount: 0, failureCount: 0, invalidTokens: [] };
  try {
    const response = await getMessaging().sendEachForMulticast({
      tokens,
      data: { type: 'ring', fromName, sentAt: String(Date.now()) },
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10', 'apns-push-type': 'background' }, payload: { aps: { contentAvailable: true } } },
    });
    const invalidTokens: string[] = [];
    response.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument')) {
        invalidTokens.push(tokens[i]);
      }
    });
    return { successCount: response.successCount, failureCount: response.failureCount, invalidTokens };
  } catch (error) {
    throw new AppError(503, 'PUSH_DELIVERY_FAILED', 'Could not ring your other devices. Please try again.');
  }
}

/** Sends a visible FCM notification to one app/watch device. */
export async function sendOtpPush(fcmToken: string, otp: string, expiresInSeconds: number) {
  initialiseFirebase();
  try {
    await getMessaging().send({
      token: fcmToken,
      notification: {
        title: 'SOS Emergency verification code',
        body: `${otp} is your verification code. Do not share it.`,
      },
      data: { type: 'otp', otp, expiresIn: String(expiresInSeconds) },
      android: { priority: 'high', notification: { channelId: 'otp_notifications' } },
    });
  } catch (error) {
    throw new AppError(503, 'PUSH_DELIVERY_FAILED', 'Could not deliver the verification notification. Please try again.');
  }
}
