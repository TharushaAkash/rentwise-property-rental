import { defineConfig } from '@playwright/test';
if (!process.env.LIVE_API_URL) throw new Error('Set LIVE_API_URL to the real ASP.NET API base URL ending in /api.');
export default defineConfig({
  testDir: './live', workers: 1, timeout: 60000,
  reporter: [['list'], ['html', { outputFolder: './evidence/live-playwright-report', open: 'never' }]],
  outputDir: './evidence/live-browser-results',
  use: { baseURL: 'http://127.0.0.1:4179', browserName: 'chromium', screenshot: 'on', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4179 --strictPort', url: 'http://127.0.0.1:4179', reuseExistingServer: false, env: { VITE_API_URL: process.env.LIVE_API_URL } },
});
