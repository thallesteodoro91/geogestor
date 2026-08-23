import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runGovernanceChecks } from './governance-checks.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFromWeb = createRequire(path.join(root, 'apps', 'web', 'package.json'));
const requireFromApi = createRequire(path.join(root, 'apps', 'api', 'package.json'));
const webTsc = requireFromWeb.resolve('typescript/bin/tsc');
const apiTsc = requireFromApi.resolve('typescript/bin/tsc');

function run(label, command, args, options = {}) {
  console.log(`\n[governança] ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} falhou com código ${result.status ?? 'desconhecido'}.`);
}

const staticResult = runGovernanceChecks(root);
if (staticResult.blocking.length) {
  staticResult.blocking.forEach((failure) => console.error(`[bloqueio] ${failure}`));
  process.exitCode = 1;
} else {
  staticResult.warnings.forEach((warning) => console.warn(`[alerta] ${warning}`));
  run('testes das políticas preventivas', process.execPath, ['--test', 'scripts/governance-checks.test.mjs', 'scripts/e2e-artifacts.test.mjs']);
  run('tipagem do frontend', process.execPath, [webTsc, '-b'], { cwd: path.join(root, 'apps', 'web') });
  run('tipagem da API', process.execPath, [apiTsc, '--noEmit'], { cwd: path.join(root, 'apps', 'api') });
  run('testes do frontend', process.execPath, ['scripts/run-web-tests.mjs']);
  run('testes da API', process.execPath, ['scripts/run-api-tests.mjs']);
  run('testes do Electron', process.execPath, ['--test', 'apps/desktop/main.test.cjs', 'apps/desktop/preload.test.cjs']);
  if (process.argv.includes('--e2e')) run('E2E completo', process.execPath, ['scripts/run-commercial-e2e.mjs']);
  run('integridade do diff', 'git', ['diff', '--check']);
}
