import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], test: {
  environment: 'jsdom', include: ['tests/web-assessment/unit/**/*.spec.jsx'],
  setupFiles: ['tests/web-assessment/setup.js'],
  reporters: ['default', 'json'], outputFile: 'tests/web-assessment/evidence/vitest-results.json',
} });
