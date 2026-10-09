import pino from 'pino';
import { env } from '../config/env';

// Structured logger. Silent during tests to keep output clean.
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
});
