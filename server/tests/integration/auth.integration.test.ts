import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createAuthRouter } from '../../src/modules/auth/routes';
import { createRequireAuth } from '../../src/middleware/requireAuth';
import { authorize } from '../../src/middleware/authorize';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler';
import { createPrismaRepositories } from '../../src/repositories/prisma';
import { hashPassword } from '../../src/lib/password';
import { generateTotp } from '../../src/lib/totp';

// These tests require a real PostgreSQL database. They run in CI against an
// ephemeral Postgres service; locally they are skipped when DATABASE_URL is unset.
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('auth integration (PostgreSQL)', () => {
  const prisma = new PrismaClient();
  const password = 'correct horse battery staple';
  let orgAId = '';
  let orgBId = '';
  let userAId = '';
  let emailA = '';

  beforeAll(async () => {
    for (const name of ['super_admin', 'admin', 'supervisor', 'technician', 'read_only']) {
      await prisma.role.upsert({ where: { name }, create: { name }, update: {} });
    }
    const passwordHash = await hashPassword(password);
    const suffix = Math.random().toString(36).slice(2, 8);
    const orgA = await prisma.organization.create({ data: { name: 'Org A', slug: `org-a-${suffix}` } });
    const orgB = await prisma.organization.create({ data: { name: 'Org B', slug: `org-b-${suffix}` } });
    orgAId = orgA.id;
    orgBId = orgB.id;
    emailA = 'a-' + orgA.id.slice(0, 8) + '@example.com';
    const userA = await prisma.user.create({
      data: { organizationId: orgA.id, email: emailA, fullName: 'Admin A', passwordHash },
    });
    userAId = userA.id;
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
    const techRole = await prisma.role.findUniqueOrThrow({ where: { name: 'technician' } });
    await prisma.userRole.create({ data: { organizationId: orgA.id, userId: userA.id, roleId: adminRole.id } });
    void techRole;
  });

  afterAll(async () => {
    if (hasDb) {
      const where = { organizationId: { in: [orgAId, orgBId] } };
      await prisma.recoveryCode.deleteMany({ where });
      await prisma.mfaFactor.deleteMany({ where });
      await prisma.session.deleteMany({ where });
      await prisma.userRole.deleteMany({ where });
      await prisma.user.deleteMany({ where });
      await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
    }
    await prisma.$disconnect();
  });

  function buildApp() {
    const repos = createPrismaRepositories(prisma);
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(createAuthRouter(repos));
    // Test-only protected route to exercise role authorization end-to-end.
    const requireAuth = createRequireAuth({ sessions: repos.sessions, users: repos.users });
    app.get('/admin-only', requireAuth, authorize('settings:manage'), (_req, res) => res.json({ ok: true }));
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
  }

  function cookieOf(res: request.Response): string {
    const setCookie = res.headers['set-cookie'];
    const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    return raw.split(';')[0];
  }

  it('logs in, resolves the tenant from the session, and logs out', async () => {
    const app = buildApp();
    const login = await request(app).post('/auth/login').send({ email: emailA, password });
    expect(login.status).toBe(200);
    const cookie = cookieOf(login);

    const me = await request(app).get('/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.user.organizationId).toBe(orgAId);

    const admin = await request(app).get('/admin-only').set('Cookie', cookie);
    expect(admin.status).toBe(200); // admin role permits settings:manage

    const logout = await request(app)
      .post('/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', login.body.csrfToken);
    expect(logout.status).toBe(204);

    const after = await request(app).get('/auth/me').set('Cookie', cookie);
    expect(after.status).toBe(401); // revoked session
  });

  it('rejects an expired session', async () => {
    const repos = createPrismaRepositories(prisma);
    const app = buildApp();
    const login = await request(app).post('/auth/login').send({ email: emailA, password });
    const cookie = cookieOf(login);
    // Force the session to expire directly in the database.
    await prisma.session.updateMany({
      where: { userId: userAId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const me = await request(app).get('/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(401);
    void repos;
  });

  it('blocks a cross-tenant session row (composite foreign key)', async () => {
    // A session whose organizationId is Org B but whose user belongs to Org A
    // must be rejected by the composite foreign key.
    await expect(
      prisma.session.create({
        data: {
          organizationId: orgBId,
          userId: userAId,
          tokenHash: 'x'.repeat(43),
          csrfToken: 'csrf',
          expiresAt: new Date(Date.now() + 1000),
          absoluteExpiresAt: new Date(Date.now() + 2000),
        },
      }),
    ).rejects.toThrow();
  });

  it('prevents recovery-code replay', async () => {
    const app = buildApp();
    const login = await request(app).post('/auth/login').send({ email: emailA, password });
    const cookie = cookieOf(login);
    const csrf = login.body.csrfToken;

    const enroll = await request(app)
      .post('/auth/mfa/enroll')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrf);
    expect(enroll.status).toBe(200);

    const verify = await request(app)
      .post('/auth/mfa/verify')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrf)
      .send({ token: generateTotp(enroll.body.secret) });
    expect(verify.status).toBe(200);
    const codes: string[] = verify.body.recoveryCodes;
    expect(codes.length).toBeGreaterThan(0);

    const first = await request(app)
      .post('/auth/mfa/recovery')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrf)
      .send({ code: codes[0] });
    expect(first.status).toBe(200);

    const replay = await request(app)
      .post('/auth/mfa/recovery')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrf)
      .send({ code: codes[0] });
    expect(replay.status).toBe(401);
  });
});
