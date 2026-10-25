import { defineConfig, devices } from '@playwright/test';
import { apiPort, webPort, channel, demoEnvironment, sharedConfig } from './tests/e2e/environment.js';

export default defineConfig({
  ...sharedConfig,
  testDir: './tests/e2e/public',
  outputDir: './test-results/public',
  use: { ...sharedConfig.use, baseURL: `http://127.0.0.1:${webPort}` },
  projects: [
    { name: 'desktop', testIgnore: '**/mobile.spec.js', use: { ...devices['Desktop Chrome'], channel } },
    { name: 'mobile', testMatch: '**/mobile.spec.js', use: { ...devices['Pixel 7'], channel } },
  ],
  webServer: [
    {
      command: 'node server/dev.js',
      url: `http://127.0.0.1:${apiPort}/api/health`,
      env: { ...demoEnvironment, API_PORT: String(apiPort) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'node tests/e2e/serve-demo.mjs',
      url: `http://127.0.0.1:${webPort}`,
      env: demoEnvironment,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
