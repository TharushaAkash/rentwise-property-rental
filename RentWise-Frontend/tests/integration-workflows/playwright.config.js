import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const file = path.join(root, 'tests/IntegrationAssessment/config.local.json');
if (!fs.existsSync(file)) throw new Error('Copy IntegrationAssessment/config.example.json to config.local.json and fill test credentials.');
const config = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
if (!config.apiBaseUrl?.endsWith('/api')) throw new Error('apiBaseUrl must end in /api');
export default defineConfig({
 testDir: '.', testMatch: 'workflows.spec.js', workers: 1, timeout: 90000,
 reporter: [['list'], ['html', { outputFolder: path.join(root, 'tests/IntegrationAssessment/evidence/playwright-report'), open: 'never' }]],
 outputDir: path.join(root, 'tests/IntegrationAssessment/evidence/browser-results'),
 // Traces can include login credentials; use screenshots and redacted attachments.
 use: { baseURL: 'http://127.0.0.1:4181', browserName: 'chromium', screenshot: 'on', trace: 'off' },
 webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4181 --strictPort', url: 'http://127.0.0.1:4181', reuseExistingServer: false, env: { VITE_API_URL: config.apiBaseUrl } },
});
