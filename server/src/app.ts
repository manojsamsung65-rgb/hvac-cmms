import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import type { PrismaClient } from '@prisma/client';
import { env, trustProxySetting } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createAuthRouter } from './modules/auth/routes';
import { createEquipmentModule } from './modules/equipment/routes';
import { getPrisma } from './lib/prisma';
import type { AuthRepositories } from './auth/types';

export interface AppDeps {
  repositories?: AuthRepositories;
  prisma?: PrismaClient;
}

export function createApp(deps: AppDeps = {}): Express {
  const app = express();

  // Trust only explicitly configured proxies; never arbitrary X-Forwarded-* headers.
  const trustProxy = trustProxySetting();
  if (trustProxy !== undefined) {
    app.set('trust proxy', trustProxy);
  }

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.use(apiRouter);

  if (deps.repositories) {
    app.use(createAuthRouter(deps.repositories));
    app.use(createEquipmentModule({ prisma: deps.prisma ?? getPrisma(), authRepositories: deps.repositories }));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
