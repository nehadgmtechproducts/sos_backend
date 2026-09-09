import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

export interface User { id: string; phone: string; name: string | null; email: string | null; profileComplete: boolean; createdAt: string; updatedAt: string }
export interface EmergencyContact { id: string; userId: string; name: string; phone: string; createdAt: string; updatedAt: string }
export interface SosActivation { id: string; userId: string; status: 'ACTIVE' | 'RESOLVED'; latitude: number | null; longitude: number | null; accuracy: number | null; message: string | null; triggeredAt: string; resolvedAt: string | null }
export interface OtpChallenge { id: string; phone: string; otpHash: string; expiresAt: number; attempts: number; consumed: boolean }

// Serverless platforms (Vercel) can run many concurrent function instances,
// each importing this module and creating its own Pool — a default max of 10
// per pool multiplies fast and can exhaust a small Postgres plan's connection
// limit. Keep each instance's pool small; use a pooled/pgbouncer connection
// string from your Postgres provider (Neon, Supabase, etc.) in production.
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
const date = (value: unknown) => new Date(value as string | Date).toISOString();
const user = (r: Record<string, unknown>): User => ({ id: r.id as string, phone: r.phone as string, name: r.name as string | null, email: r.email as string | null, profileComplete: r.profile_complete as boolean, createdAt: date(r.created_at), updatedAt: date(r.updated_at) });
const contact = (r: Record<string, unknown>): EmergencyContact => ({ id: r.id as string, userId: r.user_id as string, name: r.name as string, phone: r.phone as string, createdAt: date(r.created_at), updatedAt: date(r.updated_at) });
const activation = (r: Record<string, unknown>): SosActivation => ({ id: r.id as string, userId: r.user_id as string, status: r.status as SosActivation['status'], latitude: r.latitude as number | null, longitude: r.longitude as number | null, accuracy: r.accuracy as number | null, message: r.message as string | null, triggeredAt: date(r.triggered_at), resolvedAt: r.resolved_at ? date(r.resolved_at) : null });
const challenge = (r: Record<string, unknown>): OtpChallenge => ({ id: r.id as string, phone: r.phone as string, otpHash: r.otp_hash as string, expiresAt: new Date(r.expires_at as string).getTime(), attempts: r.attempts as number, consumed: r.consumed as boolean });

export async function verifyDatabaseConnection() { await pool.query('SELECT 1'); }

export const userStore = {
  async findByPhone(phone: string) { const q = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]); return q.rows[0] ? user(q.rows[0]) : undefined; },
  async findById(id: string) { const q = await pool.query('SELECT * FROM users WHERE id = $1', [id]); return q.rows[0] ? user(q.rows[0]) : undefined; },
  async create(phone: string) { const q = await pool.query('INSERT INTO users (id, phone) VALUES ($1, $2) RETURNING *', [randomUUID(), phone]); return user(q.rows[0]); },
  async update(id: string, changes: Pick<User, 'name' | 'email' | 'profileComplete'>) {
    const q = await pool.query('UPDATE users SET name = $2, email = $3, profile_complete = $4, updated_at = NOW() WHERE id = $1 RETURNING *', [id, changes.name, changes.email, changes.profileComplete]);
    return q.rows[0] ? user(q.rows[0]) : undefined;
  },
  async remove(id: string) {
    const q = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return q.rowCount === 1;
  },
};

export const contactStore = {
  async list(userId: string) { const q = await pool.query('SELECT * FROM emergency_contacts WHERE user_id = $1 ORDER BY created_at', [userId]); return q.rows.map(contact); },
  async find(userId: string, id: string) { const q = await pool.query('SELECT * FROM emergency_contacts WHERE user_id = $1 AND id = $2', [userId, id]); return q.rows[0] ? contact(q.rows[0]) : undefined; },
  async findByPhone(userId: string, phone: string) { const q = await pool.query('SELECT * FROM emergency_contacts WHERE user_id = $1 AND phone = $2', [userId, phone]); return q.rows[0] ? contact(q.rows[0]) : undefined; },
  async create(userId: string, name: string, phone: string) { const q = await pool.query('INSERT INTO emergency_contacts (id, user_id, name, phone) VALUES ($1, $2, $3, $4) RETURNING *', [randomUUID(), userId, name, phone]); return contact(q.rows[0]); },
  async update(userId: string, id: string, changes: Partial<Pick<EmergencyContact, 'name' | 'phone'>>) {
    const q = await pool.query('UPDATE emergency_contacts SET name = COALESCE($3, name), phone = COALESCE($4, phone), updated_at = NOW() WHERE user_id = $1 AND id = $2 RETURNING *', [userId, id, changes.name ?? null, changes.phone ?? null]);
    return q.rows[0] ? contact(q.rows[0]) : undefined;
  },
  async remove(userId: string, id: string) { const q = await pool.query('DELETE FROM emergency_contacts WHERE user_id = $1 AND id = $2', [userId, id]); return q.rowCount === 1; },
};

export const sosStore = {
  async create(userId: string, data: Pick<SosActivation, 'latitude' | 'longitude' | 'accuracy' | 'message'>) {
    const q = await pool.query("INSERT INTO sos_activations (id, user_id, status, latitude, longitude, accuracy, message) VALUES ($1, $2, 'ACTIVE', $3, $4, $5, $6) RETURNING *", [randomUUID(), userId, data.latitude, data.longitude, data.accuracy, data.message]);
    return activation(q.rows[0]);
  },
  async list(userId: string) { const q = await pool.query('SELECT * FROM sos_activations WHERE user_id = $1 ORDER BY triggered_at DESC', [userId]); return q.rows.map(activation); },
  async resolve(userId: string, id: string) {
    const q = await pool.query("UPDATE sos_activations SET status = 'RESOLVED', resolved_at = COALESCE(resolved_at, NOW()) WHERE user_id = $1 AND id = $2 RETURNING *", [userId, id]);
    return q.rows[0] ? activation(q.rows[0]) : undefined;
  },
};

