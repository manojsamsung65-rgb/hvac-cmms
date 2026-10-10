import { describe, it, expect } from 'vitest';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createRequireAuth } from '../../src/middleware/requireAuth';
import { authorize } from '../../src/middleware/authorize';
import { requireMfa } from '../../src/middleware/requireMfa';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler';
import { SESSION_COOKIE } from '../../src/auth/session';
import { generateSessionToken } from '../../src/lib/session-token';
import type { AuthUser, SessionRecord } from '../../src/auth/types';

const NOW = new Date('2026-10-10T00:00:00Z');

function buildApp(opts: {
  session?: SessionRecord | null;
  user?: AuthUser | null;
  cookie?: string;
}): Express {
  const app = express();
  app.use(cookieParser());

  const sessions = {
    async findByTokenHash(hash: string) {
      return opts.session && opts.session.tokenHash === hash ? opts.session : null;
    },
  };
  const users = {
    async findById(id: string) {
      return opts.user && opts.user.id === id ? opts.user : null;
    },
  };

  const requireAuth = createRequireAuth({ sessions, users, now: () => NOW });

  app.get('/protected', requireAuth, (req, res) => res.json({ auth: req.auth }));
  app.get('/admin', requireAuth, authorize('settings:manage'), (req, res) => res.json({ ok: true }));
  app.get('/admin-mfa', requireAuth, requireMfa, (req, res) => res.json({ ok: true }));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'sess-1',
    userId: 'user-1',
    tokenHash: 'placeholder',
    expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    absoluteExpiresAt: new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    mfaVerifiedAt: null,
    ...overrides,
  };
}

const adminUser: AuthUser = { id: 'user-1', organizationId: 'org-1', role: 'admin', isActive: true };
const techUser: AuthUser = { id: 'user-1', organizationId: 'org-1', role: 'technician', isActive: true };

describe('requireAuth', () => {
  it('rejects a request with no session cookie', async () => {
    const res = await request(buildApp({})).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('accepts a valid session and attaches the authenticated context', async () => {
    const { token, tokenHash } = generateSessionToken();
    const app = buildApp({ session: makeSession({ tokenHash }), user: adminUser, cookie: token });
    const res = await request(app).get('/protected').set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.auth.organizationId).toBe('org-1');
    expect(res.body.auth.role).toBe('admin');
  });

  it('rejects an expired session', async () => {
    const { token, tokenHash } = generateSessionToken();
    const session = makeSession({ tokenHash, expiresAt: new Date(NOW.getTime() - 1000) });
    const res = await request(buildApp({ session, user: adminUser }))
      .get('/protected')
      .set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects a revoked session', async () => {
    const { token, tokenHash } = generateSessionToken();
    const session = makeSession({ tokenHash, revokedAt: NOW });
    const res = await request(buildApp({ session, user: adminUser }))
      .get('/protected')
      .set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects an inactive user', async () => {
    const { token, tokenHash } = generateSessionToken();
    const app = buildApp({ session: makeSession({ tokenHash }), user: { ...adminUser, isActive: false } });
    const res = await request(app).get('/protected').set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(401);
  });
});

describe('authorize', () => {
  it('allows an admin', async () => {
    const { token, tokenHash } = generateSessionToken();
    const app = buildApp({ session: makeSession({ tokenHash }), user: adminUser });
    const res = await request(app).get('/admin').set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(200);
  });

  it('forbids a technician from an admin action', async () => {
    const { token, tokenHash } = generateSessionToken();
    const app = buildApp({ session: makeSession({ tokenHash }), user: techUser });
    const res = await request(app).get('/admin').set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });
});

describe('requireMfa', () => {
  it('forbids a session that has not completed MFA', async () => {
    const { token, tokenHash } = generateSessionToken();
    const app = buildApp({ session: makeSession({ tokenHash }), user: adminUser });
    const res = await request(app).get('/admin-mfa').set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('mfa_required');
  });

  it('allows a session that has completed MFA', async () => {
    const { token, tokenHash } = generateSessionToken();
    const session = makeSession({ tokenHash, mfaVerifiedAt: NOW });
    const app = buildApp({ session, user: adminUser });
    const res = await request(app).get('/admin-mfa').set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(res.status).toBe(200);
  });
});
