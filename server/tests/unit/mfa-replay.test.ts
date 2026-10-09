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
  const user: UserWithSecret = {
    id: 'user-1',
    organizationId: 'org-1',
    role: 'admin',
    isActive: true,
    email: 'admin@example.com',
    passwordHash: await hashPassword('correct horse battery staple'),
  };
  repos.seedUser(user);
  const service = createAuthService({ ...repos, now: () => NOW });
  return { repos, service, user };
}

describe('MFA replay protection', () => {
  it('rejects replaying the same TOTP code', async () => {
    const { repos, service, user } = await setup();
    const { token } = await service.login('admin@example.com', 'correct horse battery staple', {});
    const session = (await repos.sessions.findByTokenHash(hashSessionToken(token)))!;
    const { secret } = await service.enrollMfa(user);
    const code = generateTotp(secret);

    await expect(service.verifyMfa(user, session, code)).resolves.toBeDefined();
    // Same code, same time step -> rejected.
    await expect(service.verifyMfa(user, session, code)).rejects.toMatchObject({
      code: 'invalid_mfa_code',
    });
  });

  it('stores the TOTP secret encrypted, not in plaintext', async () => {
    const { repos, service, user } = await setup();
    const { secret } = await service.enrollMfa(user);
    const factor = await repos.mfa.getFactor(user.id, 'totp');
    expect(factor?.secret).not.toBe(secret);
    expect(factor?.secret.startsWith('v1.')).toBe(true);
  });
});
