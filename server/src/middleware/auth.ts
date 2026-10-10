import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './errorHandler';

// PLACEHOLDER - authentication is NOT implemented. This documents the intended
// contract. It must be replaced by a real server-side session check (with
// tests) before any protected route is exposed. It is intentionally NOT mounted
// on any route yet.
export function requireAuth(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(501, 'Authentication is not implemented yet', 'not_implemented'));
}
