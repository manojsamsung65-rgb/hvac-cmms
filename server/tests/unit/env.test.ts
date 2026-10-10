import { describe, it, expect } from 'vitest';
import { loadEnv } from '../../src/config/env';

describe('environment validation', () => {
  it('applies defaults for an empty environment', () => {
    const parsed = loadEnv({});
    expect(parsed.PORT).toBe(4000);
    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.CORS_ORIGIN).toBe('http://localhost:5173');
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => loadEnv({ PORT: 'not-a-number' })).toThrow(/Invalid environment configuration/);
  });

  it('rejects a wildcard CORS origin (credentials are enabled)', () => {
    expect(() => loadEnv({ CORS_ORIGIN: '*' })).toThrow(/Invalid environment configuration/);
  });

  it('accepts a valid DATABASE_URL and SESSION_SECRET', () => {
    const parsed = loadEnv({ DATABASE_URL: 'postgresql://user:pass@localhost:5432/db', SESSION_SECRET: 'x'.repeat(32) });
    expect(parsed.DATABASE_URL).toBeDefined();
    expect(parsed.SESSION_SECRET).toHaveLength(32);
  });

  it('refuses TRUST_PROXY=true in production (would trust arbitrary forwarded headers)', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', TRUST_PROXY: 'true' })).toThrow(/TRUST_PROXY/);
  });

  it('allows a hop count for TRUST_PROXY in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', TRUST_PROXY: '1' })).not.toThrow();
  });
});
