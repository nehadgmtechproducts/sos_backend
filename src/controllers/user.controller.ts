import type { RequestHandler } from 'express';
import { z } from 'zod';
import { deleteUserProfile, getUserProfile, updateUserProfile } from '../services/user.service.js';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
});

type Profile = Awaited<ReturnType<typeof getUserProfile>>;
const view = (user: Profile) => ({
  id: user.id, phone: user.phone, name: user.name, email: user.email,
  profileComplete: user.profileComplete, createdAt: user.createdAt, updatedAt: user.updatedAt,
});

export const getMe: RequestHandler = async (req, res, next) => {
  try { res.json({ user: view(await getUserProfile(req.auth!.userId)) }); } catch (error) { next(error); }
};

export const putMe: RequestHandler = async (req, res, next) => {
  try { res.json({ user: view(await updateUserProfile(req.auth!.userId, req.body)) }); } catch (error) { next(error); }
};

/** DELETE /api/v1/users/me — permanently delete the authenticated account. */
export const deleteMe: RequestHandler = async (req, res, next) => {
  try {
    await deleteUserProfile(req.auth!.userId);
    res.status(204).send();
  } catch (error) { next(error); }
};
