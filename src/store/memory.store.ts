/**
 * In-memory store — fine for local development only.
 * Replace with Redis (OTP challenges, TTL-native) + Postgres/Mongo (users)
 * before this goes anywhere near a real device. Everything here dies on restart
 * and does not work across more than one server process.
 */
import { randomUUID } from 'node:crypto';

export interface OtpChallenge {
  id: string;
  phone: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  consumed: boolean;
}

export interface User {
  id: string;
  phone: string;
  createdAt: Date;
  profileComplete: boolean;
}

const challenges = new Map<string, OtpChallenge>();
const lastSentByPhone = new Map<string, number>();
const usersByPhone = new Map<string, User>();

export const challengeStore = {
  create(data: Omit<OtpChallenge, 'id' | 'attempts' | 'consumed'>): OtpChallenge {
    const challenge: OtpChallenge = { ...data, id: randomUUID(), attempts: 0, consumed: false };
    challenges.set(challenge.id, challenge);
    lastSentByPhone.set(data.phone, Date.now());
    return challenge;
  },
  find: (id: string) => challenges.get(id),
  save: (c: OtpChallenge) => void challenges.set(c.id, c),
  lastSentAt: (phone: string) => lastSentByPhone.get(phone),
};

export const userStore = {
  findByPhone: (phone: string) => usersByPhone.get(phone),
  create(phone: string): User {
    const user: User = { id: randomUUID(), phone, createdAt: new Date(), profileComplete: false };
    usersByPhone.set(phone, user);
    return user;
  },
};

// Sweep expired challenges so the map cannot grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [id, c] of challenges) if (c.expiresAt < now) challenges.delete(id);
}, 60_000).unref();
