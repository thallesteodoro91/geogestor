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

    const sourceStats = await fs.stat(sourcePath);
    if (!sourceStats.isFile()) throw new Error('Somente arquivos regulares podem ser excluídos.');

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

  static async rollback(manifest: QuarantineManifest) {
    const entryDirectory = path.dirname(manifest.quarantinedPath);
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
        const raw = await fs.readFile(path.join(entryDirectory, 'manifest.json'), 'utf8');
        const manifest = JSON.parse(raw) as QuarantineManifest;
        if (manifest.version === 1 && manifest.entryId === entry) manifests.push(manifest);
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
    await this.rollback(manifest);
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
