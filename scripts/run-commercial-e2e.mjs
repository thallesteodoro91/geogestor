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
const webDist = path.join(e2eRoot, 'web-dist');
const commercialE2eRoot = path.resolve(scratchRoot, 'commercial-e2e');
initializeManagedE2eRun(commercialE2eRoot, e2eRoot, { command: process.argv.slice(2) });

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
const sharedEnv = {
  ...process.env,
  GEOGESTOR_E2E_ROOT: e2eRoot,
  GEOGESTOR_E2E_WEB_DIST: webDist,
  GEOGESTOR_E2E_API_PORT: String(apiPort),
  GEOGESTOR_E2E_WEB_PORT: String(webPort),
  GEOGESTOR_DISABLE_SCHEDULER: '1',
  VITE_API_URL: `http://127.0.0.1:${apiPort}`
};
const forwardedArgs = process.argv.slice(2).filter((argument) => argument !== '--');

function run(label, executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: root,
    env: sharedEnv,
    stdio: 'inherit',
    ...options
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} falhou com código ${result.status ?? 'desconhecido'}.`);
  }
}

function start(executable, args, env, withIpc = false) {
  return spawn(executable, args, {
    cwd: root,
    env,
    stdio: withIpc ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit',
    windowsHide: true
  });
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

run('TypeScript web', process.execPath, [tscCli, '-b'], {
  cwd: path.join(root, 'apps', 'web')
});
run('Build web E2E', process.execPath, [viteCli, 'build', '--outDir', webDist, '--emptyOutDir'], {
  cwd: path.join(root, 'apps', 'web')
});

const api = start(process.execPath, [tsxCli, apiEntry], {
  ...sharedEnv,
  NODE_ENV: 'development',
  PORT: String(apiPort),
  GEOGESTOR_DB_PATH: path.join(e2eRoot, 'geogestor.db'),
  GEOGESTOR_REQUIRE_UNLOCK: '1',
  GEOGESTOR_AUTH_DISABLED: '0',
  GEOGESTOR_WEB_ORIGIN: webOrigin
}, true);
const web = start(process.execPath, [
  viteCli,
  'preview',
  '--outDir',
  webDist,
  '--host',
  '127.0.0.1',
  '--port',
  String(webPort),
  '--strictPort'
], {
  ...sharedEnv,
  NODE_ENV: 'production'
});

let stopPromise;
const stopServers = () => {
  stopPromise ||= Promise.all([
    stopProcessTree(web),
    stopProcessTree(api, { ipcMessage: { type: 'geogestor:e2e-shutdown' } })
  ]);
  return stopPromise;
};
const handleSignal = () => void stopServers();
process.once('SIGINT', handleSignal);
process.once('SIGTERM', handleSignal);

let exitCode = 0;
let failure;
try {
  await Promise.all([
    waitForUrl(`http://127.0.0.1:${apiPort}/api/ready`, 120_000),
    waitForUrl(webOrigin, 60_000)
  ]);
  run('Playwright comercial', process.execPath, [
    playwrightCli,
    'test',
    '--config',
    'playwright.config.ts',
    ...forwardedArgs
  ]);
} catch (error) {
  exitCode = 1;
  failure = error;
  console.error(error);
} finally {
  process.removeListener('SIGINT', handleSignal);
  process.removeListener('SIGTERM', handleSignal);
  try {
    await stopServers();
    if (exitCode === 0) {
      removeSuccessfulE2eRun(commercialE2eRoot, e2eRoot);
      console.log(`[E2E] Execução aprovada e resíduos próprios removidos: ${path.basename(e2eRoot)}`);
    } else {
      preserveFailedE2eRun(commercialE2eRoot, e2eRoot, failure);
      console.error(`[E2E] Evidências da falha preservadas em ${e2eRoot}`);
    }
  } catch (cleanupError) {
    exitCode = 1;
    console.error('[E2E] Falha ao encerrar ou aplicar a política de resíduos:', cleanupError);
  }
}

process.exitCode = exitCode;
