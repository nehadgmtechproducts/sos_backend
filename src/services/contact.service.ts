import { contactStore } from '../store/database.store.js';
import { normalisePhone } from '../utils/phone.js';
import { badRequest } from '../utils/errors.js';

export interface ContactInput { name: string; phone: string }
export interface ContactUpdate { name?: string; phone?: string }

export const listEmergencyContacts = (userId: string) => contactStore.list(userId);

export async function getEmergencyContact(userId: string, contactId: string) {
  const contact = await contactStore.find(userId, contactId);
  if (!contact) throw badRequest('CONTACT_NOT_FOUND', 'Emergency contact not found.');
  return contact;
}

export async function createEmergencyContact(userId: string, data: ContactInput) {
  const phone = normalisePhone(data.phone);
  if (await contactStore.findByPhone(userId, phone)) {
    throw badRequest('CONTACT_EXISTS', 'This phone number is already an emergency contact.');
  }
  return await contactStore.create(userId, data.name, phone);
}

export async function updateEmergencyContact(userId: string, contactId: string, data: ContactUpdate) {
  const changes = { ...data, ...(data.phone ? { phone: normalisePhone(data.phone) } : {}) };
  const duplicate = changes.phone ? await contactStore.findByPhone(userId, changes.phone) : undefined;
  if (duplicate && duplicate.id !== contactId) {
    throw badRequest('CONTACT_EXISTS', 'This phone number is already an emergency contact.');
  }
  const contact = await contactStore.update(userId, contactId, changes);
  if (!contact) throw badRequest('CONTACT_NOT_FOUND', 'Emergency contact not found.');
  return contact;
}

export async function deleteEmergencyContact(userId: string, contactId: string) {
  if (!await contactStore.remove(userId, contactId)) {
    throw badRequest('CONTACT_NOT_FOUND', 'Emergency contact not found.');
  }
}
