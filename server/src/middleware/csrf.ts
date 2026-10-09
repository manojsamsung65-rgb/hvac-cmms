import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errorHandler';
import { verifyCsrfToken } from '../lib/csrf';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Double-submit CSRF: state-changing requests must carry a header matching the
// CSRF token bound to the session.
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const provided = req.header('x-csrf-token');
  const expected = req.session?.csrfToken;
  if (!verifyCsrfToken(provided, expected)) {
    next(new HttpError(403, 'Invalid CSRF token', 'csrf_failed'));
    return;
  }
  next();
}
