import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', shell: false });
if (status.status !== 0 || status.stdout.trim()) {
  throw new Error('O candidato comercial só pode ser gerado de um checkout limpo do commit aprovado.');
}

const rootVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const desktopVersion = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'desktop', 'package.json'), 'utf8')).version;
if (rootVersion !== desktopVersion) throw new Error(`Versões divergentes: ${rootVersion} e ${desktopVersion}.`);

run(node, ['scripts/build.mjs']);
run(node, ['scripts/release-evidence.mjs']);
run(node, ['scripts/smoke-packaged-api.mjs']);
run(node, ['scripts/release-verify.mjs', '--package']);
run(pnpm, ['run', 'release:verify-signature']);

console.log(`Candidato GeoGestor v${rootVersion} gerado e verificado a partir de worktree limpo.`);
