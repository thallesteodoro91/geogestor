import { mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratchRoot = path.resolve(root, 'scratch');
const e2eRoot = path.resolve(scratchRoot, 'commercial-e2e', `run-${process.pid}`);
const webDist = path.join(e2eRoot, 'web-dist');
const relativeTarget = path.relative(scratchRoot, e2eRoot);

if (!relativeTarget || relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
  throw new Error(`Diretório E2E recusado por segurança: ${e2eRoot}`);
}

mkdirSync(e2eRoot, { recursive: true });

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

function start(executable, args, env) {
  return spawn(executable, args, {
    cwd: root,
    env,
    stdio: 'inherit',
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

function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  } else if (!child.killed) {
    child.kill('SIGTERM');
  }
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
});
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

const stopServers = () => {
  stopProcessTree(web);
  stopProcessTree(api);
};
process.once('SIGINT', stopServers);
process.once('SIGTERM', stopServers);

let exitCode = 0;
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
  console.error(error);
} finally {
  process.removeListener('SIGINT', stopServers);
  process.removeListener('SIGTERM', stopServers);
  stopServers();
}

process.exit(exitCode);
