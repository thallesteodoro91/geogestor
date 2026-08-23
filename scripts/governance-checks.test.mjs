import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runGovernanceChecks } from './governance-checks.mjs';

test('projeto atual passa nas barreiras estáticas e preserva diagnósticos como alertas', () => {
  const result = runGovernanceChecks();
  const canonicalVersion = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'package.json'), 'utf8')).version;
  assert.deepEqual(result.blocking, []);
  assert.equal(result.diagnostics.canonicalVersion, canonicalVersion);
  assert.ok(result.diagnostics.compatibilityEntries >= 3);
  assert.ok(result.diagnostics.assets.total > 0);
  assert.equal(result.diagnostics.navigationBaseline.baselineTotal, 70);
  assert.equal(result.diagnostics.navigationBaseline.currentTotal, 70);
  assert.deepEqual(result.diagnostics.navigationBaseline.added, []);
});

function createBaselineFixture(context, source, entries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geogestor-baseline-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ['apps/api', 'apps/desktop', 'apps/web/src/pages/Ajuda', 'apps/web/src/assets', 'governance']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  }
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"1.0.0"}');
  fs.writeFileSync(path.join(root, 'apps/api/package.json'), '{"version":"1.0.0"}');
  fs.writeFileSync(path.join(root, 'apps/desktop/package.json'), '{"version":"1.0.0"}');
  fs.writeFileSync(path.join(root, 'apps/web/src/pages/Ajuda/helpContent.ts'), "const minimumVersion = '1.0.0';");
  fs.writeFileSync(path.join(root, 'apps/web/src/App.tsx'), source);
  fs.writeFileSync(path.join(root, 'governance/compatibility-registry.json'), '{"entries":[]}');
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  fs.writeFileSync(path.join(root, 'governance/hardcoded-navigation-baseline.json'), JSON.stringify({
    schema: 1,
    changePolicy: 'Dívida histórica apenas.',
    revisions: [{ date: '2026-08-11', total, justification: 'Fixture controlada.' }],
    entries
  }));
  return root;
}

test('baseline bloqueia novo link sem depender de diff do Git', (context) => {
  const root = createBaselineFixture(context, 'export const view = <a href="/clientes">Clientes</a>;', []);
  const result = runGovernanceChecks(root);
  assert.ok(result.blocking.some((failure) => failure.includes('Novo link interno literal fora da baseline')));
  assert.equal(result.diagnostics.navigationBaseline.currentTotal, 1);
});

test('baseline permite redução da dívida histórica', (context) => {
  const root = createBaselineFixture(context, 'export const view = null;', [
    { file: 'apps/web/src/App.tsx', content: 'href:/clientes', count: 1 }
  ]);
  const result = runGovernanceChecks(root);
  assert.equal(result.blocking.some((failure) => failure.includes('link interno literal')), false);
  assert.equal(result.diagnostics.navigationBaseline.removed[0].removed, 1);
});

test('verificação de versão e nomenclatura falha de forma explicativa', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'geogestor-governance-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of [
    'apps/api', 'apps/desktop', 'apps/web/src/pages/Ajuda', 'apps/web/src', 'governance', 'apps/web/src/assets'
  ]) fs.mkdirSync(path.join(root, directory), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"1.0.0"}');
  fs.writeFileSync(path.join(root, 'apps/api/package.json'), '{"version":"1.0.1"}');
  fs.writeFileSync(path.join(root, 'apps/desktop/package.json'), '{"version":"1.0.0"}');
  fs.writeFileSync(path.join(root, 'apps/web/src/pages/Ajuda/helpContent.ts'), "const minimumVersion = '1.0.0';\nexport const title = 'Gestão financeira 360';");
  fs.writeFileSync(path.join(root, 'governance/compatibility-registry.json'), '{"entries":[]}');

  const result = runGovernanceChecks(root);
  assert.ok(result.blocking.some((failure) => failure.includes('Versão divergente em API')));
  assert.ok(result.blocking.some((failure) => failure.includes('Nomenclatura obsoleta')));
});
