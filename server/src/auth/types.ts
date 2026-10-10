import type { Role } from './policy';

export interface AuthUser {
  id: string;
  organizationId: string;
  role: Role;
  isActive: boolean;
}

export interface UserWithSecret extends AuthUser {
  email: string;
  passwordHash: string | null;
}

export interface SessionRecord {
  id: string;
  organizationId: string;
  userId: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  mfaVerifiedAt: Date | null;
}

export interface CreateSessionInput {
  organizationId: string;
  userId: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  ip?: string;
  userAgent?: string;
}

export interface MfaFactorRecord {
  id: string;
  userId: string;
  type: string;
  secret: string; // encrypted at rest
  verifiedAt: Date | null;
  lastTotpStep: number | null;
}

export interface UserRepository {
  findById(id: string): Promise<AuthUser | null>;
  findByEmail(email: string): Promise<UserWithSecret | null>;
}

export interface SessionRepository {
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  create(input: CreateSessionInput): Promise<SessionRecord>;
  revokeByTokenHash(tokenHash: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  setMfaVerified(sessionId: string, at: Date): Promise<void>;
  touch(sessionId: string, at: Date, newIdleExpiry: Date): Promise<void>;
  cleanupExpiredSessions(now: Date): Promise<number>;
}

export interface MfaRepository {
  getFactor(userId: string, type: string): Promise<MfaFactorRecord | null>;
  upsertFactor(input: {
    organizationId: string;
    userId: string;
    type: string;
    secret: string; // encrypted
  }): Promise<MfaFactorRecord>;
  // Atomically claims a TOTP time-step. Returns true only if this call advanced
  // lastTotpStep to `step` (i.e. the step had not been used). This makes replay
  // protection safe under concurrent requests: exactly one caller can win.
  claimTotpStep(userId: string, type: string, step: number, at: Date): Promise<boolean>;
}

export interface RecoveryCodeRepository {
  listHashesForUser(userId: string): Promise<string[]>;
  replaceForUser(organizationId: string, userId: string, hashes: string[]): Promise<void>;
  // Atomically marks a recovery code used. Returns true only if this call was the
  // one that consumed it, so single-use holds under concurrent requests.
  claimRecoveryCode(codeHash: string, at: Date): Promise<boolean>;
}

export interface AuthRepositories {
  users: UserRepository;
  sessions: SessionRepository;
  mfa: MfaRepository;
  recovery: RecoveryCodeRepository;
}
