import { HttpError } from '../middleware/errorHandler';
import { hashPassword, verifyPassword } from '../lib/password';
import { generateSessionToken, hashSessionToken } from '../lib/session-token';
import { generateCsrfToken } from '../lib/csrf';
import { generateTotpSecret, totpKeyUri, verifyTotp } from '../lib/totp';
import { consumeRecoveryCode, generateRecoveryCodes, hashRecoveryCode } from '../lib/recovery-codes';
import { effectiveRole, type Role } from './policy';
import type { AuthRepositories, AuthUser, SessionRecord } from './types';

const SESSION_IDLE_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MFA_ISSUER = 'HVAC CMMS';

// A dummy hash used to equalise timing when an account does not exist, so login
// does not reveal whether an email is registered.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$0000000000000000000000000000000000000000000';

export interface AuthServiceDeps extends AuthRepositories {
  now?: () => Date;
}

export interface LoginResult {
  token: string;
  csrfToken: string;
  user: { id: string; organizationId: string; role: Role; aal: 'aal1' | 'aal2' };
}

export interface AuthenticatedContext {
  user: { id: string; organizationId: string; role: Role; aal: 'aal1' | 'aal2' };
  csrfToken: string;
}

function invalidCredentials(): HttpError {
  return new HttpError(401, 'Invalid email or password', 'invalid_credentials');
}

export function createAuthService(deps: AuthServiceDeps) {
  const now = deps.now ?? (() => new Date());

  async function rolesForUser(userId: string): Promise<Role[]> {
    // Effective role is computed by the user repository; expose it via findById.
    const user = await deps.users.findById(userId);
    return user ? [user.role] : [];
  }

  return {
    async login(
      email: string,
      password: string,
      ctx: { ip?: string; userAgent?: string },
    ): Promise<LoginResult> {
      const user = await deps.users.findByEmail(email.toLowerCase().trim());
      if (!user || !user.passwordHash) {
        // Equalise timing for unknown accounts, then fail generically.
        await verifyPassword(DUMMY_HASH, password);
        throw invalidCredentials();
      }
      const ok = await verifyPassword(user.passwordHash, password);
      if (!ok || !user.isActive) {
        throw invalidCredentials();
      }
      const at = now();
      const { token, tokenHash } = generateSessionToken();
      const session = await deps.sessions.create({
        organizationId: user.organizationId,
        userId: user.id,
        tokenHash,
        csrfToken: generateCsrfToken(),
        expiresAt: new Date(at.getTime() + SESSION_IDLE_TTL_MS),
        absoluteExpiresAt: new Date(at.getTime() + SESSION_ABSOLUTE_TTL_MS),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return {
        token,
        csrfToken: session.csrfToken,
        user: { id: user.id, organizationId: user.organizationId, role: user.role, aal: 'aal1' },
      };
    },

    async logout(token: string): Promise<void> {
      await deps.sessions.revokeByTokenHash(hashSessionToken(token));
    },

    async contextForSession(session: SessionRecord): Promise<AuthenticatedContext> {
      const user = await deps.users.findById(session.userId);
      if (!user) throw new HttpError(401, 'Account is not active', 'unauthenticated');
      await deps.sessions.touch(session.id, now());
      return {
        user: {
          id: user.id,
          organizationId: user.organizationId,
          role: user.role,
          aal: session.mfaVerifiedAt ? 'aal2' : 'aal1',
        },
        csrfToken: session.csrfToken,
      };
    },

    async enrollMfa(user: AuthUser): Promise<{ secret: string; uri: string }> {
      const existing = await deps.mfa.getFactor(user.id, 'totp');
      const secret = existing?.secret ?? generateTotpSecret();
      if (!existing) {
        await deps.mfa.upsertFactor({
          organizationId: user.organizationId,
          userId: user.id,
          type: 'totp',
          secret,
        });
      }
      return { secret, uri: totpKeyUri(`user:${user.id}`, MFA_ISSUER, secret) };
    },

    async verifyMfa(user: AuthUser, session: SessionRecord, token: string): Promise<{ recoveryCodes: string[] }> {
      const factor = await deps.mfa.getFactor(user.id, 'totp');
      if (!factor) throw new HttpError(400, 'MFA is not enrolled', 'mfa_not_enrolled');
      if (!verifyTotp(factor.secret, token)) {
        throw new HttpError(401, 'Invalid MFA code', 'invalid_mfa_code');
      }
      const at = now();
      await deps.mfa.markVerified(user.id, 'totp', at);
      await deps.sessions.setMfaVerified(session.id, at);

      // Issue recovery codes once, on first successful verification.
      const existing = await deps.recovery.listHashesForUser(user.id);
      let recoveryCodes: string[] = [];
      if (existing.length === 0) {
        recoveryCodes = generateRecoveryCodes();
        await deps.recovery.replaceForUser(
          user.organizationId,
          user.id,
          recoveryCodes.map(hashRecoveryCode),
        );
      }
      return { recoveryCodes };
    },

    async consumeRecovery(user: AuthUser, session: SessionRecord, code: string): Promise<{ remaining: number }> {
      const hashes = await deps.recovery.listHashesForUser(user.id);
      const result = consumeRecoveryCode(code, hashes);
      if (!result.ok) {
        throw new HttpError(401, 'Invalid recovery code', 'invalid_recovery_code');
      }
      const consumedHash = hashes.find((h) => !result.remaining.includes(h));
      const at = now();
      if (consumedHash) await deps.recovery.markUsedByHash(consumedHash, at);
      await deps.sessions.setMfaVerified(session.id, at);
      return { remaining: result.remaining.length };
    },

    async hashNewPassword(password: string): Promise<string> {
      return hashPassword(password);
    },

    _rolesForUser: rolesForUser,
    _effectiveRole: effectiveRole,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
