import { randomUUID } from 'node:crypto';
import type {
  AuthRepositories,
  CreateSessionInput,
  MfaFactorRecord,
  SessionRecord,
  UserWithSecret,
} from '../../src/auth/types';

// In-memory repositories for unit tests. No database required.
export function createFakeRepositories(): AuthRepositories & { seedUser(u: UserWithSecret): void } {
  const usersById = new Map<string, UserWithSecret>();
  const usersByEmail = new Map<string, UserWithSecret>();
  const sessionsByHash = new Map<string, SessionRecord>();
  const sessionsById = new Map<string, SessionRecord>();
  const factors = new Map<string, MfaFactorRecord>();
  const recovery = new Map<string, { userId: string; usedAt: Date | null }>();

  return {
    users: {
      async findById(id) {
        return usersById.get(id) ?? null;
      },
      async findByEmail(email) {
        return usersByEmail.get(email) ?? null;
      },
    },
    sessions: {
      async findByTokenHash(hash) {
        return sessionsByHash.get(hash) ?? null;
      },
      async create(input: CreateSessionInput) {
        const record: SessionRecord = {
          id: randomUUID(),
          organizationId: input.organizationId,
          userId: input.userId,
          tokenHash: input.tokenHash,
          csrfToken: input.csrfToken,
          expiresAt: input.expiresAt,
          absoluteExpiresAt: input.absoluteExpiresAt,
          revokedAt: null,
          mfaVerifiedAt: null,
        };
        sessionsByHash.set(record.tokenHash, record);
        sessionsById.set(record.id, record);
        return record;
      },
      async revokeByTokenHash(hash) {
        const s = sessionsByHash.get(hash);
        if (s) s.revokedAt = new Date();
      },
      async revokeAllForUser(userId) {
        for (const s of sessionsByHash.values()) if (s.userId === userId) s.revokedAt = new Date();
      },
      async setMfaVerified(id, at) {
        const s = sessionsById.get(id);
        if (s) s.mfaVerifiedAt = at;
      },
      async touch(id, at, newIdleExpiry) {
        const s = sessionsById.get(id);
        if (s) s.expiresAt = newIdleExpiry;
        void at;
      },
      async cleanupExpiredSessions(now) {
        let removed = 0;
        for (const [hash, s] of sessionsByHash) {
          if (s.absoluteExpiresAt.getTime() < now.getTime()) {
            sessionsByHash.delete(hash);
            sessionsById.delete(s.id);
            removed++;
          }
        }
        return removed;
      },
    },
    mfa: {
      async getFactor(userId, type) {
        return factors.get(`${userId}:${type}`) ?? null;
      },
      async upsertFactor(input) {
        const record: MfaFactorRecord = {
          id: randomUUID(),
          userId: input.userId,
          type: input.type,
          secret: input.secret,
          verifiedAt: null,
          lastTotpStep: null,
        };
        factors.set(`${input.userId}:${input.type}`, record);
        return record;
      },
      async claimTotpStep(userId, type, step, at) {
        const f = factors.get(`${userId}:${type}`);
        if (!f) return false;
        if (f.lastTotpStep !== null && f.lastTotpStep >= step) return false;
        f.lastTotpStep = step;
        f.verifiedAt = at;
        return true;
      },
    },
    recovery: {
      async listHashesForUser(userId) {
        return [...recovery.entries()]
          .filter(([, v]) => v.userId === userId && v.usedAt === null)
          .map(([hash]) => hash);
      },
      async replaceForUser(_org, userId, hashes) {
        for (const [hash, v] of recovery) if (v.userId === userId) recovery.delete(hash);
        for (const hash of hashes) recovery.set(hash, { userId, usedAt: null });
      },
      async claimRecoveryCode(hash, at) {
        const r = recovery.get(hash);
        if (!r || r.usedAt !== null) return false;
        r.usedAt = at;
        return true;
      },
    },
    seedUser(u) {
      usersById.set(u.id, u);
      usersByEmail.set(u.email, u);
    },
  };
}
