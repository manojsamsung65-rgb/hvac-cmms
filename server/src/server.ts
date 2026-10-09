import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { getPrisma } from './lib/prisma';
import { createProductionRepositories } from './repositories';

const app = createApp({ repositories: createProductionRepositories() });
const server: Server = app.listen(env.PORT, () => {
  logger.info(`hvac-cmms API listening on port ${env.PORT}`);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down');

  server.close(async () => {
    try {
      if (env.DATABASE_URL) {
        await getPrisma().$disconnect();
      }
    } catch (err) {
      logger.error({ err }, 'Error during shutdown');
    } finally {
      process.exit(0);
    }
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
