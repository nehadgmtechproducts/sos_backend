import { createHash, randomUUID } from 'node:crypto';
import { revokedTokenStore } from '../store/database.store.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { User } from '../store/database.store.js';

export interface AccessTokenPayload {
  sub: string;
  phone: string;
  exp?: number;
}

export function issueAccessToken(user: User): string {
  const payload: AccessTokenPayload = { sub: user.id, phone: user.phone };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN, jwtid: randomUUID() } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const isAccessTokenRevoked = (token: string) => revokedTokenStore.contains(tokenHash(token));
export async function revokeAccessToken(token: string) {
  const payload = verifyAccessToken(token);
  if (!payload.exp) throw new Error('Access token has no expiration.');
  await revokedTokenStore.add(tokenHash(token), payload.exp);
}
