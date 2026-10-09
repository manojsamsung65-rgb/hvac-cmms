import { defineConfig, devices } from '@playwright/test';

// E2E configuration. Browser install/run is intentionally not part of the
// initial CI job; add a dedicated Playwright workflow when E2E starts.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
