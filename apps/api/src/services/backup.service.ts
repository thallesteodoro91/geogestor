import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import { createClient } from '@libsql/client';
import { MaintenanceCoordinator } from './maintenance-coordinator.service';
import { OPERATIONAL_INTEGRITY_MIGRATION } from './runtime-migrations/v7-operational-integrity';
import { cloneDatabaseEncryptedSync, databaseClientConfig, databaseKeyId, getDatabaseEncryptionKey } from '@geogestor/database';

const BACKUP_FORMAT_VERSION = 2;
const ENCRYPTED_FILE_MAGIC = Buffer.from('GGBAK2\0', 'ascii');
const ENCRYPTED_FILE_HEADER_BYTES = ENCRYPTED_FILE_MAGIC.length + 12;
const ENCRYPTED_FILE_TAG_BYTES = 16;
const DEFAULT_RETENTION = 10;
const RESTORE_CONFIRMATION = 'RESTORE_GEOGESTOR';

export type BackupExecutionOptions = {
  destinationDirectory?: string | null;
  retention?: number;
  maxStorageBytes?: number;
};

type BackupFileEntry = {
  path: string;
  sizeBytes: number;
  sha256: string;
  kind?: 'database' | 'document';
  logicalPathEncrypted?: string;
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
  encryption?: {
    algorithm: 'AES-256-GCM';
    kdf: 'HKDF-SHA-256';
    keyId: string;
    salt: string;
  };
};

function deriveBackupKey(databaseKey: string, salt: Buffer) {
  const source = Buffer.from(databaseKey, 'base64');
  try {
    return Buffer.from(crypto.hkdfSync('sha256', source, salt, Buffer.from('GeoGestor backup v2', 'utf8'), 32));
  } finally {
    source.fill(0);
  }
}

