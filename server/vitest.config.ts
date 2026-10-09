import { defineConfig } from 'vitest/config';

// Test-only encryption key (32 bytes, base64). NOT a production secret.
const TEST_MFA_KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      MFA_ENCRYPTION_KEY: TEST_MFA_KEY,
    },
  },
});
