import type { SessionRecord } from './types';

export const SESSION_COOKIE = 'sid';
export const SESSION_IDLE_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours idle
export const SESSION_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days absolute

// A session is active only if it is not revoked and has not passed either its
// idle expiry or its absolute expiry.
export function isSessionActive(session: SessionRecord, now: Date): boolean {
  if (session.revokedAt) return false;
  if (session.expiresAt.getTime() <= now.getTime()) return false;
  if (session.absoluteExpiresAt.getTime() <= now.getTime()) return false;
  return true;
}

// New idle expiry after a request: min(now + idle TTL, absolute expiry).
export function nextIdleExpiry(session: SessionRecord, now: Date): Date {
  return new Date(
    Math.min(now.getTime() + SESSION_IDLE_TTL_MS, session.absoluteExpiresAt.getTime()),
  );
}

export function assuranceLevel(session: SessionRecord): 'aal1' | 'aal2' {
  return session.mfaVerifiedAt ? 'aal2' : 'aal1';
}
