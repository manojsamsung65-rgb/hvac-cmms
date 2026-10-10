import rateLimit from 'express-rate-limit';

// Per-account + per-IP limiter. Keyed by the authenticated user id (when present)
// and the client IP. `validate` is disabled because the client IP is governed by
// the explicit TRUST_PROXY configuration rather than express-rate-limit's defaults.
export function createAccountLimiter(options: { windowMs: number; limit: number }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    keyGenerator: (req) => {
      const userId = req.auth?.userId ?? 'anon';
      return `${userId}:${req.ip ?? 'unknown'}`;
    },
    message: { error: { code: 'rate_limited', message: 'Too many attempts, try again later' } },
  });
}
