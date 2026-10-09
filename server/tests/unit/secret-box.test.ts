import { describe, it, expect } from 'vitest';
import { decryptSecret, encryptSecret, isEncrypted, parseKey } from '../../src/lib/secret-box';

const KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
const OTHER_KEY = 'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU=';

describe('secret box (AES-256-GCM)', () => {
  it('round-trips a secret', () => {
    const cipher = encryptSecret('JBSWY3DPEHPK3PXP', KEY);
    expect(cipher).not.toContain('JBSWY3DPEHPK3PXP');
    expect(isEncrypted(cipher)).toBe(true);
    expect(decryptSecret(cipher, KEY)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('produces different ciphertext each time (random IV)', () => {
    expect(encryptSecret('same', KEY)).not.toBe(encryptSecret('same', KEY));
  });

  it('fails to decrypt with the wrong key', () => {
    const cipher = encryptSecret('secret-value', KEY);
    expect(() => decryptSecret(cipher, OTHER_KEY)).toThrow();
  });

  it('fails on tampered ciphertext (authenticated encryption)', () => {
    const cipher = encryptSecret('secret-value', KEY);
    const parts = cipher.split('.');
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA');
    expect(() => decryptSecret(parts.join('.'), KEY)).toThrow();
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => parseKey('c2hvcnQ=')).toThrow();
  });
});
