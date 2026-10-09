import { describe, it, expect } from 'vitest';
import { generateCsrfToken, verifyCsrfToken } from '../../src/lib/csrf';

describe('CSRF tokens', () => {
  it('generates unique tokens', () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });

  it('accepts a matching token', () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token, token)).toBe(true);
  });

  it('rejects a mismatched token', () => {
    expect(verifyCsrfToken(generateCsrfToken(), generateCsrfToken())).toBe(false);
  });

  it('rejects missing or different-length input without throwing', () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(undefined, token)).toBe(false);
    expect(verifyCsrfToken(token, undefined)).toBe(false);
    expect(verifyCsrfToken('short', token)).toBe(false);
  });
});
