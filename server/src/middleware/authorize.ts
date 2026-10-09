import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errorHandler';
import { can, type Action } from '../auth/policy';

// Role/action authorization. Denies when unauthenticated or when the role does
// not permit the action per the pure policy.
export function authorize(action: Action) {
  return function authorizeMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const auth = req.auth;
    if (!auth) {
      next(new HttpError(401, 'Authentication required', 'unauthenticated'));
      return;
    }
    if (!can(auth.role, action)) {
      next(new HttpError(403, 'Forbidden', 'forbidden'));
      return;
    }
    next();
  };
}
