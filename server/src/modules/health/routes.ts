import { Router } from 'express';
import { env } from '../../config/env';
import { getPrisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

export const healthRouter = Router();

// Liveness: the process is up. No dependencies checked.
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hvac-cmms-api', time: new Date().toISOString() });
});

// Readiness: verify dependencies. When DATABASE_URL is configured, a lightweight
// `SELECT 1` confirms connectivity; otherwise readiness reports the database as
// not configured. Authentication is NOT checked (not implemented yet).
healthRouter.get('/ready', async (_req, res) => {
  if (!env.DATABASE_URL) {
    res.json({ status: 'degraded', checks: { database: 'not_configured' } });
    return;
  }
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    res.json({ status: 'ok', checks: { database: 'ok' } });
  } catch (err) {
    logger.error({ err }, 'Readiness database check failed');
    res.status(503).json({ status: 'unavailable', checks: { database: 'error' } });
  }
});
