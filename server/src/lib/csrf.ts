import { randomBytes, timingSafeEqual } from 'node:crypto';

// Double-submit CSRF tokens. A random token is bound to the session and required
// (in a header) on state-changing requests. Comparison is constant-time.
export const CSRF_TOKEN_BYTES = 32;

export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString('base64url');
}

export function verifyCsrfToken(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
