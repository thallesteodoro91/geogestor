import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'apps', 'api', 'src');
const requireFromApi = createRequire(path.join(root, 'apps', 'api', 'package.json'));
const tsxCli = requireFromApi.resolve('tsx/cli');

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? collect(target) : entry.name.endsWith('.test.ts') ? [target] : [];
    })
    .sort();
}

const result = spawnSync(process.execPath, [tsxCli, '--test', '--test-concurrency=4', '--test-force-exit', ...collect(source)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test' }
});

const scratch = path.join(root, 'scratch');
if (existsSync(scratch)) {
  for (const entry of readdirSync(scratch, { withFileTypes: true })) {
    if (!entry.isDirectory() || !['system-reset-', 'data-directory-', 'geospatial-'].some((prefix) => entry.name.startsWith(prefix))) continue;
    try {
      rmSync(path.join(scratch, entry.name), { recursive: true, force: true, maxRetries: 0 });
    } catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error?.code)) throw error;
      // O Windows pode manter o arquivo SQLite bloqueado por alguns instantes
      // depois que o driver encerra. O próximo ciclo de testes tenta novamente.
    }
  }
}

process.exit(result.status ?? 1);
