import { defineConfig, devices } from '@playwright/test';
import { channel, sharedConfig } from './tests/e2e/environment.js';
export default defineConfig({...sharedConfig,testDir:'./tests/e2e/auth',outputDir:'test-results/auth',reporter:[['list']],use:{...sharedConfig.use,...devices['Desktop Chrome'],channel,baseURL:'http://127.0.0.1:5185'},webServer:{command:'node tests/e2e/serve-auth.mjs',url:'http://127.0.0.1:5185',reuseExistingServer:false,timeout:60000}});
