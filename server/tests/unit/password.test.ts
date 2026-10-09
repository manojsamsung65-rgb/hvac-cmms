import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, isPasswordAcceptable } from '../../src/lib/password';

describe('Argon2id password hashing', () => {
  it('hashes without storing the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toContain('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword(hash, 'correct horse battery staple')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword(hash, 'wrong password')).resolves.toBe(false);
  });

  it('fails closed on a malformed hash', async () => {
    await expect(verifyPassword('not-a-hash', 'anything')).resolves.toBe(false);
  });

  it('produces different hashes for the same password (unique salt)', async () => {
    const [a, b] = await Promise.all([hashPassword('same-password-123'), hashPassword('same-password-123')]);
    expect(a).not.toBe(b);
  });

  it('enforces a minimum length policy', () => {
    expect(isPasswordAcceptable('short')).toBe(false);
    expect(isPasswordAcceptable('long-enough-password')).toBe(true);
  });
});
