import { getPrisma } from '../lib/prisma';
import { createPrismaRepositories } from './prisma';
import type { AuthRepositories } from '../auth/types';

// Builds the production repository bundle backed by Prisma.
export function createProductionRepositories(): AuthRepositories {
  return createPrismaRepositories(getPrisma());
}
