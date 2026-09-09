-- PostgreSQL production schema. The running development API uses DATABASE_FILE
-- and has the same entities/relationships so it can run with zero setup.
CREATE TABLE users (
  id UUID PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100),
  email VARCHAR(254),
  profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE emergency_contacts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, phone)
);

CREATE TABLE sos_activations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(10) NOT NULL CHECK (status IN ('ACTIVE', 'RESOLVED')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  message VARCHAR(500),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX sos_activations_user_triggered_idx ON sos_activations (user_id, triggered_at DESC);

CREATE TABLE IF NOT EXISTS revoked_access_tokens (
  token_hash TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

-- One row per app install (phone, watch, ...). Ringing a user's devices means
-- pushing to every token here except the one that pressed SOS. The FCM token is
-- the primary key: if the same device signs in as a different user, the ON
-- CONFLICT upsert re-points it, so a token is never owned by two users at once.
CREATE TABLE IF NOT EXISTS user_devices (
  fcm_token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_devices_user_idx ON user_devices (user_id);

-- OTP login challenges. Must be durable/shared storage (not in-process memory):
-- on a serverless platform, the request that creates a challenge and the
-- request that verifies it can run on different instances.
CREATE TABLE IF NOT EXISTS otp_challenges (
  id UUID PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS otp_challenges_phone_created_idx ON otp_challenges (phone, created_at DESC);
