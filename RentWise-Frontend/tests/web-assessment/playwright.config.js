import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 30000,
  reporter: [['list'], ['html', { outputFolder: './evidence/playwright-report', open: 'never' }]],
  outputDir: './evidence/browser-results',
  use: { baseURL: 'http://127.0.0.1:4178', browserName: 'chromium', headless: true, screenshot: 'on', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4178 --strictPort', url: 'http://127.0.0.1:4178', reuseExistingServer: !process.env.CI },
});
