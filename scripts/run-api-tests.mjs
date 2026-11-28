import { mkdirSync, readdirSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'apps', 'api', 'src');
const requireFromApi = createRequire(path.join(root, 'apps', 'api', 'package.json'));
const tsxCli = requireFromApi.resolve('tsx/cli');
const fallbackDirectory = path.join(root, 'scratch', `api-suite-${process.pid}-${crypto.randomUUID()}`);
mkdirSync(fallbackDirectory, { recursive: true });

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
  env: {
    ...process.env, NODE_ENV: 'test', GEOGESTOR_DISABLE_SCHEDULER: '1',
    // A unit test importing a database service before its own fixture is set
    // must never fall back to the developer's operational database.
    GEOGESTOR_DB_PATH: path.join(fallbackDirectory, 'fallback.db')
  }
});

// Each test owns its temporary paths. Never delete older diagnostics merely
// because their directory name shares a prefix with this run's fixtures.

process.exit(result.status ?? 1);
