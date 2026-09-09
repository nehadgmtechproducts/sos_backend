import { deviceStore } from '../store/database.store.js';
import { sendRingPush } from './firebase.service.js';

/** Upsert this install's push token so the user's other devices can reach it. */
export function registerDevice(userId: string, fcmToken: string, platform?: string) {
  return deviceStore.register(userId, fcmToken, platform ?? null);
}

/** Forget a device (on logout / uninstall) so it stops receiving ring commands. */
export function unregisterDevice(fcmToken: string) {
  return deviceStore.remove(fcmToken);
}

export interface RingResult {
  targeted: number; // devices we attempted to ring
  delivered: number; // FCM accepted for delivery
  failed: number;
}

/**
 * Ring the devices of registered app users mutually connected to this user by
 * an emergency-contact link — either the user added them, or they added the
 * user (matched by phone). Contacts who haven't installed the app, and
 * registered users with no contact link, are never rung. `selfToken` drops the
 * device that pressed SOS. Dead tokens FCM rejects are pruned. Returns 0/0/0 —
 * not an error — when no reachable contact exists.
 */
export async function ringContactDevices(userId: string, userPhone: string, fromName: string, selfToken?: string): Promise<RingResult> {
  const tokens = await deviceStore.listContactTokens(userId, userPhone, selfToken);
  if (tokens.length === 0) return { targeted: 0, delivered: 0, failed: 0 };
  const result = await sendRingPush(tokens, fromName);
  if (result.invalidTokens.length > 0) await deviceStore.removeMany(result.invalidTokens);
  return { targeted: tokens.length, delivered: result.successCount, failed: result.failureCount };
}
