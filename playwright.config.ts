import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const root = __dirname;
const webPort = Number(process.env.GEOGESTOR_E2E_WEB_PORT || 4173);
const e2eRoot = process.env.GEOGESTOR_E2E_ROOT || path.join(root, 'scratch', 'commercial-e2e');
const webOrigin = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  outputDir: path.join(e2eRoot, 'test-results'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: path.join(e2eRoot, 'playwright-results.json') }]],
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: webOrigin,
    ...devices['Desktop Edge'],
    channel: 'msedge',
    viewport: { width: 1120, height: 680 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
    locale: 'pt-BR'
  }
});
