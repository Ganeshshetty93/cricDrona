import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, defineConfig, devices } from '@playwright/test';
import { demoEnvironment, apiPort, webPort } from './tests/e2e/demo-environment.js';

const edgeInstalled = process.platform === 'win32' && [
  process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES, process.env.LOCALAPPDATA,
].filter(Boolean).some(root => existsSync(join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')));
const channel = process.env.PLAYWRIGHT_CHANNEL || (
  !existsSync(chromium.executablePath()) && edgeInstalled ? 'msedge' : undefined
);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: '**/mobile.spec.js',
      use: { ...devices['Desktop Chrome'], channel },
    },
    {
      name: 'mobile',
      testMatch: '**/mobile.spec.js',
      use: { ...devices['Pixel 7'], channel },
    },
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
