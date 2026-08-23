import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const startedAt = new Date();
const runId = crypto.randomUUID();
const dist = path.join(root, 'apps', 'desktop', 'dist');
const reportPath = path.join(dist, 'release-gate-report.json');
const report = { runId, startedAt: startedAt.toISOString(), finishedAt: null, approved: false, gates: [] };
const env = {
  ...process.env,
  GEOGESTOR_RELEASE_RUN_ID: runId,
  GEOGESTOR_RELEASE_STARTED_AT: startedAt.toISOString()
};

function record(name, approved, detail = null) {
  report.gates.push({ name, approved, detail });
  if (!approved) throw new Error(`${name}: ${detail || 'gate reprovado'}`);
}

function run(name, command, args) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', shell: false });
  if (result.error) record(name, false, result.error.message);
  record(name, result.status === 0, result.status === 0 ? null : `comando encerrou com código ${result.status ?? 1}`);
}

function runInformational(name, command, args, acceptedRisk) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', shell: false });
  report.gates.push({
    name,
    required: false,
    approved: result.status === 0 && !result.error,
    accepted: true,
    detail: result.error?.message || (result.status === 0 ? 'estado verificado' : acceptedRisk),
  });
}

try {
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', shell: false });
  record('checkout limpo e reproduzível', status.status === 0 && !status.stdout.trim(),
    status.status === 0 ? 'existem alterações locais' : 'não foi possível consultar o Git');

  const rootVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const desktopVersion = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'desktop', 'package.json'), 'utf8')).version;
  const commercialVersion = rootVersion.replace(/\.0$/, '');
  report.version = rootVersion;
  record('versões sincronizadas', rootVersion === desktopVersion, `${rootVersion} / ${desktopVersion}`);

  // Nenhum instalador é gerado antes que todos os gates de código, dados e recuperação passem.
  run('typecheck web e API', pnpm, ['--config.verify-deps-before-run=false', 'run', 'typecheck']);
  run('lint web', pnpm, ['--config.verify-deps-before-run=false', 'run', 'lint']);
  run('testes web', pnpm, ['--config.verify-deps-before-run=false', 'run', 'test:web']);
  run('testes API, banco, backup e restore', pnpm, ['--config.verify-deps-before-run=false', 'run', 'test:api']);
  run('testes Electron', pnpm, ['--config.verify-deps-before-run=false', 'run', 'test:electron']);
  run('testes dos gates de integridade e SBOM', node, ['--test', 'scripts/release-integrity.test.mjs', 'scripts/sbom.test.mjs']);
  run('testes de governança', pnpm, ['--config.verify-deps-before-run=false', 'run', 'governance:test']);
  run('verificações de governança', pnpm, ['--config.verify-deps-before-run=false', 'run', 'governance:check']);
  run('fluxos E2E comerciais', pnpm, ['--config.verify-deps-before-run=false', 'run', 'test:e2e']);

  run('build do instalador', node, ['scripts/build.mjs']);
  run('evidências e hash do mesmo build', node, ['scripts/release-evidence.mjs']);
  run('smoke da API empacotada', node, ['scripts/smoke-packaged-api.mjs']);
  run('conteúdo, identidade e integridade do pacote', node, ['scripts/release-verify.mjs', '--package']);
  runInformational(
    'assinatura Authenticode (informativa)',
    pnpm,
    ['--config.verify-deps-before-run=false', 'run', 'release:verify-signature'],
    'não implementada por decisão do proprietário — risco residual aceito',
  );

  report.approved = true;
  console.log(`Candidato GeoGestor v${commercialVersion} aprovado em todos os gates.`);
} catch (error) {
  report.failure = error instanceof Error ? error.message : String(error);
  console.error(`Release bloqueado: ${report.failure}`);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Relatório consolidado: ${reportPath}`);
}
