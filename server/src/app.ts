import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createAuthRouter } from './modules/auth/routes';
import type { AuthRepositories } from './auth/types';

export interface AppDeps {
  repositories?: AuthRepositories;
}

// When repositories are provided, the authentication routes are mounted. Health
// routes are always available. This keeps the app usable without a database.
export function createApp(deps: AppDeps = {}): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.use(apiRouter);

  if (deps.repositories) {
    app.use(createAuthRouter(deps.repositories));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
