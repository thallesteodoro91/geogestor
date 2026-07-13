import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^npm_/i.test(key) || /^PNPM_/i.test(key) || ['INIT_CWD', 'NODE_PATH', 'NODE_OPTIONS', 'ESBUILD_BINARY_PATH'].includes(key)) {
    delete env[key];
  }
}

const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path');
if (pathKey) {
  env[pathKey] = env[pathKey]
    .split(path.delimiter)
    .filter((entry) => !/[\\/]node_modules[\\/]\.bin$/i.test(entry))
    .join(path.delimiter);
}

const steps = [
  ['contracts', ['--filter', '@geogestor/contracts', 'build']],
  ['database', ['--filter', '@geogestor/database', 'build']],
  ['api', ['--filter', 'api', 'build']],
  ['web', ['--filter', 'web', 'build']],
  ['desktop', ['--filter', 'geogestor-desktop', 'build']]
];

function quoteCmdArg(arg) {
  if (!/[\s&()^|<>"]/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '\\"')}"`;
}

for (const [label, args] of steps) {
  console.log(`\n[build] ${label}`);
  const command = [pnpmCmd, ...args].map(quoteCmdArg).join(' ');
  const result = spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
