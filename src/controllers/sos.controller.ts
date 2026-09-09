import type { RequestHandler } from 'express';
import { z } from 'zod';
import { badRequest } from '../utils/errors.js';
import { activateEmergencySos, getSosHistory, resolveEmergencySos } from '../services/sos.service.js';

export const activateSosSchema = z.object({
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  accuracy: z.number().nonnegative().optional(),
  message: z.string().trim().max(500).optional(),
}).refine((value) => (value.latitude === undefined) === (value.longitude === undefined), 'Latitude and longitude must be supplied together.');

const idSchema = z.object({ activationId: z.string().uuid('Invalid SOS activation ID.') });

export const activateSos: RequestHandler = async (req, res, next) => {
  try {
    // Hook SMS/call/location integrations here. The returned recipients let the
    // watch display an accurate delivery-progress state.
    res.status(201).json(await activateEmergencySos(req.auth!.userId, req.body));
  } catch (error) { next(error); }
};

export const listSosHistory: RequestHandler = async (req, res, next) => {
  try { res.json({ activations: await getSosHistory(req.auth!.userId) }); } catch (error) { next(error); }
};

export const resolveSos: RequestHandler = async (req, res, next) => {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return next(badRequest('VALIDATION_ERROR', 'Invalid SOS activation ID.'));
    const { activationId } = parsed.data;
    res.json({ activation: await resolveEmergencySos(req.auth!.userId, activationId) });
  } catch (error) { next(error); }
};
