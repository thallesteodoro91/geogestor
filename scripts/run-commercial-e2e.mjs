import fs from 'node:fs';
import net from 'node:net';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  initializeManagedE2eRun,
  preserveFailedE2eRun,
  removeSuccessfulE2eRun
} from './e2e-artifacts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratchRoot = path.resolve(root, 'scratch');
const runId = `run-${Date.now()}-${process.pid}-${crypto.randomUUID()}`;
const e2eRoot = path.resolve(scratchRoot, 'commercial-e2e', runId);
const specsRoot = path.join(e2eRoot, 'specs');
const webDist = path.join(e2eRoot, 'web-dist');
const commercialE2eRoot = path.resolve(scratchRoot, 'commercial-e2e');
initializeManagedE2eRun(commercialE2eRoot, e2eRoot, { command: process.argv.slice(2), isolation: 'database-per-spec-file' });

const PASSWORD = 'GeoGestor-E2E-2026';
const SETUP_SPEC = 'setup-initial.spec.ts';
const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== '--');

async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Não foi possível reservar uma porta E2E.'));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

const apiPort = await findAvailablePort();
const webPort = await findAvailablePort();
const requireFromApi = createRequire(path.join(root, 'apps', 'api', 'package.json'));
const requireFromWeb = createRequire(path.join(root, 'apps', 'web', 'package.json'));
const requireFromRoot = createRequire(path.join(root, 'package.json'));
const tsxCli = requireFromApi.resolve('tsx/cli');
const tscCli = requireFromWeb.resolve('typescript/bin/tsc');
const viteCli = path.resolve(path.dirname(requireFromWeb.resolve('vite')), '../../bin/vite.js');
const playwrightCli = requireFromRoot.resolve('@playwright/test/cli');
const apiEntry = path.join(root, 'apps', 'api', 'src', 'server.ts');
const webOrigin = `http://127.0.0.1:${webPort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const referenceDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const baseEnv = {
  ...process.env,
  GEOGESTOR_E2E_RUN_ROOT: e2eRoot,
  GEOGESTOR_E2E_WEB_DIST: webDist,
  GEOGESTOR_E2E_API_PORT: String(apiPort),
  GEOGESTOR_E2E_WEB_PORT: String(webPort),
  GEOGESTOR_E2E_REFERENCE_DATE: referenceDate,
  GEOGESTOR_DISABLE_SCHEDULER: '1',
  VITE_API_URL: apiOrigin
};

function run(label, executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    env: baseEnv,
    stdio: 'inherit',
    ...options
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} falhou com código ${result.status ?? 'desconhecido'}.`);
}

function start(executable, args, env, stdio = 'inherit') {
  return spawn(executable, args, { cwd: root, env, stdio, windowsHide: true });
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // O serviço ainda está inicializando.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Tempo esgotado aguardando ${url}.`);
}

function waitForExit(child, timeoutMs) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function stopProcessTree(child, { ipcMessage } = {}) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (ipcMessage && child.connected) child.send(ipcMessage);
  else if (!child.killed) child.kill('SIGTERM');
  if (await waitForExit(child, 8_000)) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  } else if (!child.killed) {
    child.kill('SIGKILL');
  }
  await waitForExit(child, 2_000);
}

function slugifySpec(specFile, index) {
  const base = path.basename(specFile, '.spec.ts').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  return `run-${String(index + 1).padStart(2, '0')}-${base}`;
}

function selectedSpecFiles() {
  const explicit = forwardedArgs.filter((argument) => argument.endsWith('.spec.ts')).map((argument) => path.basename(argument));
  const all = fs.readdirSync(path.join(root, 'tests', 'e2e'))
    .filter((name) => name.endsWith('.spec.ts'))
    .sort((left, right) => left.localeCompare(right));
  const selected = explicit.length > 0 ? all.filter((name) => explicit.includes(name)) : all;
  if (selected.length === 0) throw new Error('Nenhuma spec E2E foi selecionada.');
  return selected.includes(SETUP_SPEC) ? [SETUP_SPEC, ...selected.filter((name) => name !== SETUP_SPEC)] : selected;
}

async function ensureSpecConfiguration(specRoot) {
  const created = await fetch(`${apiOrigin}/api/configuracoes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      empresaNome: 'SkyGeo E2E',
      dadosPasta: path.join(specRoot, 'files'),
      adminNome: 'Thalles E2E',
      adminEmail: 'thalles.e2e@example.test',
      adminSenha: PASSWORD
    })
  });
  if (created.ok) return;
  if (created.status !== 409) {
    throw new Error(`Bootstrap idempotente da spec falhou (${created.status}): ${await created.text()}`);
  }

  const unlocked = await fetch(`${apiOrigin}/api/auth/unlock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD })
  });
  if (!unlocked.ok) {
    throw new Error(`A raiz descartável já estava configurada, mas não pôde ser validada (${unlocked.status}).`);
  }
  const session = await unlocked.json();
  const response = await fetch(`${apiOrigin}/api/configuracoes`, {
    headers: { 'x-local-session': session.token }
  });
  if (!response.ok) throw new Error(`Não foi possível consultar a configuração E2E (${response.status}).`);
  const current = await response.json();
  if (current?.empresaNome !== 'SkyGeo E2E' || current.dadosPasta !== path.join(specRoot, 'files')) {
    throw new Error('A raiz descartável da spec contém uma configuração inesperada.');
  }
}

function collectResult(specFile, specRoot, exitCode) {
  const resultPath = path.join(specRoot, 'playwright-results.json');
  const parsed = fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, 'utf8')) : null;
  const stats = parsed?.stats || { expected: 0, skipped: 0, unexpected: 0, flaky: 0 };
  if (exitCode !== 0 && Number(stats.unexpected || 0) === 0) stats.unexpected = 1;
  return {
    specFile,
    specRoot: path.relative(e2eRoot, specRoot),
    exitCode,
    stats,
    errors: parsed?.errors || []
  };
}

