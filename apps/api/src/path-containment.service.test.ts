import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { ensurePathInsideRoot } from './services/path-containment.service';

const testRoot = path.resolve(process.cwd(), 'scratch', `path-containment-${process.pid}`);
const allowedRoot = path.join(testRoot, 'allowed');
const outsideRoot = path.join(testRoot, 'outside');

test('contenção física bloqueia travessia e links externos, preservando caminhos internos', async (context) => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(allowedRoot, 'internal'), { recursive: true });
  await fs.mkdir(outsideRoot, { recursive: true });
  await fs.writeFile(path.join(allowedRoot, 'internal', 'safe.txt'), 'seguro', 'utf8');
  await fs.writeFile(path.join(outsideRoot, 'secret.txt'), 'externo', 'utf8');

  assert.equal(
    await ensurePathInsideRoot(path.join(allowedRoot, 'internal', 'safe.txt'), allowedRoot, { mustExist: true }),
    await fs.realpath(path.join(allowedRoot, 'internal', 'safe.txt'))
  );
  await assert.rejects(
    ensurePathInsideRoot(path.join(allowedRoot, '..', 'outside', 'secret.txt'), allowedRoot, { mustExist: true }),
    /fora do diretório raiz/
  );
  await assert.rejects(
    ensurePathInsideRoot(path.join(outsideRoot, 'secret.txt'), allowedRoot, { mustExist: true }),
    /fora do diretório raiz/
  );

  const externalLink = path.join(allowedRoot, 'external-link');
  const internalLink = path.join(allowedRoot, 'internal-link');
  try {
    await fs.symlink(outsideRoot, externalLink, process.platform === 'win32' ? 'junction' : 'dir');
    await fs.symlink(path.join(allowedRoot, 'internal'), internalLink, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      context.skip('O ambiente não permite criar junction/symlink para este teste.');
      return;
    }
    throw error;
  }

  await assert.rejects(
    ensurePathInsideRoot(path.join(externalLink, 'secret.txt'), allowedRoot, { mustExist: true }),
    /fora do diretório raiz/
  );
  assert.equal(
    await ensurePathInsideRoot(path.join(internalLink, 'safe.txt'), allowedRoot, { mustExist: true }),
    await fs.realpath(path.join(allowedRoot, 'internal', 'safe.txt'))
  );
  assert.equal(
    await ensurePathInsideRoot(path.join(allowedRoot, 'new-folder', 'new-file.txt'), allowedRoot),
    path.join(await fs.realpath(allowedRoot), 'new-folder', 'new-file.txt')
  );

  await fs.rm(testRoot, { recursive: true, force: true });
});
