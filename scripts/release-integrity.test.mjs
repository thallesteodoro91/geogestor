import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { describeArtifact, verifyArtifactHashes } from './release-integrity.mjs';

const root = path.resolve(process.cwd(), 'scratch', `release-integrity-${process.pid}`);
const installer = path.join(root, 'GeoGestor Setup 9.9.9.exe');

test('manifesto de hashes é invalidado quando o instalador muda', async () => {
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(installer, 'instalador definitivo');
  await fs.writeFile(path.join(root, 'artifact-hashes.json'), JSON.stringify({
    artifacts: [describeArtifact(installer)]
  }));
  assert.deepEqual(verifyArtifactHashes(root), []);

  await fs.appendFile(installer, ' alterado');
  const changedErrors = verifyArtifactHashes(root);
  assert.equal(changedErrors.some((error) => error.includes('Tamanho divergente')), true);
  assert.equal(changedErrors.some((error) => error.includes('SHA-256 divergente')), true);

  await fs.writeFile(path.join(root, 'artifact-hashes.json'), JSON.stringify({
    artifacts: [describeArtifact(installer), { name: 'GeoGestor Setup 0.0.1.exe', bytes: 1, sha256: '0' }]
  }));
  assert.equal(verifyArtifactHashes(root).some((error) => error.includes('obsoleto ou ausente')), true);

  await fs.writeFile(path.join(root, 'artifact-hashes.json'), JSON.stringify({
    version: '9.9.9',
    commit: 'commit-aprovado',
    releaseRunId: 'execucao-anterior',
    artifacts: [describeArtifact(installer)]
  }));
  const identityErrors = verifyArtifactHashes(root, {
    version: '9.9.9',
    commit: 'commit-aprovado',
    releaseRunId: 'execucao-atual'
  });
  assert.equal(identityErrors.some((error) => error.includes('Execução')), true);
  await fs.rm(root, { recursive: true, force: true });
});
