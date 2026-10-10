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
  secret: string;
  verifiedAt: Date | null;
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
  touch(sessionId: string, at: Date): Promise<void>;
}

export interface MfaRepository {
  getFactor(userId: string, type: string): Promise<MfaFactorRecord | null>;
  upsertFactor(input: {
    organizationId: string;
    userId: string;
    type: string;
    secret: string;
  }): Promise<MfaFactorRecord>;
  markVerified(userId: string, type: string, at: Date): Promise<void>;
}

export interface RecoveryCodeRepository {
  listHashesForUser(userId: string): Promise<string[]>;
  replaceForUser(organizationId: string, userId: string, hashes: string[]): Promise<void>;
  markUsedByHash(hash: string, at: Date): Promise<void>;
}

export interface AuthRepositories {
  users: UserRepository;
  sessions: SessionRepository;
  mfa: MfaRepository;
  recovery: RecoveryCodeRepository;
}
