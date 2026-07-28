import { readdirSync } from 'node:fs';
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

const result = spawnSync(process.execPath, [tsxCli, '--test', ...collect(source)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test' }
});
process.exit(result.status ?? 1);
