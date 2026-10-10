import type { Role } from './policy';

export interface AuthUser {
  id: string;
  organizationId: string;
  role: Role;
  isActive: boolean;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date; // idle expiry
  absoluteExpiresAt: Date; // hard cap
  revokedAt: Date | null;
  mfaVerifiedAt: Date | null;
}

export interface SessionRepository {
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
}

export interface UserRepository {
  findById(id: string): Promise<AuthUser | null>;
}
