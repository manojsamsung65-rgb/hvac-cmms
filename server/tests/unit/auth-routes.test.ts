import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createAuthRouter } from '../../src/modules/auth/routes';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler';
import { hashPassword } from '../../src/lib/password';
import { createFakeRepositories } from '../helpers/fakes';
import type { UserWithSecret } from '../../src/auth/types';

async function buildApp() {
  const repos = createFakeRepositories();
  const user: UserWithSecret = {
    id: 'user-1',
    organizationId: 'org-1',
    role: 'admin',
    isActive: true,
    email: 'admin@example.com',
    passwordHash: await hashPassword('correct horse battery staple'),
  };
  repos.seedUser(user);
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(createAuthRouter(repos));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function sessionCookie(res: request.Response): string {
  const setCookie = res.headers['set-cookie'];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return raw.split(';')[0];
}

describe('auth routes', () => {
  it('logs in, returns a cookie and csrf token', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'correct horse battery staple' });
    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeTruthy();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 for a wrong password', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('invalid_credentials');
  });

  it('rejects /auth/me without a session', async () => {
    const app = await buildApp();
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user with a valid session', async () => {
    const app = await buildApp();
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'correct horse battery staple' });
    const res = await request(app).get('/auth/me').set('Cookie', sessionCookie(login));
    expect(res.status).toBe(200);
    expect(res.body.user.organizationId).toBe('org-1');
  });

  it('requires a CSRF token for logout', async () => {
    const app = await buildApp();
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'correct horse battery staple' });
    const cookie = sessionCookie(login);
    const missing = await request(app).post('/auth/logout').set('Cookie', cookie);
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe('csrf_failed');

    const ok = await request(app)
      .post('/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', login.body.csrfToken);
    expect(ok.status).toBe(204);

    const after = await request(app).get('/auth/me').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });
});
