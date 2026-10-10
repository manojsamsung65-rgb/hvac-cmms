import pino from 'pino';
import { env } from '../config/env';

// Structured logger. Silent during tests to keep output clean. Sensitive
// headers (cookies, authorization, set-cookie) are redacted from logs.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    censor: '[redacted]',
  },
});
