import { describe, it, expect } from 'vitest';
import { generateSessionToken, hashSessionToken } from '../../src/lib/session-token';

describe('session tokens', () => {
  it('generates a token and a distinct hash', () => {
    const { token, tokenHash } = generateSessionToken();
    expect(token).toBeTruthy();
    expect(tokenHash).toBeTruthy();
    expect(tokenHash).not.toBe(token);
  });

  it('hashes deterministically', () => {
    const { token, tokenHash } = generateSessionToken();
    expect(hashSessionToken(token)).toBe(tokenHash);
  });

  it('generates unique tokens', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSessionToken().token));
    expect(tokens.size).toBe(50);
  });
});
