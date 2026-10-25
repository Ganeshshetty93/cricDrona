import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

// Existing process values override .env files in Node and Vite. Never point these
// UI suites at real accounts, even when the development app is configured.
export const demoEnvironment = Object.fromEntries([
  'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY',
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY',
].map(key => [key, '']));
export const apiPort = Number(process.env.E2E_API_PORT || 3101);
export const webPort = Number(process.env.E2E_WEB_PORT || 5183);
const edgeInstalled = process.platform === 'win32' && [
  process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES, process.env.LOCALAPPDATA,
].filter(Boolean).some(root => existsSync(join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')));
export const channel = process.env.PLAYWRIGHT_CHANNEL || (
  !existsSync(chromium.executablePath()) && edgeInstalled ? 'msedge' : undefined
);

export const sharedConfig = {
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 45_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
};
