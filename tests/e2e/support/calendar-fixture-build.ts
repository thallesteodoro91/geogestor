import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export async function buildCalendarFixture() {
  const root = process.env.GEOGESTOR_E2E_ROOT;
  if (!root || !path.resolve(root).startsWith(path.resolve('scratch/commercial-e2e') + path.sep)) throw Error('Fixture requer armazenamento isolado');
  const requireWeb = createRequire(path.resolve('apps/web/package.json'));
  const vite = await import(pathToFileURL(requireWeb.resolve('vite')).href);
  const react = (await import(pathToFileURL(requireWeb.resolve('@vitejs/plugin-react')).href)).default;
  const result = await vite.build({
    configFile: false, root: path.resolve('apps/web'), plugins: [react()], logLevel: 'error',
    define: { 'process.env.NODE_ENV': '"production"' },
    resolve: { alias: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'].map(name => ({ find: new RegExp('^' + name + '$'), replacement: requireWeb.resolve(name) })) },
    build: { write: false, minify: true, lib: { entry: path.resolve('tests/e2e/support/calendar-layout-fixture.tsx'), name: 'CalendarLayoutFixture', formats: ['iife'] } }
  });
  const output = (Array.isArray(result) ? result[0] : result).output;
  return output.find((item: { type: string }) => item.type === 'chunk').code as string;
}