// Store token hashes rather than bearer credentials; revocations survive restarts.
export async function ensureSessionSchema() {
  await pool.query(`CREATE TABLE IF NOT EXISTS revoked_access_tokens (
    token_hash TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS user_devices (
    fcm_token TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS user_devices_user_idx ON user_devices (user_id)');
  await pool.query(`CREATE TABLE IF NOT EXISTS otp_challenges (
    id UUID PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    otp_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS otp_challenges_phone_created_idx ON otp_challenges (phone, created_at DESC)');
}

/**
 * OTP login challenges. Must be durable, shared storage rather than in-process
 * memory: on a serverless platform (Vercel), the request that creates a
 * challenge and the request that verifies it can run on different instances
 * with no shared memory, so an in-memory Map would silently lose challenges.
 */
export const challengeStore = {
  async create(data: Pick<OtpChallenge, 'phone' | 'otpHash' | 'expiresAt'>): Promise<OtpChallenge> {
    const id = randomUUID();
    await pool.query(
      'INSERT INTO otp_challenges (id, phone, otp_hash, expires_at) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))',
      [id, data.phone, data.otpHash, data.expiresAt],
    );
    // Best-effort cleanup, piggybacked on the write path most likely to happen
    // — there is no reliable setInterval on serverless, so expiry sweeping
    // can't be a background timer. Only drops rows well past expiry, never
    // ones still being verified.
    void pool.query("DELETE FROM otp_challenges WHERE expires_at < NOW() - INTERVAL '1 day'").catch(() => {});
    return { id, attempts: 0, consumed: false, ...data };
  },
  async find(id: string): Promise<OtpChallenge | undefined> {
    const q = await pool.query('SELECT * FROM otp_challenges WHERE id = $1', [id]);
    return q.rows[0] ? challenge(q.rows[0]) : undefined;
  },
  async save(c: OtpChallenge) {
    await pool.query(
      'UPDATE otp_challenges SET otp_hash = $2, attempts = $3, consumed = $4 WHERE id = $1',
      [c.id, c.otpHash, c.attempts, c.consumed],
    );
  },
  /** Epoch ms of the most recent challenge for this phone, for the resend cooldown. */
  async lastSentAt(phone: string): Promise<number | undefined> {
    const q = await pool.query('SELECT created_at FROM otp_challenges WHERE phone = $1 ORDER BY created_at DESC LIMIT 1', [phone]);
    return q.rows[0] ? new Date(q.rows[0].created_at as string).getTime() : undefined;
  },
};

// Registry of push targets. Ringing a user's devices reads every token here for
// that user; delivery failures for dead tokens are pruned via removeMany.
export const deviceStore = {
  async register(userId: string, fcmToken: string, platform: string | null) {
    await pool.query(
      `INSERT INTO user_devices (fcm_token, user_id, platform, last_seen_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (fcm_token)
       DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = NOW()`,
      [fcmToken, userId, platform],
    );
  },
  /**
   * Device tokens to ring when the owner presses SOS. The contact link is
   * treated as MUTUAL: a registered user is rung if the owner added them OR they
   * added the owner (matched by E.164 phone). Registered users with no contact
   * edge in either direction are never returned, and `u.id <> ownerId` keeps the
   * owner from ringing themselves. `excludeToken` drops the device that pressed
   * SOS. Params: $1 owner id, $2 owner phone, $3 optional token to exclude.
   */
  async listContactTokens(ownerUserId: string, ownerPhone: string, excludeToken?: string) {
    const q = await pool.query(
      `SELECT DISTINCT d.fcm_token
       FROM user_devices d
       JOIN users u ON u.id = d.user_id
       WHERE u.id <> $1
         AND (
           EXISTS (SELECT 1 FROM emergency_contacts c WHERE c.user_id = $1 AND c.phone = u.phone)
           OR EXISTS (SELECT 1 FROM emergency_contacts c WHERE c.user_id = u.id AND c.phone = $2)
         )
         AND ($3::text IS NULL OR d.fcm_token <> $3)`,
      [ownerUserId, ownerPhone, excludeToken ?? null],
    );
    return q.rows.map((r) => r.fcm_token as string);
  },
  async remove(fcmToken: string) {
    await pool.query('DELETE FROM user_devices WHERE fcm_token = $1', [fcmToken]);
  },
  async removeMany(tokens: string[]) {
    if (tokens.length === 0) return;
    await pool.query('DELETE FROM user_devices WHERE fcm_token = ANY($1)', [tokens]);
  },
};
export const revokedTokenStore = {
  async contains(hash: string) {
    const result = await pool.query('SELECT 1 FROM revoked_access_tokens WHERE token_hash = $1 AND expires_at > NOW()', [hash]);
    return result.rowCount === 1;
  },
  async add(hash: string, expiresAt: number) {
    await pool.query('INSERT INTO revoked_access_tokens (token_hash, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT DO NOTHING', [hash, expiresAt]);
    await pool.query('DELETE FROM revoked_access_tokens WHERE expires_at <= NOW()');
  },
};
