import { describe, it, expect } from 'vitest';
import { isSessionActive, nextIdleExpiry, SESSION_IDLE_TTL_MS } from '../../src/auth/session';
import { createFakeRepositories } from '../helpers/fakes';
import type { SessionRecord } from '../../src/auth/types';

const NOW = new Date('2026-10-10T00:00:00Z');

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 's1',
    organizationId: 'org-1',
    userId: 'u1',
    tokenHash: 'h',
    csrfToken: 'c',
    expiresAt: new Date(NOW.getTime() + 1000),
    absoluteExpiresAt: new Date(NOW.getTime() + 10_000),
    revokedAt: null,
    mfaVerifiedAt: null,
    ...overrides,
  };
}

describe('session lifecycle', () => {
  it('treats an expired or revoked session as inactive', () => {
    expect(isSessionActive(makeSession(), NOW)).toBe(true);
    expect(isSessionActive(makeSession({ expiresAt: new Date(NOW.getTime() - 1) }), NOW)).toBe(false);
    expect(isSessionActive(makeSession({ revokedAt: NOW }), NOW)).toBe(false);
    expect(
      isSessionActive(makeSession({ absoluteExpiresAt: new Date(NOW.getTime() - 1) }), NOW),
    ).toBe(false);
  });

  it('extends the idle expiry but never beyond the absolute expiry', () => {
    const s = makeSession({ absoluteExpiresAt: new Date(NOW.getTime() + 60_000) });
    const next = nextIdleExpiry(s, NOW);
    expect(next.getTime()).toBe(Math.min(NOW.getTime() + SESSION_IDLE_TTL_MS, s.absoluteExpiresAt.getTime()));
  });

  it('cleans up sessions past their absolute expiry', async () => {
    const repos = createFakeRepositories();
    await repos.sessions.create({
      organizationId: 'o',
      userId: 'u',
      tokenHash: 'expired',
      csrfToken: 'c',
      expiresAt: new Date(NOW.getTime() - 1),
      absoluteExpiresAt: new Date(NOW.getTime() - 1),
    });
    await repos.sessions.create({
      organizationId: 'o',
      userId: 'u',
      tokenHash: 'active',
      csrfToken: 'c',
      expiresAt: new Date(NOW.getTime() + 10_000),
      absoluteExpiresAt: new Date(NOW.getTime() + 10_000),
    });
    const removed = await repos.sessions.cleanupExpiredSessions(NOW);
    expect(removed).toBe(1);
    expect(await repos.sessions.findByTokenHash('active')).not.toBeNull();
  });
});
