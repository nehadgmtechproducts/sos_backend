import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.string().default('30d'),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_PEPPER: z.string().min(16, 'OTP_PEPPER must be at least 16 chars'),
  DEFAULT_COUNTRY: z.string().length(2).default('IN'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL.'),
  /** Path to a Firebase service-account JSON file. Keep it outside source control. */
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().min(1).optional(),
  /** Production-safe alternative: inject the complete JSON through a secret manager. */
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  /**
   * Shared rate-limit store (Upstash Redis, REST-based — no persistent
   * connection, works well from serverless). Both must be set together, or
   * both omitted. Without them, rate limiting falls back to in-memory —
   * fine for local dev, but only enforced per-instance on serverless.
   */
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
}).refine(
  (value) => Boolean(value.UPSTASH_REDIS_REST_URL) === Boolean(value.UPSTASH_REDIS_REST_TOKEN),
  { message: 'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together.', path: ['UPSTASH_REDIS_REST_URL'] },
);

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