run('TypeScript web', process.execPath, [tscCli, '-b'], { cwd: path.join(root, 'apps', 'web') });
run('Build web E2E', process.execPath, [viteCli, 'build', '--outDir', webDist, '--emptyOutDir'], { cwd: path.join(root, 'apps', 'web') });

const web = start(process.execPath, [
  viteCli, 'preview', '--outDir', webDist, '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'
], { ...baseEnv, NODE_ENV: 'production' });
let activeApi;
let stopping = false;
const stopAll = async () => {
  if (stopping) return;
  stopping = true;
  await Promise.all([stopProcessTree(web), stopProcessTree(activeApi, { ipcMessage: { type: 'geogestor:e2e-shutdown' } })]);
};
const handleSignal = () => void stopAll();
process.once('SIGINT', handleSignal);
process.once('SIGTERM', handleSignal);

let exitCode = 0;
let failure;
const results = [];
try {
  await waitForUrl(webOrigin, 60_000);
  const specs = selectedSpecFiles();
  for (const [index, specFile] of specs.entries()) {
    const specRoot = path.join(specsRoot, slugifySpec(specFile, index));
    const evidenceRoot = path.join(specRoot, 'evidence');
    fs.mkdirSync(evidenceRoot, { recursive: true });
    const specEnv = {
      ...baseEnv,
      GEOGESTOR_E2E_ROOT: specRoot,
      GEOGESTOR_E2E_EVIDENCE_DIR: evidenceRoot,
      GEOGESTOR_S04_EVIDENCE_DIR: evidenceRoot,
      GEOGESTOR_S06_EVIDENCE_DIR: evidenceRoot,
      GEOGESTOR_S11_EVIDENCE_DIR: evidenceRoot
    };
    const apiOut = fs.openSync(path.join(specRoot, 'api.log'), 'a');
    const apiErr = fs.openSync(path.join(specRoot, 'api-error.log'), 'a');
    activeApi = start(process.execPath, [tsxCli, apiEntry], {
      ...specEnv,
      NODE_ENV: 'development',
      PORT: String(apiPort),
      GEOGESTOR_DB_PATH: path.join(specRoot, 'geogestor.db'),
      GEOGESTOR_REQUIRE_UNLOCK: '1',
      GEOGESTOR_AUTH_DISABLED: '0',
      GEOGESTOR_WEB_ORIGIN: webOrigin
    }, ['ignore', apiOut, apiErr, 'ipc']);
    fs.closeSync(apiOut);
    fs.closeSync(apiErr);
    try {
      await waitForUrl(`${apiOrigin}/api/ready`, 120_000);
      if (specFile !== SETUP_SPEC) await ensureSpecConfiguration(specRoot);
      console.log(`[E2E] ${index + 1}/${specs.length} ${specFile} — banco isolado ${path.basename(specRoot)}`);
      const project = specFile === SETUP_SPEC ? 'configuracao-inicial' : 'aplicacao';
      const passthrough = forwardedArgs.filter((argument) => !argument.endsWith('.spec.ts'));
      const result = spawnSync(process.execPath, [
        playwrightCli, 'test', '--config', 'playwright.config.ts', specFile,
        '--project', project, '--no-deps', ...passthrough
      ], { cwd: root, env: specEnv, stdio: 'inherit' });
      if (result.error) throw result.error;
      const specExitCode = result.status ?? 1;
      results.push(collectResult(specFile, specRoot, specExitCode));
      if (specExitCode !== 0) exitCode = 1;
    } finally {
      await stopProcessTree(activeApi, { ipcMessage: { type: 'geogestor:e2e-shutdown' } });
      activeApi = undefined;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const totals = results.reduce((summary, result) => ({
    expected: summary.expected + Number(result.stats.expected || 0),
    skipped: summary.skipped + Number(result.stats.skipped || 0),
    unexpected: summary.unexpected + Number(result.stats.unexpected || 0),
    flaky: summary.flaky + Number(result.stats.flaky || 0),
    files: summary.files + 1
  }), { expected: 0, skipped: 0, unexpected: 0, flaky: 0, files: 0 });
  fs.writeFileSync(path.join(e2eRoot, 'run-summary.json'), `${JSON.stringify({ isolation: 'database-per-spec-file', referenceDate, totals, results }, null, 2)}\n`, 'utf8');
  console.log(`[E2E] Resumo isolado: ${totals.expected} aprovados, ${totals.unexpected} falhas, ${totals.skipped} não executados em ${totals.files} specs.`);
  if (exitCode !== 0) failure = new Error(`Suíte isolada terminou com ${totals.unexpected} falha(s) e ${totals.skipped} caso(s) não executado(s).`);
} catch (error) {
  exitCode = 1;
  failure = error;
  console.error(error);
} finally {
  process.removeListener('SIGINT', handleSignal);
  process.removeListener('SIGTERM', handleSignal);
  await stopAll();
  if (exitCode === 0) {
    fs.copyFileSync(path.join(e2eRoot, 'run-summary.json'), path.join(commercialE2eRoot, 'latest-successful-summary.json'));
    removeSuccessfulE2eRun(commercialE2eRoot, e2eRoot);
    console.log(`[E2E] Execução aprovada e resíduos próprios removidos: ${path.basename(e2eRoot)}`);
  } else {
    preserveFailedE2eRun(commercialE2eRoot, e2eRoot, failure);
    console.error(`[E2E] Evidências da falha preservadas em ${e2eRoot}`);
  }
}

process.exitCode = exitCode;
