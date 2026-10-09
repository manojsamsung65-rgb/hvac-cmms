import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env';
import { HttpError } from '../../middleware/errorHandler';
import { createRequireAuth } from '../../middleware/requireAuth';
import { csrfProtection } from '../../middleware/csrf';
import { createAccountLimiter } from '../../middleware/rateLimit';
import { SESSION_COOKIE } from '../../auth/session';
import { createAuthService, type AuthService } from '../../auth/service';
import type { AuthRepositories, AuthUser } from '../../auth/types';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const tokenSchema = z.object({ token: z.string().min(6).max(10) });
const recoverySchema = z.object({ code: z.string().min(4) });

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function toUser(auth: NonNullable<Express.Request['auth']>): AuthUser {
  return { id: auth.userId, organizationId: auth.organizationId, role: auth.role, isActive: true };
}

export function createAuthRouter(repos: AuthRepositories, service?: AuthService): Router {
  const router = Router();
  const auth = service ?? createAuthService(repos);
  const requireAuth = createRequireAuth({ sessions: repos.sessions, users: repos.users });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { error: { code: 'rate_limited', message: 'Too many attempts, try again later' } },
  });
  // Per-account + per-IP limits on MFA verification and recovery-code use, to
  // resist brute force of 6-digit codes and recovery codes.
  const mfaVerifyLimiter = createAccountLimiter({ windowMs: 15 * 60 * 1000, limit: 5 });
  const mfaRecoveryLimiter = createAccountLimiter({ windowMs: 15 * 60 * 1000, limit: 5 });

  router.post('/auth/login', loginLimiter, async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const result = await auth.login(email, password, {
        ip: req.ip,
        userAgent: req.header('user-agent'),
      });
      res.cookie(SESSION_COOKIE, result.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_TTL_MS,
      });
      res.status(200).json({ user: result.user, csrfToken: result.csrfToken });
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/logout', requireAuth, csrfProtection, async (req, res, next) => {
    try {
      const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
      if (token) await auth.logout(token);
      res.clearCookie(SESSION_COOKIE, { path: '/' });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/auth/me', requireAuth, (req, res, next) => {
    try {
      if (!req.auth || !req.session) {
        throw new HttpError(401, 'Authentication required', 'unauthenticated');
      }
      res.json({ user: req.auth, csrfToken: req.session.csrfToken });
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/mfa/enroll', requireAuth, csrfProtection, async (req, res, next) => {
    try {
      if (!req.auth) throw new HttpError(401, 'Authentication required', 'unauthenticated');
      res.json(await auth.enrollMfa(toUser(req.auth)));
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/mfa/verify', requireAuth, mfaVerifyLimiter, csrfProtection, async (req, res, next) => {
    try {
      if (!req.auth || !req.session) throw new HttpError(401, 'Authentication required', 'unauthenticated');
      const { token } = tokenSchema.parse(req.body);
      res.json(await auth.verifyMfa(toUser(req.auth), req.session, token));
    } catch (err) {
      next(err);
    }
  });

  router.post('/auth/mfa/recovery', requireAuth, mfaRecoveryLimiter, csrfProtection, async (req, res, next) => {
    try {
      if (!req.auth || !req.session) throw new HttpError(401, 'Authentication required', 'unauthenticated');
      const { code } = recoverySchema.parse(req.body);
      res.json(await auth.consumeRecovery(toUser(req.auth), req.session, code));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
