import 'dotenv/config';
import { z } from 'zod';

/**
 * Hosting dashboards (Vercel included) make it easy to leave a variable
 * defined but blank. For an *optional* setting, blank means "not configured",
 * not "invalid" — without this, one stray empty field fails validation and
 * takes the whole app down.
 */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const schema = z.object({
  NODE_ENV: z.preprocess(blankToUndefined, z.enum(['development', 'test', 'production']).default('development')),
  PORT: z.preprocess(blankToUndefined, z.coerce.number().positive().default(3000)),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 chars'),
  JWT_EXPIRES_IN: z.preprocess(blankToUndefined, z.string().default('30d')),
  // .positive() matters as much as the default: a blank var used to coerce to
  // 0 (Number('') === 0), which silently set the OTP lifetime to zero and made
  // every code expire the instant it was issued. Fail loudly instead.
  OTP_TTL_SECONDS: z.preprocess(blankToUndefined, z.coerce.number().positive().default(300)),
  OTP_RESEND_COOLDOWN_SECONDS: z.preprocess(blankToUndefined, z.coerce.number().nonnegative().default(60)),
  OTP_MAX_ATTEMPTS: z.preprocess(blankToUndefined, z.coerce.number().positive().default(5)),
  OTP_PEPPER: z.string().min(16, 'OTP_PEPPER must be at least 16 chars'),
  DEFAULT_COUNTRY: z.preprocess(blankToUndefined, z.string().length(2).default('IN')),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL.'),
  /** Path to a Firebase service-account JSON file. Keep it outside source control. */
  FIREBASE_SERVICE_ACCOUNT_PATH: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  /** Production-safe alternative: inject the complete JSON through a secret manager. */
  FIREBASE_SERVICE_ACCOUNT_JSON: z.preprocess(blankToUndefined, z.string().min(1).optional()),
  /**
   * Shared rate-limit store (Upstash Redis, REST-based — no persistent
   * connection, works well from serverless). Both must be set together, or
   * both omitted. Without them, rate limiting falls back to in-memory —
   * fine for local dev, but only enforced per-instance on serverless.
   */
  UPSTASH_REDIS_REST_URL: z.preprocess(blankToUndefined, z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess(blankToUndefined, z.string().min(1).optional()),
}).refine(
  (value) => Boolean(value.UPSTASH_REDIS_REST_URL) === Boolean(value.UPSTASH_REDIS_REST_TOKEN),
  { message: 'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together.', path: ['UPSTASH_REDIS_REST_URL'] },
);

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Never call process.exit() in code that can run as a serverless function —
  // it kills the entire function invocation (Vercel reports this as
  // FUNCTION_INVOCATION_FAILED with no useful detail), and on a warm
  // container it can take other concurrent, unrelated invocations down with
  // it. Throwing instead surfaces a normal error with this exact message in
  // the platform's logs, and still fails fast in local/VPS use the same way.
  throw new Error(`Invalid environment configuration:\n${JSON.stringify(z.treeifyError(parsed.error), null, 2)}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
