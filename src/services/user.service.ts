import { userStore } from '../store/database.store.js';
import { badRequest } from '../utils/errors.js';

export async function getUserProfile(userId: string) {
  const user = await userStore.findById(userId);
  if (!user) throw badRequest('USER_NOT_FOUND', 'Your account no longer exists.');
  return user;
}

export async function updateUserProfile(userId: string, data: { name: string; email: string }) {
  const user = await userStore.update(userId, { ...data, profileComplete: true });
  if (!user) throw badRequest('USER_NOT_FOUND', 'Your account no longer exists.');
  return user;
}

/** Removes the account and all user-owned contacts/SOS records via ON DELETE CASCADE. */
export async function deleteUserProfile(userId: string) {
  if (!await userStore.remove(userId)) {
    throw badRequest('USER_NOT_FOUND', 'Your account no longer exists.');
  }
}
