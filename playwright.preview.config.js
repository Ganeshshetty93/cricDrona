import { defineConfig, devices } from '@playwright/test';
import { channel, demoEnvironment, sharedConfig } from './tests/e2e/environment.js';
const port = process.env.DESIGN_PORT || '5194';

export default defineConfig({
  ...sharedConfig,
  testDir: './tests/e2e/preview',
  outputDir: './test-results/preview',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/preview' }]],
  use: { ...sharedConfig.use, baseURL: `http://127.0.0.1:${port}` },
  projects: [
    { name: 'preview-desktop', testIgnore: '**/mobile.spec.js', use: { ...devices['Desktop Chrome'], channel } },
    { name: 'preview-mobile', testMatch: '**/mobile.spec.js', use: { ...devices['Pixel 7'], channel } },
  ],
  webServer: {
    command: 'node scripts/design-preview.mjs',
    url: `http://127.0.0.1:${port}`,
    env: { ...demoEnvironment, DESIGN_PORT: port },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