function encryptLogicalPath(key: Buffer, value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('GeoGestor backup path v2', 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptLogicalPath(key: Buffer, value: string) {
  const parts = value.split(':');
  if (parts.length !== 3) throw new Error('Caminho protegido do backup em formato inválido.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[0], 'base64'));
  decipher.setAAD(Buffer.from('GeoGestor backup path v2', 'utf8'));
  decipher.setAuthTag(Buffer.from(parts[1], 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64')), decipher.final()]).toString('utf8');
}

async function encryptFile(source: string, target: string, key: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, Buffer.concat([ENCRYPTED_FILE_MAGIC, iv]), { flag: 'wx' });
  await pipeline(createReadStream(source), cipher, createWriteStream(target, { flags: 'a' }));
  await fs.appendFile(target, cipher.getAuthTag());
}

async function encryptedFileParts(source: string) {
  const stats = await fs.stat(source);
  if (stats.size < ENCRYPTED_FILE_HEADER_BYTES + ENCRYPTED_FILE_TAG_BYTES) throw new Error('Arquivo protegido do backup está incompleto.');
  const handle = await fs.open(source, 'r');
  try {
    const header = Buffer.alloc(ENCRYPTED_FILE_HEADER_BYTES);
    const tag = Buffer.alloc(ENCRYPTED_FILE_TAG_BYTES);
    await handle.read(header, 0, header.length, 0);
    await handle.read(tag, 0, tag.length, stats.size - tag.length);
    if (!header.subarray(0, ENCRYPTED_FILE_MAGIC.length).equals(ENCRYPTED_FILE_MAGIC)) {
      throw new Error('Arquivo protegido do backup possui assinatura inválida.');
    }
    return { stats, iv: header.subarray(ENCRYPTED_FILE_MAGIC.length), tag };
  } finally {
    await handle.close();
  }
}

async function decryptFile(source: string, target: string, key: Buffer) {
  const { stats, iv, tag } = await encryptedFileParts(source);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await pipeline(
    createReadStream(source, { start: ENCRYPTED_FILE_HEADER_BYTES, end: stats.size - ENCRYPTED_FILE_TAG_BYTES - 1 }),
    decipher,
    createWriteStream(target, { flags: 'wx' })
  );
}

async function verifyEncryptedFile(source: string, key: Buffer) {
  const { stats, iv, tag } = await encryptedFileParts(source);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  await pipeline(
    createReadStream(source, { start: ENCRYPTED_FILE_HEADER_BYTES, end: stats.size - ENCRYPTED_FILE_TAG_BYTES - 1 }),
    decipher,
    new Writable({ write(_chunk, _encoding, callback) { callback(); } })
  );
}

function safeLogicalPath(value: string) {
  const normalized = value.replace(/\\/g, '/');
  if (!normalized || normalized.includes('\0') || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error('O backup contém um caminho de documento inválido.');
  }
  return normalized;
}

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
  const client = createClient(databaseClientConfig(databasePath));
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

  static getBackupDirectory(destinationDirectory?: string | null): string {
    return destinationDirectory?.trim()
      ? path.resolve(destinationDirectory)
      : path.join(this.getDataDirectory(), 'backups');
  }

  static async getStorageStatus(destinationDirectory?: string | null) {
    const backupDirectory = this.getBackupDirectory(destinationDirectory);
    await fs.mkdir(backupDirectory, { recursive: true });
    const entries = await fs.readdir(backupDirectory, { withFileTypes: true });
    let totalBytes = 0;
    let versions = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^geogestor-backup-(database|complete)-/.test(entry.name) || entry.name.endsWith('.pending')) continue;
      const manifest = await fs.readFile(path.join(backupDirectory, entry.name, 'manifest.json'), 'utf8')
        .then((raw) => JSON.parse(raw) as BackupManifest)
        .catch(() => null);
      if (!manifest) continue;
      versions += 1;
      totalBytes += Number(manifest.totals?.bytes || 0);
    }
    const disk = await fs.statfs(backupDirectory);
    return {
      backupDirectory,
      versions,
      totalBytes,
      availableBytes: Number(disk.bavail) * Number(disk.bsize)
    };
  }

  static async createLocalBackup(options: BackupExecutionOptions = {}): Promise<{
    backupPath: string;
    bundlePath: string;
    manifestPath: string;
    copiedFiles: string[];
    validation: { quickCheck: 'ok'; foreignKeyViolations: 0 };
  }> {
    return MaintenanceCoordinator.runExclusive('backup', () => this.createBackupBundle({ type: 'database', options }));
  }

  static async createCompleteBackup(filesRootDirectory: string, options: BackupExecutionOptions = {}) {
    return MaintenanceCoordinator.runExclusive('backup', () => this.createBackupBundle({ type: 'complete', filesRootDirectory, options }));
  }

  private static async createBackupBundle(input: { type: 'database' | 'complete'; filesRootDirectory?: string; options?: BackupExecutionOptions }) {
    const backupDirectory = this.getBackupDirectory(input.options?.destinationDirectory);
    await fs.mkdir(backupDirectory, { recursive: true });

    const available = await fs.statfs(backupDirectory).then((stats) => Number(stats.bavail) * Number(stats.bsize));
    const databaseBytes = await fs.stat(this.getDatabasePath()).then((stats) => stats.size);
    if (available < databaseBytes * 2) {
      throw new Error('NÃ£o hÃ¡ espaÃ§o livre suficiente para criar e validar um novo backup.');
    }

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
      const databaseEncryptionKey = getDatabaseEncryptionKey();
      const backupSalt = databaseEncryptionKey ? crypto.randomBytes(32) : null;
      const backupKey = databaseEncryptionKey && backupSalt ? deriveBackupKey(databaseEncryptionKey, backupSalt) : null;
      cloneDatabaseEncryptedSync(this.getDatabasePath(), backupDatabasePath);
      const databaseInspection = await inspectDatabase(backupDatabasePath);
      const databaseStats = await fs.stat(backupDatabasePath);
      const entries: BackupFileEntry[] = [{
        path: 'database.db',
        kind: 'database',
        sizeBytes: databaseStats.size,
        sha256: await sha256File(backupDatabasePath)
      }];

      if (input.type === 'complete' && input.filesRootDirectory) {
        try {
          const stats = await fs.stat(input.filesRootDirectory);
          if (!stats.isDirectory()) throw new Error('A raiz de documentos não é uma pasta.');
          const sourceRoot = path.resolve(input.filesRootDirectory);
          for (const sourceFile of await listFiles(sourceRoot)) {
            const logicalPath = safeLogicalPath(path.relative(sourceRoot, sourceFile));
            if (backupKey) {
              const storagePath = `objects/${crypto.randomUUID()}.ggenc`;
              const target = path.join(pendingPath, storagePath);
              await encryptFile(sourceFile, target, backupKey);
              const targetStats = await fs.stat(target);
              entries.push({
                path: storagePath,
                kind: 'document',
                logicalPathEncrypted: encryptLogicalPath(backupKey, logicalPath),
                sizeBytes: targetStats.size,
                sha256: await sha256File(target)
              });
            } else {
              const storagePath = `files/${logicalPath}`;
              const target = path.join(pendingPath, storagePath);
              await fs.mkdir(path.dirname(target), { recursive: true });
              await fs.copyFile(sourceFile, target, fs.constants.COPYFILE_EXCL);
              const targetStats = await fs.stat(target);
              entries.push({ path: storagePath, sizeBytes: targetStats.size, sha256: await sha256File(target) });
            }
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          if (!backupKey) await fs.mkdir(path.join(pendingPath, 'files'), { recursive: true });
        }
      }

      const now = new Date().toISOString();
      const manifest: BackupManifest = {
        formatVersion: databaseEncryptionKey ? BACKUP_FORMAT_VERSION : 1,
        application: 'GeoGestor',
        createdAt: now,
        completedAt: now,
        schemaVersion: databaseInspection.schemaVersion,
        type: input.type,
        files: entries,
        totals: {
          files: entries.length,
          bytes: entries.reduce((sum, file) => sum + file.sizeBytes, 0)
        },
        ...(databaseEncryptionKey && backupSalt ? {
          encryption: {
            algorithm: 'AES-256-GCM' as const,
            kdf: 'HKDF-SHA-256' as const,
            keyId: databaseKeyId(databaseEncryptionKey)!,
            salt: backupSalt.toString('base64')
          }
        } : {})
      };
      backupKey?.fill(0);
      await writeJsonAtomic(path.join(pendingPath, 'manifest.json'), manifest);
      await fs.rm(path.join(pendingPath, 'PENDING'), { force: true });
      await fs.writeFile(path.join(pendingPath, 'COMPLETE'), `${manifest.completedAt}\n`, { encoding: 'utf8', flag: 'wx' });
      await this.validateBackup(bundlePath, backupDirectory);
      await writeJsonAtomic(path.join(backupDirectory, 'last-backup.json'), {
        bundlePath,
        completedAt: manifest.completedAt,
        type: manifest.type,
        schemaVersion: manifest.schemaVersion
      });
      await this.enforceRetention(
        input.options?.retention,
        backupDirectory,
        input.options?.maxStorageBytes
      );

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

  static async validateBackup(bundlePath: string, allowedBackupDirectory = this.getBackupDirectory()) {
    const resolvedBundle = path.resolve(bundlePath);
    const backupDirectory = path.resolve(allowedBackupDirectory);
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
    if (![1, BACKUP_FORMAT_VERSION].includes(manifest.formatVersion) || manifest.application !== 'GeoGestor') {
      throw new Error('Formato de backup incompatível.');
    }
    let backupKey: Buffer | null = null;
    if (manifest.formatVersion === BACKUP_FORMAT_VERSION) {
      const databaseEncryptionKey = getDatabaseEncryptionKey(true);
      if (
        manifest.encryption?.algorithm !== 'AES-256-GCM'
        || manifest.encryption.kdf !== 'HKDF-SHA-256'
        || manifest.encryption.keyId !== databaseKeyId(databaseEncryptionKey)
      ) {
        throw new Error('O backup foi protegido com outra chave ou possui metadados incompatíveis.');
      }
      const salt = Buffer.from(manifest.encryption.salt, 'base64');
      if (salt.length !== 32) throw new Error('O salt criptográfico do backup é inválido.');
      backupKey = deriveBackupKey(databaseEncryptionKey, salt);
    }
    if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 0) {
      throw new Error('Versão de schema inválida no manifesto do backup.');
    }
    if (manifest.schemaVersion > OPERATIONAL_INTEGRITY_MIGRATION.version) {
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
      if (manifest.formatVersion === BACKUP_FORMAT_VERSION && entry.kind === 'document') {
        if (!backupKey || !entry.logicalPathEncrypted) throw new Error('Entrada protegida de documento está incompleta.');
        safeLogicalPath(decryptLogicalPath(backupKey, entry.logicalPathEncrypted));
        await verifyEncryptedFile(filePath, backupKey);
      }
      totalBytes += stats.size;
    }
    if (manifest.totals.files !== manifest.files.length || manifest.totals.bytes !== totalBytes) {
      throw new Error('Totais do manifesto de backup são inconsistentes.');
    }
    const inspection = await inspectDatabase(path.join(resolvedBundle, 'database.db'));
    if (inspection.schemaVersion !== manifest.schemaVersion) throw new Error('Versão do schema diverge do manifesto.');
    backupKey?.fill(0);
    return { manifest, quickCheck: 'ok' as const, foreignKeyViolations: 0 as const };
  }

  static async restoreBackup(input: {
    bundlePath: string;
    targetDatabasePath: string;
    targetFilesRoot?: string;
    confirmation: string;
    allowedBackupDirectory?: string;
  }) {
    if (input.confirmation !== RESTORE_CONFIRMATION) throw new Error('Confirmação de restauração inválida.');
    const validation = await this.validateBackup(input.bundlePath, input.allowedBackupDirectory || this.getBackupDirectory());
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
        pendingFilesPath = `${targetFilesRoot}.restore-${operationId}.pending`;
        safetyFilesPath = `${targetFilesRoot}.before-restore-${operationId}`;
        if (validation.manifest.formatVersion === BACKUP_FORMAT_VERSION) {
          const databaseEncryptionKey = getDatabaseEncryptionKey(true);
          const salt = Buffer.from(validation.manifest.encryption!.salt, 'base64');
          const backupKey = deriveBackupKey(databaseEncryptionKey, salt);
          await fs.mkdir(pendingFilesPath, { recursive: true });
          try {
            for (const entry of validation.manifest.files.filter((item) => item.kind === 'document')) {
              const logicalPath = safeLogicalPath(decryptLogicalPath(backupKey, entry.logicalPathEncrypted!));
              const source = path.join(path.resolve(input.bundlePath), entry.path);
              const target = path.join(pendingFilesPath, logicalPath);
              assertInside(target, pendingFilesPath);
              await decryptFile(source, target, backupKey);
            }
          } finally {
            backupKey.fill(0);
          }
        } else {
          const sourceFiles = path.join(path.resolve(input.bundlePath), 'files');
          await fs.cp(sourceFiles, pendingFilesPath, { recursive: true, force: false });
        }
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

  static async enforceRetention(
    retention = Number(process.env.GEOGESTOR_BACKUP_RETENTION || DEFAULT_RETENTION),
    backupDirectory = this.getBackupDirectory(),
    maxStorageBytes = 0
  ) {
    const entries = await fs.readdir(backupDirectory, { withFileTypes: true });
    const bundles = entries
      .filter((entry) => entry.isDirectory() && /^geogestor-backup-(database|complete)-/.test(entry.name) && !entry.name.endsWith('.pending'))
      .map((entry) => entry.name)
      .sort()
      .reverse();
    let accumulatedBytes = 0;
    for (const [index, bundle] of bundles.entries()) {
      const target = path.join(backupDirectory, bundle);
      const manifest = await fs.readFile(path.join(target, 'manifest.json'), 'utf8')
        .then((raw) => JSON.parse(raw) as BackupManifest)
        .catch(() => null);
      const bytes = Number(manifest?.totals?.bytes || 0);
      accumulatedBytes += bytes;
      const exceedsCount = index >= Math.max(1, retention);
      const exceedsStorage = maxStorageBytes > 0 && accumulatedBytes > maxStorageBytes && index > 0;
      if (!exceedsCount && !exceedsStorage) continue;
      accumulatedBytes -= bytes;
      assertInside(target, backupDirectory);
      await fs.rm(target, { recursive: true, force: true });
    }
  }
}
