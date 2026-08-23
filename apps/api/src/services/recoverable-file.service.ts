import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export type QuarantineManifest = {
  version: 1;
  entryId: string;
  recordId: string | null;
  originalPath: string;
  quarantinedPath: string;
  sha256: string;
  sizeBytes: number;
  state: 'pending' | 'committed';
  createdAt: string;
  committedAt: string | null;
};

function assertInsideRoot(candidate: string, root: string) {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return;
  throw new Error('O caminho informado está fora da pasta de dados autorizada.');
}

async function sha256File(filePath: string) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function assertResolvedParentInsideRoot(candidate: string, root: string) {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  assertInsideRoot(resolvedCandidate, resolvedRoot);

  const realRoot = await fs.realpath(resolvedRoot);
  let existingParent = path.dirname(resolvedCandidate);
  while (true) {
    try {
      const parentStats = await fs.lstat(existingParent);
      if (!parentStats.isDirectory() || parentStats.isSymbolicLink()) {
        throw new Error('O caminho de restauração contém um redirecionamento não autorizado.');
      }
      assertInsideRoot(await fs.realpath(existingParent), realRoot);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const nextParent = path.dirname(existingParent);
      if (nextParent === existingParent) throw error;
      existingParent = nextParent;
    }
  }
}

async function validatePersistedManifest(
  dataRoot: string,
  entryDirectory: string,
  candidate: unknown
): Promise<QuarantineManifest> {
  if (!candidate || typeof candidate !== 'object') throw new Error('Manifesto de quarentena inválido.');
  const manifest = candidate as Partial<QuarantineManifest>;
  const resolvedEntryDirectory = path.resolve(entryDirectory);
  const expectedEntryId = path.basename(resolvedEntryDirectory);
  const trashRoot = RecoverableFileService.getTrashRoot(dataRoot);
  assertInsideRoot(resolvedEntryDirectory, trashRoot);

  const entryStats = await fs.lstat(resolvedEntryDirectory);
  if (!entryStats.isDirectory() || entryStats.isSymbolicLink()) {
    throw new Error('A entrada de quarentena não é um diretório regular.');
  }
  if (
    manifest.version !== 1
    || manifest.entryId !== expectedEntryId
    || (manifest.recordId !== null && typeof manifest.recordId !== 'string')
    || typeof manifest.originalPath !== 'string'
    || typeof manifest.quarantinedPath !== 'string'
    || typeof manifest.sha256 !== 'string'
    || !/^[a-f0-9]{64}$/i.test(manifest.sha256)
    || typeof manifest.sizeBytes !== 'number'
    || !Number.isSafeInteger(manifest.sizeBytes)
    || manifest.sizeBytes < 0
    || !['pending', 'committed'].includes(manifest.state ?? '')
    || typeof manifest.createdAt !== 'string'
    || (manifest.committedAt !== null && typeof manifest.committedAt !== 'string')
  ) {
    throw new Error('Manifesto de quarentena inválido.');
  }

  const originalPath = path.resolve(manifest.originalPath);
  const quarantinedPath = path.resolve(manifest.quarantinedPath);
  await assertResolvedParentInsideRoot(originalPath, dataRoot);
  if (
    path.dirname(quarantinedPath) !== resolvedEntryDirectory
    || !/^payload(?:\.[^\\/]+)?$/i.test(path.basename(quarantinedPath))
  ) {
    throw new Error('O arquivo em quarentena está fora da entrada autorizada.');
  }
  const quarantinedStats = await fs.lstat(quarantinedPath);
  if (!quarantinedStats.isFile() || quarantinedStats.isSymbolicLink()) {
    throw new Error('O arquivo em quarentena não é um arquivo regular.');
  }

  return { ...manifest, originalPath, quarantinedPath } as QuarantineManifest;
}

async function writeManifestAtomic(entryDirectory: string, manifest: QuarantineManifest) {
  const target = path.join(entryDirectory, 'manifest.json');
  const temporary = path.join(entryDirectory, 'manifest.pending.json');
  await fs.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'w' });
  await fs.rename(temporary, target);
}

export class RecoverableFileService {
  static getTrashRoot(dataRoot: string) {
    return path.join(path.resolve(dataRoot), '.geogestor-trash', 'documents');
  }

