import type { RequestHandler } from 'express';
import { z } from 'zod';
import { badRequest } from '../utils/errors.js';
import {
  createEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContact,
  listEmergencyContacts,
  updateEmergencyContact,
} from '../services/contact.service.js';

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100),
  phone: z.string().min(6, 'Please enter a valid mobile number.').max(20, 'Please enter a valid mobile number.'),
});
export const updateContactSchema = contactSchema.partial().refine((value) => value.name !== undefined || value.phone !== undefined, 'Provide a name or phone number.');
const idSchema = z.object({ contactId: z.string().uuid('Invalid contact ID.') });

export const listContacts: RequestHandler = async (req, res, next) => {
  try { res.json({ contacts: await listEmergencyContacts(req.auth!.userId) }); } catch (error) { next(error); }
};

export const getContact: RequestHandler = async (req, res, next) => {
  const parsed = idSchema.safeParse(req.params);
  if (!parsed.success) return next(badRequest('VALIDATION_ERROR', 'Invalid contact ID.'));
  try { res.json({ contact: await getEmergencyContact(req.auth!.userId, parsed.data.contactId) }); } catch (error) { next(error); }
};

export const createContact: RequestHandler = async (req, res, next) => {
  try {
    res.status(201).json({ contact: await createEmergencyContact(req.auth!.userId, req.body) });
  } catch (error) { next(error); }
};

export const updateContact: RequestHandler = async (req, res, next) => {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return next(badRequest('VALIDATION_ERROR', 'Invalid contact ID.'));
    res.json({ contact: await updateEmergencyContact(req.auth!.userId, parsed.data.contactId, req.body) });
  } catch (error) { next(error); }
};

export const deleteContact: RequestHandler = async (req, res, next) => {
  try {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) return next(badRequest('VALIDATION_ERROR', 'Invalid contact ID.'));
    const { contactId } = parsed.data;
    await deleteEmergencyContact(req.auth!.userId, contactId);
    res.status(204).send();
  } catch (error) { next(error); }
};
