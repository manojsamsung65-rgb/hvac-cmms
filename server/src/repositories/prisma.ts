import type { PrismaClient } from '@prisma/client';
import { effectiveRole, isRole, type Role } from '../auth/policy';
import type {
  AuthRepositories,
  AuthUser,
  CreateSessionInput,
  MfaFactorRecord,
  SessionRecord,
  UserWithSecret,
} from '../auth/types';

function toRole(names: string[]): Role {
  return effectiveRole(names.filter(isRole));
}

export function createPrismaRepositories(prisma: PrismaClient): AuthRepositories {
  async function rolesOf(userId: string): Promise<string[]> {
    const rows = await prisma.userRole.findMany({ where: { userId }, include: { role: true } });
    return rows.map((r) => r.role.name);
  }

  return {
    users: {
      async findById(id: string): Promise<AuthUser | null> {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return null;
        return { id: user.id, organizationId: user.organizationId, role: toRole(await rolesOf(user.id)), isActive: user.isActive };
      },
      async findByEmail(email: string): Promise<UserWithSecret | null> {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        return {
          id: user.id,
          organizationId: user.organizationId,
          role: toRole(await rolesOf(user.id)),
          isActive: user.isActive,
          email: user.email,
          passwordHash: user.passwordHash,
        };
      },
    },
    sessions: {
      async findByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
        return prisma.session.findUnique({ where: { tokenHash } });
      },
      async create(input: CreateSessionInput): Promise<SessionRecord> {
        return prisma.session.create({ data: input });
      },
      async revokeByTokenHash(tokenHash: string): Promise<void> {
        await prisma.session.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
      },
      async revokeAllForUser(userId: string): Promise<void> {
        await prisma.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
      },
      async setMfaVerified(sessionId: string, at: Date): Promise<void> {
        await prisma.session.update({ where: { id: sessionId }, data: { mfaVerifiedAt: at } });
      },
      async touch(sessionId: string, at: Date, newIdleExpiry: Date): Promise<void> {
        await prisma.session.update({ where: { id: sessionId }, data: { lastUsedAt: at, expiresAt: newIdleExpiry } });
      },
      async cleanupExpiredSessions(now: Date): Promise<number> {
        const res = await prisma.session.deleteMany({ where: { absoluteExpiresAt: { lt: now } } });
        return res.count;
      },
    },
    mfa: {
      async getFactor(userId: string, type: string): Promise<MfaFactorRecord | null> {
        return prisma.mfaFactor.findUnique({ where: { userId_type: { userId, type } } });
      },
      async upsertFactor(input): Promise<MfaFactorRecord> {
        return prisma.mfaFactor.upsert({
          where: { userId_type: { userId: input.userId, type: input.type } },
          create: input,
          update: { secret: input.secret, verifiedAt: null, lastTotpStep: null },
        });
      },
      // Atomic compare-and-set: only succeeds if the stored step is null or older
      // than `step`. A concurrent caller that already advanced it makes count 0.
      async claimTotpStep(userId: string, type: string, step: number, at: Date): Promise<boolean> {
        const res = await prisma.mfaFactor.updateMany({
          where: { userId, type, OR: [{ lastTotpStep: null }, { lastTotpStep: { lt: step } }] },
          data: { lastTotpStep: step, verifiedAt: at },
        });
        return res.count === 1;
      },
    },
    recovery: {
      async listHashesForUser(userId: string): Promise<string[]> {
        const rows = await prisma.recoveryCode.findMany({ where: { userId, usedAt: null } });
        return rows.map((r) => r.codeHash);
      },
      async replaceForUser(organizationId: string, userId: string, hashes: string[]): Promise<void> {
        await prisma.$transaction([
          prisma.recoveryCode.deleteMany({ where: { userId } }),
          prisma.recoveryCode.createMany({ data: hashes.map((codeHash) => ({ organizationId, userId, codeHash })) }),
        ]);
      },
      async markUsedByHash(codeHash: string, at: Date): Promise<void> {
        await prisma.recoveryCode.updateMany({ where: { codeHash }, data: { usedAt: at } });
      },
    },
  };
}
