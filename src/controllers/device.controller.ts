import type { RequestHandler } from 'express';
import { z } from 'zod';
import { registerDevice, ringContactDevices, unregisterDevice } from '../services/device.service.js';

const fcmToken = z.string().min(20, 'Invalid Firebase device token.').max(4096, 'Invalid Firebase device token.');

export const registerDeviceSchema = z.object({
  fcmToken,
  platform: z.enum(['android', 'ios', 'web']).optional(),
});

export const ringSchema = z.object({
  // The caller's own token, so we don't ring the phone that pressed SOS.
  fcmToken: fcmToken.optional(),
  fromName: z.string().trim().min(1).max(100).optional(),
});

export const unregisterSchema = z.object({ fcmToken });

/** POST /api/v1/devices/register — save this install's push token for the user. */
export const postRegisterDevice: RequestHandler = async (req, res, next) => {
  try {
    await registerDevice(req.auth!.userId, req.body.fcmToken, req.body.platform);
    res.status(204).send();
  } catch (error) { next(error); }
};

/** POST /api/v1/devices/ring — push a "ring" command to the user's contacts who use the app. */
export const postRingDevices: RequestHandler = async (req, res, next) => {
  try {
    const result = await ringContactDevices(req.auth!.userId, req.auth!.phone, req.body.fromName ?? 'A contact', req.body.fcmToken);
    res.status(200).json(result);
  } catch (error) { next(error); }
};

/** POST /api/v1/devices/unregister — drop this device's push token. */
export const postUnregisterDevice: RequestHandler = async (req, res, next) => {
  try {
    await unregisterDevice(req.body.fcmToken);
    res.status(204).send();
  } catch (error) { next(error); }
};
