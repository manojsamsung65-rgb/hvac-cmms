import { Router } from 'express';
import { healthRouter } from './modules/health/routes';

export const apiRouter = Router();

// Public routes only in this milestone. Protected module routes are added later,
// each behind requireAuth + tenant scoping.
apiRouter.use(healthRouter);