  static async quarantine(input: { sourcePath: string; dataRoot: string; recordId?: string | null }) {
    const sourcePath = path.resolve(input.sourcePath);
    const dataRoot = path.resolve(input.dataRoot);
    assertInsideRoot(sourcePath, dataRoot);

    const sourceStats = await fs.lstat(sourcePath);
    if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
      throw new Error('Somente arquivos regulares podem ser excluídos.');
    }

    const entryId = crypto.randomUUID();
    const entryDirectory = path.join(this.getTrashRoot(dataRoot), entryId);
    const quarantinedPath = path.join(entryDirectory, `payload${path.extname(sourcePath).toLowerCase()}`);
    assertInsideRoot(entryDirectory, dataRoot);
    await fs.mkdir(entryDirectory, { recursive: true });

    let moved = false;
    try {
      await fs.rename(sourcePath, quarantinedPath);
      moved = true;
      const manifest: QuarantineManifest = {
        version: 1,
        entryId,
        recordId: input.recordId ?? null,
        originalPath: sourcePath,
        quarantinedPath,
        sha256: await sha256File(quarantinedPath),
        sizeBytes: sourceStats.size,
        state: 'pending',
        createdAt: new Date().toISOString(),
        committedAt: null
      };
      await writeManifestAtomic(entryDirectory, manifest);
      return manifest;
    } catch (error) {
      if (moved) {
        await fs.rename(quarantinedPath, sourcePath).catch(() => undefined);
      }
      await fs.rm(entryDirectory, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  static async commit(manifest: QuarantineManifest) {
    const entryDirectory = path.dirname(manifest.quarantinedPath);
    const committed: QuarantineManifest = {
      ...manifest,
      state: 'committed',
      committedAt: new Date().toISOString()
    };
    await writeManifestAtomic(entryDirectory, committed);
    return committed;
  }

  static async rollback(manifest: QuarantineManifest, dataRoot: string) {
    const entryDirectory = path.dirname(manifest.quarantinedPath);
    manifest = await validatePersistedManifest(dataRoot, entryDirectory, manifest);
    await fs.mkdir(path.dirname(manifest.originalPath), { recursive: true });
    try {
      await fs.access(manifest.originalPath);
      throw new Error('Não foi possível restaurar o arquivo porque o caminho original já está ocupado.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await fs.rename(manifest.quarantinedPath, manifest.originalPath);
    await fs.rm(entryDirectory, { recursive: true, force: true });
  }

  static async list(dataRoot: string) {
    const trashRoot = this.getTrashRoot(dataRoot);
    let entries: string[];
    try {
      entries = await fs.readdir(trashRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }

    const manifests: QuarantineManifest[] = [];
    for (const entry of entries) {
      const entryDirectory = path.join(trashRoot, entry);
      assertInsideRoot(entryDirectory, trashRoot);
      try {
        const manifestPath = path.join(entryDirectory, 'manifest.json');
        const manifestStats = await fs.lstat(manifestPath);
        if (!manifestStats.isFile() || manifestStats.isSymbolicLink()) throw new Error('Manifesto inválido.');
        const raw = await fs.readFile(manifestPath, 'utf8');
        manifests.push(await validatePersistedManifest(dataRoot, entryDirectory, JSON.parse(raw)));
      } catch {
        // Uma entrada incompleta permanece em quarentena para inspeção; nunca é purgada silenciosamente.
      }
    }
    return manifests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  static async restoreLatestByRecordId(dataRoot: string, recordId: string) {
    const manifest = (await this.list(dataRoot)).find((entry) => entry.recordId === recordId && entry.state === 'committed');
    if (!manifest) throw new Error('Nenhum arquivo recuperável foi encontrado para este documento.');

    const actualHash = await sha256File(manifest.quarantinedPath);
    if (actualHash !== manifest.sha256) throw new Error('O arquivo em quarentena falhou na verificação de integridade.');
    await this.rollback(manifest, dataRoot);
    return manifest;
  }

  static async purgeExpired(dataRoot: string, retentionDays = 30) {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let purged = 0;
    for (const manifest of await this.list(dataRoot)) {
      if (manifest.state !== 'committed' || Date.parse(manifest.createdAt) >= cutoff) continue;
      const entryDirectory = path.dirname(manifest.quarantinedPath);
      assertInsideRoot(entryDirectory, this.getTrashRoot(dataRoot));
      await fs.rm(entryDirectory, { recursive: true, force: true });
      purged += 1;
    }
    return purged;
  }
}
