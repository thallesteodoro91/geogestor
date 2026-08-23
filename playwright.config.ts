import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const root = __dirname;
const webPort = Number(process.env.GEOGESTOR_E2E_WEB_PORT || 4173);
const e2eRoot = process.env.GEOGESTOR_E2E_ROOT;
if (!e2eRoot || !/^run-[a-z0-9-]+$/i.test(path.basename(e2eRoot))) {
  throw new Error('Execute o Playwright por `pnpm run test:e2e` para obter uma raiz de evidências gerenciada.');
}
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
  },
  projects: [
    {
      name: 'configuracao-inicial',
      testMatch: '**/setup-initial.spec.ts'
    },
    {
      name: 'aplicacao',
      testIgnore: '**/setup-initial.spec.ts',
      dependencies: ['configuracao-inicial']
    }
  ]
});
