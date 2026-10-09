import { z } from 'zod';

// Environment validation. DATABASE_URL / SESSION_SECRET / MFA_ENCRYPTION_KEY are
// optional at parse time and enforced where they are actually required.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Credentialed CORS cannot use a wildcard origin.
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .refine((value) => value !== '*', {
      message: "CORS_ORIGIN cannot be '*' because credentials are enabled",
    }),
  DATABASE_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  // Trusted proxy configuration for correct client IPs. When unset, X-Forwarded-*
  // headers are NOT trusted. Examples: "1" (hops), "loopback", "true", a comma list.
  TRUST_PROXY: z.string().optional(),
  // Base64-encoded 32-byte key for MFA secret encryption at rest.
  MFA_ENCRYPTION_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}

export const env = loadEnv();

// Throws rather than silently storing MFA secrets unencrypted.
export function getMfaEncryptionKey(): string {
  if (!env.MFA_ENCRYPTION_KEY) {
    throw new Error('MFA_ENCRYPTION_KEY is not configured; MFA secret storage is disabled');
  }
  return env.MFA_ENCRYPTION_KEY;
}

// Parses TRUST_PROXY into a value for app.set('trust proxy', ...).
export function trustProxySetting(): number | string | boolean | undefined {
  const value = env.TRUST_PROXY;
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}
