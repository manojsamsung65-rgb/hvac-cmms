import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errorHandler';
import { SESSION_COOKIE, assuranceLevel, isSessionActive } from '../auth/session';
import { hashSessionToken } from '../lib/session-token';
import type { SessionRepository, UserRepository } from '../auth/types';

export interface RequireAuthDeps {
  sessions: SessionRepository;
  users: UserRepository;
  now?: () => Date;
}

// Factory so repositories can be injected (real Prisma repos in production,
// fakes in tests). Resolves the session cookie, validates it, loads the user,
// and attaches the authenticated context. The organisation id comes ONLY from
// the stored user record - never from client input.
export function createRequireAuth(deps: RequireAuthDeps) {
  const now = deps.now ?? (() => new Date());

  return async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
      if (!token) {
        throw new HttpError(401, 'Authentication required', 'unauthenticated');
      }
      const session = await deps.sessions.findByTokenHash(hashSessionToken(token));
      if (!session || !isSessionActive(session, now())) {
        throw new HttpError(401, 'Session is invalid or expired', 'unauthenticated');
      }
      const user = await deps.users.findById(session.userId);
      if (!user || !user.isActive) {
        throw new HttpError(401, 'Account is not active', 'unauthenticated');
      }
      req.auth = {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        aal: assuranceLevel(session),
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}
