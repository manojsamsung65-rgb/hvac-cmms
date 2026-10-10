import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errorHandler';

// Requires the session to have completed MFA (AAL2). Used on admin-class routes.
export function requireMfa(req: Request, _res: Response, next: NextFunction): void {
  const auth = req.auth;
  if (!auth) {
    next(new HttpError(401, 'Authentication required', 'unauthenticated'));
    return;
  }
  if (auth.aal !== 'aal2') {
    next(new HttpError(403, 'Multi-factor authentication required', 'mfa_required'));
    return;
  }
  next();
}
