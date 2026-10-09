import { describe, it, expect } from 'vitest';
import { createAuthService } from '../../src/auth/service';
import { hashPassword } from '../../src/lib/password';
import { generateTotp } from '../../src/lib/totp';
import { hashSessionToken } from '../../src/lib/session-token';
import { createFakeRepositories } from '../helpers/fakes';
import type { UserWithSecret } from '../../src/auth/types';

const NOW = new Date('2026-10-10T00:00:00Z');

async function setup() {
  const repos = createFakeRepositories();
  const passwordHash = await hashPassword('correct horse battery staple');
  const user: UserWithSecret = {
    id: 'user-1',
    organizationId: 'org-1',
    role: 'admin',
    isActive: true,
    email: 'admin@example.com',
    passwordHash,
  };
  repos.seedUser(user);
  const service = createAuthService({ ...repos, now: () => NOW });
  return { repos, service, user };
}

describe('auth service', () => {
  it('logs in with correct credentials and creates a session', async () => {
    const { repos, service } = await setup();
    const result = await service.login('admin@example.com', 'correct horse battery staple', {});
    expect(result.user.organizationId).toBe('org-1');
    expect(result.token).toBeTruthy();
    const session = await repos.sessions.findByTokenHash(hashSessionToken(result.token));
    expect(session).not.toBeNull();
  });

  it('rejects a wrong password with a generic error', async () => {
    const { service } = await setup();
    await expect(service.login('admin@example.com', 'wrong', {})).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials',
    });
  });

  it('does not reveal whether an account exists', async () => {
    const { service } = await setup();
    await expect(service.login('nobody@example.com', 'whatever', {})).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });

  it('revokes the session on logout', async () => {
    const { repos, service } = await setup();
    const { token } = await service.login('admin@example.com', 'correct horse battery staple', {});
    await service.logout(token);
    const session = await repos.sessions.findByTokenHash(hashSessionToken(token));
    expect(session?.revokedAt).not.toBeNull();
  });

  it('enrolls and verifies MFA, issuing recovery codes once', async () => {
    const { repos, service, user } = await setup();
    const { token } = await service.login('admin@example.com', 'correct horse battery staple', {});
    const session = (await repos.sessions.findByTokenHash(hashSessionToken(token)))!;
    const { secret } = await service.enrollMfa(user);
    const { recoveryCodes } = await service.verifyMfa(user, session, generateTotp(secret));
    expect(recoveryCodes.length).toBeGreaterThan(0);
    expect(session.mfaVerifiedAt).not.toBeNull();
  });

  it('rejects an invalid MFA code', async () => {
    const { repos, service, user } = await setup();
    const { token } = await service.login('admin@example.com', 'correct horse battery staple', {});
    const session = (await repos.sessions.findByTokenHash(hashSessionToken(token)))!;
    await service.enrollMfa(user);
    await expect(service.verifyMfa(user, session, '000000')).rejects.toMatchObject({
      code: 'invalid_mfa_code',
    });
  });

  it('consumes a recovery code and rejects a replay', async () => {
    const { repos, service, user } = await setup();
    const { token } = await service.login('admin@example.com', 'correct horse battery staple', {});
    const session = (await repos.sessions.findByTokenHash(hashSessionToken(token)))!;
    const { secret } = await service.enrollMfa(user);
    const { recoveryCodes } = await service.verifyMfa(user, session, generateTotp(secret));

    const first = await service.consumeRecovery(user, session, recoveryCodes[0]);
    expect(first.remaining).toBe(recoveryCodes.length - 1);
    await expect(service.consumeRecovery(user, session, recoveryCodes[0])).rejects.toMatchObject({
      code: 'invalid_recovery_code',
    });
  });
});
