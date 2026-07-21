import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { RecoverableFileService } from './services/recoverable-file.service';

const root = path.resolve(process.cwd(), 'scratch', 'recoverable-file-test');
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
