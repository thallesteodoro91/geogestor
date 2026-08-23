import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  E2E_RUN_MARKER,
  assertManagedE2eRunPath,
  initializeManagedE2eRun,
  preserveFailedE2eRun,
  previewManagedE2eCleanup,
  removeSuccessfulE2eRun
} from './e2e-artifacts.mjs';

function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'geogestor-e2e-policy-'));
  const root = path.join(base, 'scratch', 'commercial-e2e');
  fs.mkdirSync(root, { recursive: true });
  return { base, root };
}

test('execução aprovada remove somente a própria pasta marcada', (context) => {
  const { base, root } = fixture();
  context.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const run = path.join(root, 'run-success-1');
  initializeManagedE2eRun(root, run, { purpose: 'test' });
  fs.writeFileSync(path.join(run, 'evidence.txt'), 'temporário', 'utf8');
  const sibling = path.join(root, 'run-existing-1');
  fs.mkdirSync(sibling);

  removeSuccessfulE2eRun(root, run);

  assert.equal(fs.existsSync(run), false);
  assert.equal(fs.existsSync(sibling), true);
});

test('execução com falha preserva evidências e resumo', (context) => {
  const { base, root } = fixture();
  context.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const run = path.join(root, 'run-failure-1');
  initializeManagedE2eRun(root, run);
  preserveFailedE2eRun(root, run, new Error('falha controlada'));

  assert.equal(fs.existsSync(path.join(run, E2E_RUN_MARKER)), true);
  assert.match(fs.readFileSync(path.join(run, 'failure-summary.json'), 'utf8'), /falha controlada/);
});

test('política recusa raízes, caminhos externos, nomes livres e execução sem marcador', (context) => {
  const { base, root } = fixture();
  context.after(() => fs.rmSync(base, { recursive: true, force: true }));

  assert.throws(() => assertManagedE2eRunPath(root, root), /fora da raiz/);
  assert.throws(() => assertManagedE2eRunPath(root, path.join(base, 'data', 'run-danger')), /fora da raiz/);
  assert.throws(() => assertManagedE2eRunPath(root, path.join(root, 'resultado')), /Nome de execução/);
  const unowned = path.join(root, 'run-unowned-1');
  fs.mkdirSync(unowned);
  assert.throws(() => removeSuccessfulE2eRun(root, unowned), /sem marcador/);
  assert.equal(fs.existsSync(unowned), true);
});

test('política recusa link simbólico quando o sistema permite criá-lo', (context) => {
  const { base, root } = fixture();
  context.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const outside = path.join(base, 'outside');
  fs.mkdirSync(outside);
  const linked = path.join(root, 'run-linked-1');
  try {
    fs.symlinkSync(outside, linked, 'junction');
  } catch {
    context.skip('Ambiente sem permissão para criar junction de teste.');
    return;
  }
  assert.throws(() => assertManagedE2eRunPath(root, linked), /link simbólico/);
});

test('prévia lista somente execuções próprias e não remove conteúdo', (context) => {
  const { base, root } = fixture();
  context.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const owned = path.join(root, 'run-owned-preview');
  const unowned = path.join(root, 'run-unowned-preview');
  initializeManagedE2eRun(root, owned);
  fs.mkdirSync(unowned);

  const preview = previewManagedE2eCleanup(root);

  assert.deepEqual(preview.candidates.map((entry) => entry.runId), ['run-owned-preview']);
  assert.deepEqual(preview.skipped.map((entry) => entry.runId), ['run-unowned-preview']);
  assert.equal(fs.existsSync(owned), true);
  assert.equal(fs.existsSync(unowned), true);
});

test('specs E2E não gravam evidências em raízes scratch fixas', () => {
  const specsRoot = path.resolve(import.meta.dirname, '..', 'tests', 'e2e');
  const violations = fs.readdirSync(specsRoot)
    .filter((name) => name.endsWith('.spec.ts'))
    .flatMap((name) => {
      const source = fs.readFileSync(path.join(specsRoot, name), 'utf8');
      return [
        /scratch[\\/](?:header|settings)-audit/i,
        /path\.join\(process\.cwd\(\),\s*['"]scratch['"]/i,
      ].some((pattern) => pattern.test(source)) ? [name] : [];
    });

  assert.deepEqual(violations, []);
  const playwrightConfig = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'playwright.config.ts'), 'utf8');
  assert.doesNotMatch(playwrightConfig, /path\.join\([^\n]*['"]scratch['"]/i);
  assert.match(playwrightConfig, /GEOGESTOR_E2E_ROOT/);
});
