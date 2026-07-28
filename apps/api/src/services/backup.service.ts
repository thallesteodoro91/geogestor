import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { MaintenanceCoordinator } from './maintenance-coordinator.service';
import { MANAGERIAL_FINANCE_MIGRATION } from './runtime-migrations/v4-managerial-finance';

const BACKUP_FORMAT_VERSION = 1;
const DEFAULT_RETENTION = 10;
const RESTORE_CONFIRMATION = 'RESTORE_GEOGESTOR';

type BackupFileEntry = {
  path: string;
  sizeBytes: number;
  sha256: string;
};

export type BackupManifest = {
  formatVersion: number;
  application: 'GeoGestor';
  createdAt: string;
  completedAt: string;
  schemaVersion: number;
  type: 'database' | 'complete';
  files: BackupFileEntry[];
  totals: { files: number; bytes: number };
};

function assertInside(candidate: string, root: string) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return;
  throw new Error('Operação de backup recusada porque o caminho saiu da raiz autorizada.');
}

async function sha256File(filePath: string) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function listFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    assertInside(fullPath, root);
    if (entry.isDirectory()) files.push(...await listFiles(root, fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function writeJsonAtomic(target: string, value: unknown) {
  const temporary = `${target}.pending`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, target);
}

async function renameWithRetry(source: string, target: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await fs.rename(source, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(code || '') || attempt === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

async function inspectDatabase(databasePath: string) {
  const client = createClient({ url: `file:${databasePath}` });
  try {
    const quickCheck = await client.execute('PRAGMA quick_check;');
    const foreignKeys = await client.execute('PRAGMA foreign_key_check;');
    const userVersion = await client.execute('PRAGMA user_version;');
    const quickCheckValue = quickCheck.rows[0] ? Object.values(quickCheck.rows[0])[0] : undefined;
    if (String(quickCheckValue) !== 'ok') throw new Error('O banco do backup falhou no quick_check.');
    if (foreignKeys.rows.length > 0) throw new Error(`O banco do backup contém ${foreignKeys.rows.length} vínculo(s) inválido(s).`);
    return { schemaVersion: Number(userVersion.rows[0]?.user_version ?? 0) };
  } finally {
    client.close();
  }
}

export class BackupService {
  private static restoreFailureInjector: ((stage: string) => void | Promise<void>) | null = null;

  static setRestoreFailureInjectorForTests(injector: ((stage: string) => void | Promise<void>) | null) {
    if (process.env.NODE_ENV !== 'test' && !process.env.GEOGESTOR_DB_PATH?.includes('scratch')) {
      throw new Error('A injeção de falha de restauração é permitida somente em ambiente de teste.');
    }
    this.restoreFailureInjector = injector;
  }

  static getDatabasePath(): string {
    return process.env.GEOGESTOR_DB_PATH || path.resolve(__dirname, '../../../../data/geogestor.db');
  }

  static getDataDirectory(): string {
    return path.dirname(this.getDatabasePath());
  }

  static getBackupDirectory(): string {
    return path.join(this.getDataDirectory(), 'backups');
  }

  static async createLocalBackup(): Promise<{
    backupPath: string;
    bundlePath: string;
    manifestPath: string;
    copiedFiles: string[];
    validation: { quickCheck: 'ok'; foreignKeyViolations: 0 };
  }> {
    return MaintenanceCoordinator.runExclusive('backup', () => this.createBackupBundle({ type: 'database' }));
  }

  static async createCompleteBackup(filesRootDirectory: string) {
    return MaintenanceCoordinator.runExclusive('backup', () => this.createBackupBundle({ type: 'complete', filesRootDirectory }));
  }

  private static async createBackupBundle(input: { type: 'database' | 'complete'; filesRootDirectory?: string }) {
    const backupDirectory = this.getBackupDirectory();
    await fs.mkdir(backupDirectory, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bundleName = `geogestor-backup-${input.type}-${timestamp}`;
    const bundlePath = path.join(backupDirectory, bundleName);
    const pendingPath = bundlePath;
    assertInside(bundlePath, backupDirectory);

    if (input.filesRootDirectory) {
      const sourceRoot = path.resolve(input.filesRootDirectory);
      const pendingRoot = path.resolve(pendingPath);
      if (pendingRoot === sourceRoot || pendingRoot.startsWith(`${sourceRoot}${path.sep}`)) {
        throw new Error('A pasta de backup não pode ficar dentro da pasta de documentos copiada.');
      }
    }

    await fs.rm(pendingPath, { recursive: true, force: true });
    await fs.mkdir(pendingPath, { recursive: true });
    await fs.writeFile(path.join(pendingPath, 'PENDING'), `${new Date().toISOString()}\n`, { encoding: 'utf8', flag: 'wx' });
    const backupDatabasePath = path.join(pendingPath, 'database.db');

    try {
      const safeBackupPath = backupDatabasePath.replace(/\\/g, '/').replace(/'/g, "''");
      await db.run(sql.raw(`VACUUM INTO '${safeBackupPath}'`));
      const databaseInspection = await inspectDatabase(backupDatabasePath);

      if (input.type === 'complete' && input.filesRootDirectory) {
        try {
          const stats = await fs.stat(input.filesRootDirectory);
          if (!stats.isDirectory()) throw new Error('A raiz de documentos não é uma pasta.');
          await fs.cp(input.filesRootDirectory, path.join(pendingPath, 'files'), { recursive: true, force: false });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          await fs.mkdir(path.join(pendingPath, 'files'), { recursive: true });
        }
      }

      const dataFiles = (await listFiles(pendingPath))
        .filter((file) => !file.endsWith('manifest.json') && !file.endsWith('COMPLETE') && !file.endsWith('PENDING'));
      const entries: BackupFileEntry[] = [];
      for (const file of dataFiles) {
        const stats = await fs.stat(file);
        entries.push({
          path: path.relative(pendingPath, file).replace(/\\/g, '/'),
          sizeBytes: stats.size,
          sha256: await sha256File(file)
        });
      }

      const now = new Date().toISOString();
      const manifest: BackupManifest = {
        formatVersion: BACKUP_FORMAT_VERSION,
        application: 'GeoGestor',
        createdAt: now,
        completedAt: now,
        schemaVersion: databaseInspection.schemaVersion,
        type: input.type,
        files: entries,
        totals: {
          files: entries.length,
          bytes: entries.reduce((sum, file) => sum + file.sizeBytes, 0)
        }
      };
      await writeJsonAtomic(path.join(pendingPath, 'manifest.json'), manifest);
      await fs.rm(path.join(pendingPath, 'PENDING'), { force: true });
      await fs.writeFile(path.join(pendingPath, 'COMPLETE'), `${manifest.completedAt}\n`, { encoding: 'utf8', flag: 'wx' });
      await this.validateBackup(bundlePath);
      await writeJsonAtomic(path.join(backupDirectory, 'last-backup.json'), {
        bundlePath,
        completedAt: manifest.completedAt,
        type: manifest.type,
        schemaVersion: manifest.schemaVersion
      });
      await this.enforceRetention();

      const backupPath = path.join(bundlePath, 'database.db');
      return {
        backupPath,
        bundlePath,
        manifestPath: path.join(bundlePath, 'manifest.json'),
        copiedFiles: manifest.files.map((entry) => path.join(bundlePath, entry.path)),
        validation: { quickCheck: 'ok' as const, foreignKeyViolations: 0 as const }
      };
    } catch (error) {
      await fs.rm(pendingPath, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  static async validateBackup(bundlePath: string) {
    const resolvedBundle = path.resolve(bundlePath);
    const backupDirectory = path.resolve(this.getBackupDirectory());
    assertInside(resolvedBundle, backupDirectory);
    const bundleStats = await fs.stat(resolvedBundle);
    if (bundleStats.isFile()) {
      throw new Error('Backup legado .db sem manifesto não pode ser restaurado automaticamente. Crie ou selecione um bundle validado do GeoGestor.');
    }
    if (!bundleStats.isDirectory()) throw new Error('O backup selecionado não é um diretório válido.');
    try {
      await fs.access(path.join(resolvedBundle, 'PENDING'));
      throw new Error('O backup ainda está incompleto.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await fs.access(path.join(resolvedBundle, 'COMPLETE'));
    const manifest = JSON.parse(await fs.readFile(path.join(resolvedBundle, 'manifest.json'), 'utf8')) as BackupManifest;
    if (manifest.formatVersion !== BACKUP_FORMAT_VERSION || manifest.application !== 'GeoGestor') {
      throw new Error('Formato de backup incompatível.');
    }
    if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 0) {
      throw new Error('Versão de schema inválida no manifesto do backup.');
    }
    if (manifest.schemaVersion > MANAGERIAL_FINANCE_MIGRATION.version) {
      throw new Error('Este backup foi criado por uma versão mais nova do GeoGestor. Atualize o aplicativo antes de restaurar.');
    }
    if (!Array.isArray(manifest.files) || !manifest.totals || !Number.isInteger(manifest.totals.files)) {
      throw new Error('Manifesto de backup inválido ou incompleto.');
    }

    let totalBytes = 0;
    for (const entry of manifest.files) {
      const filePath = path.join(resolvedBundle, entry.path);
      assertInside(filePath, resolvedBundle);
      const stats = await fs.stat(filePath);
      if (!stats.isFile() || stats.size !== entry.sizeBytes) throw new Error(`Tamanho divergente no backup: ${entry.path}`);
      if (await sha256File(filePath) !== entry.sha256) throw new Error(`Checksum divergente no backup: ${entry.path}`);
      totalBytes += stats.size;
    }
    if (manifest.totals.files !== manifest.files.length || manifest.totals.bytes !== totalBytes) {
      throw new Error('Totais do manifesto de backup são inconsistentes.');
    }
    const inspection = await inspectDatabase(path.join(resolvedBundle, 'database.db'));
    if (inspection.schemaVersion !== manifest.schemaVersion) throw new Error('Versão do schema diverge do manifesto.');
    return { manifest, quickCheck: 'ok' as const, foreignKeyViolations: 0 as const };
  }

  static async restoreBackup(input: {
    bundlePath: string;
    targetDatabasePath: string;
    targetFilesRoot?: string;
    confirmation: string;
  }) {
    if (input.confirmation !== RESTORE_CONFIRMATION) throw new Error('Confirmação de restauração inválida.');
    const validation = await this.validateBackup(input.bundlePath);
    if (validation.manifest.type === 'complete' && !input.targetFilesRoot) {
      throw new Error('A restauração completa exige uma pasta de destino para os documentos.');
    }

    const operationId = crypto.randomUUID();
    const targetDatabasePath = path.resolve(input.targetDatabasePath);
    const pendingDatabasePath = `${targetDatabasePath}.restore-${operationId}.pending`;
    const safetyDatabasePath = `${targetDatabasePath}.before-restore-${operationId}`;
    const sourceDatabasePath = path.join(path.resolve(input.bundlePath), 'database.db');
    await fs.mkdir(path.dirname(targetDatabasePath), { recursive: true });
    await fs.copyFile(sourceDatabasePath, pendingDatabasePath);

    let databaseMovedToSafety = false;
    let databaseInstalled = false;
    let filesMovedToSafety = false;
    let filesInstalled = false;
    let safetyFilesPath: string | null = null;
    let pendingFilesPath: string | null = null;
    const targetFilesRoot = input.targetFilesRoot ? path.resolve(input.targetFilesRoot) : null;
    try {
      try {
        await fs.access(targetDatabasePath);
        await inspectDatabase(targetDatabasePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      try {
        await renameWithRetry(targetDatabasePath, safetyDatabasePath);
        databaseMovedToSafety = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      await renameWithRetry(pendingDatabasePath, targetDatabasePath);
      databaseInstalled = true;
      await this.restoreFailureInjector?.('database-installed');

      if (validation.manifest.type === 'complete' && targetFilesRoot) {
        const sourceFiles = path.join(path.resolve(input.bundlePath), 'files');
        pendingFilesPath = `${targetFilesRoot}.restore-${operationId}.pending`;
        safetyFilesPath = `${targetFilesRoot}.before-restore-${operationId}`;
        await fs.cp(sourceFiles, pendingFilesPath, { recursive: true, force: false });
        try {
          await renameWithRetry(targetFilesRoot, safetyFilesPath);
          filesMovedToSafety = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        await renameWithRetry(pendingFilesPath, targetFilesRoot);
        filesInstalled = true;
        await this.restoreFailureInjector?.('files-installed');
      }

      await inspectDatabase(targetDatabasePath);
      await this.restoreFailureInjector?.('validated');
      return {
        restored: true,
        schemaVersion: validation.manifest.schemaVersion,
        safetyDatabasePath: databaseMovedToSafety ? safetyDatabasePath : null,
        safetyFilesPath: filesMovedToSafety ? safetyFilesPath : null
      };
    } catch (error) {
      if (filesInstalled && targetFilesRoot) await fs.rm(targetFilesRoot, { recursive: true, force: true }).catch(() => undefined);
      if (filesMovedToSafety && targetFilesRoot && safetyFilesPath) await renameWithRetry(safetyFilesPath, targetFilesRoot).catch(() => undefined);
      if (databaseInstalled) await fs.rm(targetDatabasePath, { force: true }).catch(() => undefined);
      if (databaseMovedToSafety) await renameWithRetry(safetyDatabasePath, targetDatabasePath).catch(() => undefined);
      if (pendingFilesPath) await fs.rm(pendingFilesPath, { recursive: true, force: true }).catch(() => undefined);
      await fs.rm(pendingDatabasePath, { force: true }).catch(() => undefined);
      throw error;
    }
  }

  static async enforceRetention(retention = Number(process.env.GEOGESTOR_BACKUP_RETENTION || DEFAULT_RETENTION)) {
    const backupDirectory = this.getBackupDirectory();
    const entries = await fs.readdir(backupDirectory, { withFileTypes: true });
    const bundles = entries
      .filter((entry) => entry.isDirectory() && /^geogestor-backup-(database|complete)-/.test(entry.name) && !entry.name.endsWith('.pending'))
      .map((entry) => entry.name)
      .sort()
      .reverse();
    for (const obsolete of bundles.slice(Math.max(1, retention))) {
      const target = path.join(backupDirectory, obsolete);
      assertInside(target, backupDirectory);
      await fs.rm(target, { recursive: true, force: true });
    }
  }
}
