import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '../web-assessment/e2e', testMatch: 'workflows.spec.js',
  fullyParallel: false, workers: 1, timeout: 45000,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  reporter: [['list'], ['html', { outputFolder: '../../../tests/NonFunctionalAssessment/evidence/compatibility/report', open: 'never' }]],
  outputDir: '../../../tests/NonFunctionalAssessment/evidence/compatibility/results',
  use: { baseURL: 'http://127.0.0.1:4180', screenshot: 'on', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4180 --strictPort', url: 'http://127.0.0.1:4180', reuseExistingServer: false },
});
