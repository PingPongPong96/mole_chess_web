import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['tests-api/**/*.spec.mjs', 'tests-e2e/**/*.spec.mjs'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: {
    timeout: 10_000
  },
  globalSetup: './tests-support/runner/global-setup.mjs',
  outputDir: 'test-results',
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 20_000,
    headless: true,
    viewport: { width: 1366, height: 900 }
  }
});

