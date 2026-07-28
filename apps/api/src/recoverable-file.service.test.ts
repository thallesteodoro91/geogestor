import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { RecoverableFileService } from './services/recoverable-file.service';

const root = path.resolve(process.cwd(), 'scratch', `recoverable-file-${process.pid}`);
const originalPath = path.join(root, 'Cliente Sintético', 'documento.txt');

async function reset() {
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(path.dirname(originalPath), { recursive: true });
  await fs.writeFile(originalPath, 'conteúdo sintético para teste', 'utf8');
}

test('quarentena preserva o único exemplar e permite rollback após falha lógica', async () => {
  await reset();
  const manifest = await RecoverableFileService.quarantine({
    sourcePath: originalPath,
    dataRoot: root,
    recordId: 'documento-teste'
  });
  await assert.rejects(fs.access(originalPath));
  await fs.access(manifest.quarantinedPath);

  const committed = await RecoverableFileService.commit(manifest);
  assert.equal(committed.state, 'committed');
  await RecoverableFileService.rollback(committed);

  assert.equal(await fs.readFile(originalPath, 'utf8'), 'conteúdo sintético para teste');
  assert.equal((await RecoverableFileService.list(root)).length, 0);
  await fs.rm(root, { recursive: true, force: true });
});

test('documento excluído pode ser restaurado por identificador com hash validado', async () => {
  await reset();
  const pending = await RecoverableFileService.quarantine({
    sourcePath: originalPath,
    dataRoot: root,
    recordId: 'documento-teste'
  });
  await RecoverableFileService.commit(pending);

  const restored = await RecoverableFileService.restoreLatestByRecordId(root, 'documento-teste');
  assert.equal(restored.recordId, 'documento-teste');
  assert.equal(await fs.readFile(originalPath, 'utf8'), 'conteúdo sintético para teste');
  await fs.rm(root, { recursive: true, force: true });
});

test('purga remove somente entradas confirmadas e expiradas e preserva manifestos inválidos', async () => {
  await reset();
  const committed = await RecoverableFileService.commit(await RecoverableFileService.quarantine({
    sourcePath: originalPath,
    dataRoot: root,
    recordId: 'documento-expirado'
  }));
  const committedManifestPath = path.join(path.dirname(committed.quarantinedPath), 'manifest.json');
  await fs.writeFile(committedManifestPath, `${JSON.stringify({
    ...committed,
    createdAt: '2020-01-01T00:00:00.000Z',
    committedAt: '2020-01-01T00:00:01.000Z'
  }, null, 2)}\n`, 'utf8');
  await fs.rm(committed.quarantinedPath, { force: true });

  const malformedDirectory = path.join(RecoverableFileService.getTrashRoot(root), 'manifesto-invalido');
  await fs.mkdir(malformedDirectory, { recursive: true });
  await fs.writeFile(path.join(malformedDirectory, 'manifest.json'), '{invalido', 'utf8');

  const purged = await RecoverableFileService.purgeExpired(root, 30);
  assert.equal(purged, 1);
  await assert.rejects(fs.access(path.dirname(committed.quarantinedPath)));
  assert.equal((await fs.stat(malformedDirectory)).isDirectory(), true);
  await fs.rm(root, { recursive: true, force: true });
});
