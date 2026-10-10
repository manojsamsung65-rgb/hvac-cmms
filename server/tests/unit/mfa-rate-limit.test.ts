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

function cookieOf(res: request.Response): string {
  const setCookie = res.headers['set-cookie'];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return raw.split(';')[0];
}

describe('MFA verification rate limiting', () => {
  it('blocks brute-force attempts on /auth/mfa/verify after the limit', async () => {
    const app = await buildApp();
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'correct horse battery staple' });
    const cookie = cookieOf(login);
    const csrf = login.body.csrfToken;

    let sawRateLimit = false;
    for (let i = 0; i < 7; i++) {
      const res = await request(app)
        .post('/auth/mfa/verify')
        .set('Cookie', cookie)
        .set('x-csrf-token', csrf)
        .send({ token: '000000' });
      if (res.status === 429) {
        sawRateLimit = true;
        break;
      }
      expect(res.status).toBe(401); // generic failure, never revealing validity
    }
    expect(sawRateLimit).toBe(true);
  });
});
