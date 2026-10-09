import { describe, it, expect } from 'vitest';
import { consumeRecoveryCode, generateRecoveryCodes, hashRecoveryCode } from '../../src/lib/recovery-codes';

describe('MFA recovery codes', () => {
  it('generates the requested number of unique codes', () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it('stores only hashes (never the plaintext code)', () => {
    const [code] = generateRecoveryCodes(1);
    const hash = hashRecoveryCode(code);
    expect(hash).not.toBe(code);
    expect(hash).not.toContain(code.replace(/-/g, ''));
  });

  it('accepts a valid code and rejects an invalid one', () => {
    const codes = generateRecoveryCodes(3);
    const hashes = codes.map(hashRecoveryCode);
    expect(consumeRecoveryCode(codes[0], hashes).ok).toBe(true);
    expect(consumeRecoveryCode('AAAAA-BBBBB-CCCCC-DDDDD', hashes).ok).toBe(false);
  });

  it('rejects a replayed code (single-use)', () => {
    const codes = generateRecoveryCodes(3);
    const hashes = codes.map(hashRecoveryCode);
    const first = consumeRecoveryCode(codes[1], hashes);
    expect(first.ok).toBe(true);
    expect(first.remaining).toHaveLength(2);
    const replay = consumeRecoveryCode(codes[1], first.remaining);
    expect(replay.ok).toBe(false);
  });
});
