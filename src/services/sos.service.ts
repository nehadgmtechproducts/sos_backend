import { contactStore, sosStore } from '../store/database.store.js';
import { badRequest } from '../utils/errors.js';

export interface SosActivationInput {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  message?: string;
}

export async function activateEmergencySos(userId: string, data: SosActivationInput) {
  const contacts = await contactStore.list(userId);
  if (contacts.length === 0) {
    throw badRequest('CONTACT_REQUIRED', 'Add at least one emergency contact before activating SOS.');
  }
  const activation = await sosStore.create(userId, {
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    accuracy: data.accuracy ?? null,
    message: data.message ?? null,
  });
  return { activation, recipients: contacts.map(({ id, name, phone }) => ({ id, name, phone })) };
}

export const getSosHistory = (userId: string) => sosStore.list(userId);

export async function resolveEmergencySos(userId: string, activationId: string) {
  const activation = await sosStore.resolve(userId, activationId);
  if (!activation) throw badRequest('SOS_NOT_FOUND', 'SOS activation not found.');
  return activation;
}
