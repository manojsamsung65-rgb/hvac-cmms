import pinoHttp from 'pino-http';
import { logger } from '../lib/logger';

// Attaches a structured request logger (correlation id, method, path, status).
export const requestLogger = pinoHttp({ logger });
