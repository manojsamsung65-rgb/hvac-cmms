import type { SessionRecord } from './types';

export const SESSION_COOKIE = 'sid';

// A session is active only if it is not revoked and has not passed either its
// idle expiry or its absolute expiry.
export function isSessionActive(session: SessionRecord, now: Date): boolean {
  if (session.revokedAt) return false;
  if (session.expiresAt.getTime() <= now.getTime()) return false;
  if (session.absoluteExpiresAt.getTime() <= now.getTime()) return false;
  return true;
}

export function assuranceLevel(session: SessionRecord): 'aal1' | 'aal2' {
  return session.mfaVerifiedAt ? 'aal2' : 'aal1';
}
