import { describe, it, expect } from 'vitest';
import { generateTotp, generateTotpSecret, totpKeyUri, verifyTotp } from '../../src/lib/totp';

describe('TOTP MFA', () => {
  it('verifies a valid current code', () => {
    const secret = generateTotpSecret();
    const token = generateTotp(secret);
    expect(verifyTotp(secret, token)).toBe(true);
  });

  it('rejects a code from a different secret', () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const token = generateTotp(secretA);
    expect(verifyTotp(secretB, token)).toBe(false);
  });

  it('rejects an expired code (outside the window)', () => {
    const secret = generateTotpSecret();
    const t0 = 1_700_000_000_000;
    const token = generateTotp(secret, t0);
    expect(verifyTotp(secret, token, t0)).toBe(true);
    expect(verifyTotp(secret, token, t0 + 10 * 60 * 1000)).toBe(false);
  });

  it('rejects malformed input without throwing', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, 'not-a-code')).toBe(false);
    expect(verifyTotp('', '123456')).toBe(false);
  });

  it('builds an otpauth key URI', () => {
    const secret = generateTotpSecret();
    const uri = totpKeyUri('admin@example.com', 'HVAC CMMS', secret);
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
  });
});
