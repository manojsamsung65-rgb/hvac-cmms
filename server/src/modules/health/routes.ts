import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hvac-cmms-api', time: new Date().toISOString() });
});

// Readiness reports configuration state only. It does NOT yet verify database
// connectivity or authentication, which are not implemented in this milestone.
healthRouter.get('/ready', (_req, res) => {
  const database = process.env.DATABASE_URL ? 'configured' : 'not_configured';
  res.json({
    status: database === 'configured' ? 'ok' : 'degraded',
    checks: { database },
  });
});
