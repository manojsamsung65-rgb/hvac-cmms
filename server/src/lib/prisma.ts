import { PrismaClient } from '@prisma/client';

// Prisma client singleton. It is created lazily and does not connect until the
// first query, so importing it does not require a reachable database.
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) {
    client = new PrismaClient();
  }
  return client;
}
