import { createHash, randomBytes } from 'node:crypto';

// Opaque session tokens: a 256-bit random value returned to the client (cookie),
// while only its SHA-256 hash is stored server-side. A database leak therefore
// does not expose usable session tokens.
export const SESSION_TOKEN_BYTES = 32;

export interface GeneratedSessionToken {
  token: string; // returned to the client, never stored
  tokenHash: string; // stored server-side
}

export function generateSessionToken(): GeneratedSessionToken {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
  return { token, tokenHash: hashSessionToken(token) };
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}
