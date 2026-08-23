import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Transform, Writable } from 'node:stream';
import { createClient } from '@libsql/client';
import { MaintenanceCoordinator } from './maintenance-coordinator.service';
import { MaintenanceHistoryService } from './maintenance-history.service';
import { BackupDeviceService, type BackupDeviceIdentity } from './backup-device.service';
import { BackupRecoveryService, type BackupKeyEnvelope } from './backup-recovery.service';
import { UNIFIED_ALERTS_MIGRATION } from './runtime-migrations/v8-unified-alerts';
import { GEOSPATIAL_POLISH_MIGRATION } from './runtime-migrations/v13-geospatial-polish';
import { cloneDatabaseEncryptedSync, cloneDatabaseWithKeysSync, databaseClientConfig, databaseKeyId, getDatabaseEncryptionKey, validateProtectedDatabaseIsolatedSync } from '@geogestor/database';

const BACKUP_FORMAT_VERSION = 4;
const SUPPORTED_BACKUP_FORMATS = new Set([1, 2, 3, BACKUP_FORMAT_VERSION]);
const ENCRYPTED_FILE_MAGIC = Buffer.from('GGBAK2\0', 'ascii');
const ENCRYPTED_FILE_HEADER_BYTES = ENCRYPTED_FILE_MAGIC.length + 12;
const ENCRYPTED_FILE_TAG_BYTES = 16;
const DEFAULT_RETENTION = 10;
const RESTORE_CONFIRMATION = 'RESTORE_GEOGESTOR';

export type BackupExecutionOptions = {
  destinationDirectory?: string | null;
  retention?: number;
  maxStorageBytes?: number;
  retentionRecentHours?: number;
  retentionDailyDays?: number;
  retentionMonthlyMonths?: number;
  onProgress?: (progress: { stage: string; processedFiles: number; processedBytes: number; totalFiles: number; totalBytes: number }) => void | Promise<void>;
  shouldCancel?: () => boolean;
};

type BackupFileEntry = {
  path: string;
  sizeBytes: number;
  sha256?: string;
  contentSha256?: string;
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
  credentialsExcluded?: boolean;
  device?: BackupDeviceIdentity;
  encryption?: {
    algorithm: 'AES-256-GCM';
    kdf?: 'HKDF-SHA-256';
    keyId?: string;
    salt?: string;
    dataKey?: 'random-per-backup';
    keyEnvelopes?: BackupKeyEnvelope[];
  };
};

export type BackupUnlockOptions = {
  recoveryCode?: string | null;
  recoverySecret?: string | null;
};

export class MaintenanceCancelledError extends Error {
  constructor() {
    super('Operação cancelada em um ponto seguro. Os dados originais foram preservados.');
    this.name = 'MaintenanceCancelledError';
  }
}

function deriveBackupKey(databaseKey: string, salt: Buffer) {
  const source = Buffer.from(databaseKey, 'base64');
  try {
    return Buffer.from(crypto.hkdfSync('sha256', source, salt, Buffer.from('GeoGestor backup v2', 'utf8'), 32));
  } finally {
    source.fill(0);
  }
}

function resolveBackupDataKey(manifest: BackupManifest, unlock: BackupUnlockOptions = {}) {
  if (!manifest.encryption) return null;
  if (manifest.formatVersion >= 4) {
    const envelopes = manifest.encryption.keyEnvelopes;
    if (!Array.isArray(envelopes) || envelopes.length === 0) {
      throw new Error('O backup não contém envelopes de recuperação válidos.');
    }
    return BackupRecoveryService.resolveDataKey(envelopes, {
      deviceKey: getDatabaseEncryptionKey(),
      recoveryCode: unlock.recoveryCode,
      recoverySecret: unlock.recoverySecret
    });
  }
  const databaseEncryptionKey = getDatabaseEncryptionKey(true);
  if (
    manifest.encryption.algorithm !== 'AES-256-GCM'
    || manifest.encryption.kdf !== 'HKDF-SHA-256'
    || manifest.encryption.keyId !== databaseKeyId(databaseEncryptionKey)
  ) {
    throw new Error('Este backup antigo depende da chave do computador original e não pode ser aberto neste dispositivo.');
  }
  const salt = Buffer.from(manifest.encryption.salt || '', 'base64');
  if (salt.length !== 32) throw new Error('O salt criptográfico do backup é inválido.');
  return deriveBackupKey(databaseEncryptionKey, salt);
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

function sameSourceIdentity(before: Awaited<ReturnType<typeof fs.stat>>, after: Awaited<ReturnType<typeof fs.stat>>) {
  return before.size === after.size
    && before.mtimeMs === after.mtimeMs
    && (before.ino === 0 || after.ino === 0 || before.ino === after.ino);
}

async function captureStableEncryptedFile(source: string, objectsDirectory: string, key: Buffer, logicalPath: string) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const temporary = path.join(objectsDirectory, `.pending-${crypto.randomUUID()}.ggenc`);
    try {
      const before = await fs.stat(source);
      if (!before.isFile()) throw new Error('A origem deixou de ser um arquivo regular.');
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const contentHash = crypto.createHash('sha256');
      const hashingStream = new Transform({
        transform(chunk, _encoding, callback) {
          contentHash.update(chunk);
          callback(null, chunk);
        }
      });
      await fs.mkdir(objectsDirectory, { recursive: true });
      await fs.writeFile(temporary, Buffer.concat([ENCRYPTED_FILE_MAGIC, iv]), { flag: 'wx' });
      await pipeline(createReadStream(source), hashingStream, cipher, createWriteStream(temporary, { flags: 'a' }));
      await fs.appendFile(temporary, cipher.getAuthTag());
      const after = await fs.stat(source);
      if (!sameSourceIdentity(before, after)) {
        throw new Error('O arquivo mudou enquanto era copiado.');
      }
      const contentSha256 = contentHash.digest('hex');
      const storagePath = `objects/${contentSha256}.ggenc`;
      const target = path.join(path.dirname(objectsDirectory), storagePath);
      try {
        await fs.rename(temporary, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await removeWithRetry(temporary, { force: true });
      }
      const targetStats = await fs.stat(target);
      return { storagePath, contentSha256, sizeBytes: targetStats.size, sha256: await sha256File(target) };
    } catch (error) {
      lastError = error;
      await removeWithRetry(temporary, { force: true }).catch(() => undefined);
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt < 3 && (!code || ['EBUSY', 'EPERM', 'EACCES'].includes(code) || (error instanceof Error && error.message.includes('mudou')))) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        continue;
      }
      break;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : 'não foi possível ler o arquivo';
  throw new Error(`Feche o arquivo “${logicalPath}” e tente novamente. ${detail}`);
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

async function renameWithRetry(source: string, target: string, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fs.rename(source, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(code || '') || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

async function promoteBackupBundle(source: string, target: string, backupDirectory: string) {
  try {
    await renameWithRetry(source, target, 6);
    return false;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!['EBUSY', 'EPERM', 'EACCES'].includes(code || '') || process.platform !== 'win32') throw error;
  }

  assertInside(source, backupDirectory);
  assertInside(target, backupDirectory);
  await fs.mkdir(target, { recursive: false });
  await fs.writeFile(path.join(target, 'PENDING'), 'Promoção segura em andamento.\n', { encoding: 'utf8', flag: 'wx' });
  try {
    await fs.cp(source, target, { recursive: true, force: false });
    return true;
  } catch (error) {
    await removeWithRetry(target, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function removeWithRetry(target: string, options: { recursive?: boolean; force?: boolean } = {}) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await fs.rm(target, options);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(code || '') || attempt === 19) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
}

async function inspectDatabase(databasePath: string, encryptionKey = getDatabaseEncryptionKey()) {
  const client = createClient(databaseClientConfig(databasePath, encryptionKey));
  try {
    const quickCheck = await client.execute('PRAGMA quick_check;');
    const foreignKeys = await client.execute('PRAGMA foreign_key_check;');
    const userVersion = await client.execute('PRAGMA user_version;');
    const quickCheckValue = quickCheck.rows[0] ? Object.values(quickCheck.rows[0])[0] : undefined;
    if (String(quickCheckValue) !== 'ok') throw new Error('O banco do backup falhou no quick_check.');
    if (foreignKeys.rows.length > 0) throw new Error(`O banco do backup contém ${foreignKeys.rows.length} vínculo(s) inválido(s).`);
    return { schemaVersion: Number(userVersion.rows[0]?.user_version ?? 0) };
  } finally {
    await client.close();
  }
}

function runSensitiveCredentialWorker(
  operation: 'count-sensitive-credentials' | 'scrub-sensitive-credentials',
  databasePath: string,
  encryptionKey: string | undefined
) {
  const workerPath = process.env.GEOGESTOR_DATABASE_WORKER;
  if (!workerPath) return null;
  const runner = process.env.GEOGESTOR_DATABASE_WORKER_RUNNER;
  const args = runner
    ? [runner, workerPath, operation, databasePath]
    : [workerPath, operation, databasePath];
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (encryptionKey) env.GEOGESTOR_DB_SOURCE_KEY = encryptionKey;
  else delete env.GEOGESTOR_DB_SOURCE_KEY;
  const result = spawnSync(process.execPath, args, {
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 2 * 60 * 1_000
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr?.trim() || `código ${result.status ?? 'desconhecido'}`;
    throw new Error(`A proteção de credenciais do backup falhou: ${detail}`);
  }
  const parsed = JSON.parse(result.stdout.trim()) as { total?: unknown };
  return Number(parsed.total || 0);
}

async function excludeSensitiveCredentials(databasePath: string, encryptionKey = getDatabaseEncryptionKey()) {
  const isolatedTotal = runSensitiveCredentialWorker('scrub-sensitive-credentials', databasePath, encryptionKey);
  if (isolatedTotal !== null) {
    if (isolatedTotal !== 0) throw new Error('A cópia de backup ainda contém credenciais sensíveis e foi recusada.');
    return;
  }
  const client = createClient(databaseClientConfig(databasePath, encryptionKey));
  try {
    await client.execute(`
      UPDATE configuracoes
      SET google_client_secret = NULL,
          google_refresh_token = NULL,
          google_access_token = NULL,
          google_sync_active = 0
    `);
    await client.execute('VACUUM;');
    const result = await client.execute(`
      SELECT COUNT(*) AS total
      FROM configuracoes
      WHERE google_client_secret IS NOT NULL
         OR google_refresh_token IS NOT NULL
         OR google_access_token IS NOT NULL
    `);
    if (Number(result.rows[0]?.total || 0) !== 0) {
      throw new Error('A cópia de backup ainda contém credenciais sensíveis e foi recusada.');
    }
  } finally {
    await client.close();
  }
}

async function countSensitiveCredentials(databasePath: string, encryptionKey = getDatabaseEncryptionKey()) {
  const isolatedTotal = runSensitiveCredentialWorker('count-sensitive-credentials', databasePath, encryptionKey);
  if (isolatedTotal !== null) return isolatedTotal;
  const client = createClient(databaseClientConfig(databasePath, encryptionKey));
  try {
    const result = await client.execute(`
      SELECT COUNT(*) AS total
      FROM configuracoes
      WHERE google_client_secret IS NOT NULL
         OR google_refresh_token IS NOT NULL
         OR google_access_token IS NOT NULL
    `);
    return Number(result.rows[0]?.total || 0);
  } finally {
    await client.close();
  }
}

async function checkpoint(options: BackupExecutionOptions | undefined, progress: {
  stage: string;
  processedFiles: number;
  processedBytes: number;
  totalFiles: number;
  totalBytes: number;
}) {
  if (options?.shouldCancel?.()) throw new MaintenanceCancelledError();
  await options?.onProgress?.(progress);
}

function runRestoreWorkerSync(input: Record<string, unknown>) {
  const workerPath = process.env.GEOGESTOR_BACKUP_RESTORE_WORKER;
  if (!workerPath) return null;
  const runner = process.env.GEOGESTOR_BACKUP_RESTORE_WORKER_RUNNER;
  const metadataDatabasePath = path.join(os.tmpdir(), `geogestor-restore-worker-${crypto.randomUUID()}.db`);
  const args = runner ? [runner, workerPath] : [workerPath];
  const request = Buffer.from(JSON.stringify({ ...input, skipHistory: true, metadataDatabasePath }), 'utf8').toString('base64');
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GEOGESTOR_BACKUP_RESTORE_WORKER_ACTIVE: '1',
    GEOGESTOR_BACKUP_RESTORE_REQUEST: request,
    GEOGESTOR_DB_PATH: metadataDatabasePath
  };
  const result = spawnSync(process.execPath, args, {
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30 * 60 * 1_000,
    maxBuffer: 2 * 1024 * 1024
  });
  delete env.GEOGESTOR_BACKUP_RESTORE_REQUEST;
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr?.trim() || 'O processo auxiliar de restauração foi interrompido.';
    throw new Error(detail);
  }
  const line = result.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!line) throw new Error('O processo auxiliar não retornou a confirmação da restauração.');
  const payload = JSON.parse(line) as { ok: boolean; result?: unknown; error?: string };
  if (!payload.ok) throw new Error(payload.error || 'A restauração isolada falhou.');
  return payload.result;
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
    const [restoreTests, integrityChecks] = await Promise.all([
      MaintenanceHistoryService.list({ type: 'restore_test', limit: 500 }),
      MaintenanceHistoryService.list({ type: 'integrity_check', limit: 500 })
    ]);
    const history: Array<{
      directory: string;
      type: BackupManifest['type'];
      createdAt: string;
      completedAt: string;
      files: number;
      bytes: number;
      encrypted: boolean;
      integrity: 'verified' | 'legacy-unverified';
      integrityState: 'verified_at_creation' | 'verified_again' | 'failed' | 'legacy_unverified';
      integrityVerifiedAt: string | null;
      credentialsExcluded: boolean;
      restoreTestedAt: string | null;
      legacy: boolean;
      formatVersion: number | null;
    }> = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.db')) {
        const stats = await fs.stat(path.join(backupDirectory, entry.name));
        const completedAt = stats.mtime.toISOString();
        versions += 1;
        totalBytes += stats.size;
        history.push({
          directory: entry.name,
          type: 'database',
          createdAt: (stats.birthtimeMs > 0 ? stats.birthtime : stats.mtime).toISOString(),
          completedAt,
          files: 1,
          bytes: stats.size,
          encrypted: false,
          integrity: 'legacy-unverified',
          integrityState: 'legacy_unverified',
          integrityVerifiedAt: null,
          credentialsExcluded: false,
          restoreTestedAt: null,
          legacy: true,
          formatVersion: null
        });
        continue;
      }
      if (!entry.isDirectory() || !/^geogestor-backup-(database|complete)-/.test(entry.name) || entry.name.includes('.pending-')) continue;
      const manifest = await fs.readFile(path.join(backupDirectory, entry.name, 'manifest.json'), 'utf8')
        .then((raw) => JSON.parse(raw) as BackupManifest)
        .catch(() => null);
      if (!manifest) continue;
      const latestIntegrityCheck = integrityChecks.find((check) => check.sourceLabel === entry.name);
      const includesChecksums = manifest.files?.every((file) => Boolean(file.sha256));
      versions += 1;
      totalBytes += Number(manifest.totals?.bytes || 0);
      history.push({
        directory: entry.name,
        type: manifest.type,
        createdAt: manifest.createdAt,
        completedAt: manifest.completedAt,
        files: Number(manifest.totals?.files || 0),
        bytes: Number(manifest.totals?.bytes || 0),
        encrypted: Boolean(manifest.encryption),
        integrity: includesChecksums ? 'verified' : 'legacy-unverified',
        integrityState: !includesChecksums ? 'legacy_unverified'
          : latestIntegrityCheck?.status === 'failed' ? 'failed'
            : latestIntegrityCheck?.status === 'success' ? 'verified_again'
              : 'verified_at_creation',
        integrityVerifiedAt: latestIntegrityCheck?.status === 'success' ? latestIntegrityCheck.completedAt : includesChecksums ? manifest.completedAt : null,
        credentialsExcluded: Boolean(manifest.credentialsExcluded),
        restoreTestedAt: restoreTests.find((test) => test.status === 'success' && test.sourceLabel === entry.name)?.completedAt || null,
        legacy: false,
        formatVersion: manifest.formatVersion
      });
    }
    const sortedHistory = history.sort((left, right) => right.completedAt.localeCompare(left.completedAt));
    const disk = await fs.statfs(backupDirectory);
    return {
      backupDirectory,
      versions,
      totalBytes,
      availableBytes: Number(disk.bavail) * Number(disk.bsize),
      latestByType: {
        database: sortedHistory.find((item) => item.type === 'database' && !item.legacy) || null,
        complete: sortedHistory.find((item) => item.type === 'complete' && !item.legacy) || null
      },
      legacyVersions: history.filter((item) => item.legacy).length,
      history: sortedHistory.slice(0, 10)
    };
  }

  static async createLocalBackup(options: BackupExecutionOptions = {}): Promise<{
    backupPath: string;
    bundlePath: string;
    manifestPath: string;
    copiedFiles: string[];
    validation: { quickCheck: 'ok'; foreignKeyViolations: 0 };
    totalBytes: number;
    totalFiles: number;
  }> {
    return MaintenanceCoordinator.runExclusive('backup', () => this.createBackupBundle({ type: 'database', options }));
  }

  static async createCompleteBackup(filesRootDirectory: string, options: BackupExecutionOptions = {}) {
    return MaintenanceCoordinator.runExclusive('backup', () => this.createBackupBundle({ type: 'complete', filesRootDirectory, options }));
  }

  private static async createBackupBundle(input: { type: 'database' | 'complete'; filesRootDirectory?: string; options?: BackupExecutionOptions }) {
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();
    const backupDirectory = this.getBackupDirectory(input.options?.destinationDirectory);
    await fs.mkdir(backupDirectory, { recursive: true });

    const available = await fs.statfs(backupDirectory).then((stats) => Number(stats.bavail) * Number(stats.bsize));
    const databaseBytes = await fs.stat(this.getDatabasePath()).then((stats) => stats.size);
    let sourceFiles: string[] = [];
    if (input.type === 'complete' && input.filesRootDirectory) {
      try {
        sourceFiles = await listFiles(path.resolve(input.filesRootDirectory));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    const sourceStats = await Promise.all(sourceFiles.map((file) => fs.stat(file)));
    const sourceBytes = sourceStats.reduce((sum, stats) => sum + stats.size, 0);
    const estimatedBytes = databaseBytes + sourceBytes;
    if (available < Math.max(databaseBytes * 2, Math.ceil(estimatedBytes * 1.1))) {
      throw new Error('Não há espaço livre suficiente para criar e validar um novo backup.');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const bundleName = `geogestor-backup-${input.type}-${timestamp}`;
    const bundlePath = path.join(backupDirectory, bundleName);
    const pendingPath = path.join(backupDirectory, `${bundleName}.pending-${crypto.randomUUID()}`);
    assertInside(bundlePath, backupDirectory);
    assertInside(pendingPath, backupDirectory);

    if (input.filesRootDirectory) {
      const sourceRoot = path.resolve(input.filesRootDirectory);
      const pendingRoot = path.resolve(pendingPath);
      if (pendingRoot === sourceRoot || pendingRoot.startsWith(`${sourceRoot}${path.sep}`)) {
        throw new Error('A pasta de backup não pode ficar dentro da pasta de documentos copiada.');
      }
    }

    await removeWithRetry(pendingPath, { recursive: true, force: true });
    await fs.mkdir(pendingPath, { recursive: true });
    await fs.writeFile(path.join(pendingPath, 'PENDING'), `${new Date().toISOString()}\n`, { encoding: 'utf8', flag: 'wx' });
    const backupDatabasePath = path.join(pendingPath, 'database.db');

    try {
      await checkpoint(input.options, {
        stage: 'Preparando cópia segura do banco',
        processedFiles: 0,
        processedBytes: 0,
        totalFiles: sourceFiles.length + 1,
        totalBytes: estimatedBytes
      });
      const databaseEncryptionKey = getDatabaseEncryptionKey();
      const recoverySecret = BackupRecoveryService.getConfiguredRecoverySecret(false);
      const portableRecovery = Boolean(databaseEncryptionKey && recoverySecret);
      const dataKey = portableRecovery ? crypto.randomBytes(32) : null;
      const backupSalt = !portableRecovery && databaseEncryptionKey ? crypto.randomBytes(32) : null;
      const backupKey = dataKey || (databaseEncryptionKey && backupSalt ? deriveBackupKey(databaseEncryptionKey, backupSalt) : null);
      const backupDatabaseEncryptionKey = dataKey?.toString('base64') || databaseEncryptionKey;
      if (portableRecovery && databaseEncryptionKey && backupDatabaseEncryptionKey) {
        cloneDatabaseWithKeysSync(this.getDatabasePath(), databaseEncryptionKey, backupDatabasePath, backupDatabaseEncryptionKey);
      } else {
        cloneDatabaseEncryptedSync(this.getDatabasePath(), backupDatabasePath);
      }
      await excludeSensitiveCredentials(backupDatabasePath, backupDatabaseEncryptionKey);
      const databaseInspection = backupDatabaseEncryptionKey
        ? validateProtectedDatabaseIsolatedSync(backupDatabasePath, backupDatabaseEncryptionKey)
        : await inspectDatabase(backupDatabasePath, backupDatabaseEncryptionKey);
      const databaseStats = await fs.stat(backupDatabasePath);
      const databaseHash = await sha256File(backupDatabasePath);
      const entries: BackupFileEntry[] = [{
        path: 'database.db',
        kind: 'database',
        sizeBytes: databaseStats.size,
        sha256: databaseHash,
        contentSha256: databaseHash
      }];
      let processedBytes = databaseBytes;
      await checkpoint(input.options, {
        stage: sourceFiles.length > 0 ? 'Protegendo documentos' : 'Validando backup',
        processedFiles: 1,
        processedBytes,
        totalFiles: sourceFiles.length + 1,
        totalBytes: estimatedBytes
      });

      if (input.type === 'complete' && input.filesRootDirectory) {
        try {
          const stats = await fs.stat(input.filesRootDirectory);
          if (!stats.isDirectory()) throw new Error('A raiz de documentos não é uma pasta.');
          const sourceRoot = path.resolve(input.filesRootDirectory);
          for (const [sourceIndex, sourceFile] of sourceFiles.entries()) {
            await checkpoint(input.options, {
              stage: 'Protegendo documentos',
              processedFiles: entries.length,
              processedBytes,
              totalFiles: sourceFiles.length + 1,
              totalBytes: estimatedBytes
            });
            const logicalPath = safeLogicalPath(path.relative(sourceRoot, sourceFile));
            if (backupKey && portableRecovery) {
              const captured = await captureStableEncryptedFile(sourceFile, path.join(pendingPath, 'objects'), backupKey, logicalPath);
              entries.push({
                path: captured.storagePath,
                kind: 'document',
                logicalPathEncrypted: encryptLogicalPath(backupKey, logicalPath),
                sizeBytes: captured.sizeBytes,
                sha256: captured.sha256,
                contentSha256: captured.contentSha256
              });
            } else if (backupKey) {
              const contentSha256 = await sha256File(sourceFile);
              const storagePath = `objects/${crypto.randomUUID()}.ggenc`;
              const target = path.join(pendingPath, storagePath);
              await encryptFile(sourceFile, target, backupKey);
              const targetStats = await fs.stat(target);
              entries.push({
                path: storagePath,
                kind: 'document',
                logicalPathEncrypted: encryptLogicalPath(backupKey, logicalPath),
                sizeBytes: targetStats.size,
                sha256: await sha256File(target),
                contentSha256
              });
            } else {
              const contentSha256 = await sha256File(sourceFile);
              const storagePath = `files/${logicalPath}`;
              const target = path.join(pendingPath, storagePath);
              await fs.mkdir(path.dirname(target), { recursive: true });
              await fs.copyFile(sourceFile, target, fs.constants.COPYFILE_EXCL);
              const targetStats = await fs.stat(target);
              entries.push({ path: storagePath, kind: 'document', sizeBytes: targetStats.size, sha256: await sha256File(target), contentSha256 });
            }
            processedBytes += sourceStats[sourceIndex]?.size || 0;
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          if (!backupKey) await fs.mkdir(path.join(pendingPath, 'files'), { recursive: true });
        }
      }

      const now = new Date().toISOString();
      const device = await BackupDeviceService.getIdentity();
      const keyEnvelopes = portableRecovery && dataKey && databaseEncryptionKey && recoverySecret
        ? [
            BackupRecoveryService.wrapDataKey(dataKey, databaseEncryptionKey, 'device'),
            BackupRecoveryService.wrapDataKey(dataKey, recoverySecret, 'recovery')
          ]
        : null;
      const manifest: BackupManifest = {
        formatVersion: portableRecovery ? BACKUP_FORMAT_VERSION : 3,
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
        credentialsExcluded: true,
        device,
        ...(keyEnvelopes ? {
          encryption: {
            algorithm: 'AES-256-GCM' as const,
            dataKey: 'random-per-backup' as const,
            keyEnvelopes
          }
        } : databaseEncryptionKey && backupSalt ? {
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
      await removeWithRetry(path.join(pendingPath, 'PENDING'), { force: true });
      await fs.writeFile(path.join(pendingPath, 'COMPLETE'), `${manifest.completedAt}\n`, { encoding: 'utf8', flag: 'wx' });
      await this.validateBackup(pendingPath, backupDirectory);
      const promotedByCopy = await promoteBackupBundle(pendingPath, bundlePath, backupDirectory);
      if (promotedByCopy) {
        await removeWithRetry(path.join(bundlePath, 'PENDING'), { force: true });
        try {
          await this.validateBackup(bundlePath, backupDirectory);
        } catch (error) {
          await fs.writeFile(path.join(bundlePath, 'PENDING'), 'Cópia final não validada.\n', 'utf8').catch(() => undefined);
          throw error;
        }
        await removeWithRetry(pendingPath, { recursive: true, force: true }).catch(() => undefined);
      }
      await writeJsonAtomic(path.join(backupDirectory, 'last-backup.json'), {
        bundlePath,
        completedAt: manifest.completedAt,
        type: manifest.type,
        schemaVersion: manifest.schemaVersion
      });
      await this.enforceRetention(
        input.options?.retention,
        backupDirectory,
        input.options?.maxStorageBytes,
        input.options?.retentionRecentHours,
        input.options?.retentionDailyDays,
        input.options?.retentionMonthlyMonths
      );

      await checkpoint(input.options, {
        stage: 'Backup validado',
        processedFiles: manifest.totals.files,
        processedBytes: estimatedBytes,
        totalFiles: manifest.totals.files,
        totalBytes: estimatedBytes
      });
      await MaintenanceHistoryService.record({
        type: input.type === 'complete' ? 'backup_complete' : 'backup_database',
        status: 'success',
        startedAt,
        durationMs: Date.now() - startedAtMs,
        sourceLabel: input.type === 'complete' ? input.filesRootDirectory || 'documentos' : 'banco local',
        destinationLabel: bundlePath,
        files: manifest.totals.files,
        bytes: manifest.totals.bytes,
        user: 'admin',
        auditId: null,
        details: { checksums: true, credentialsExcluded: true }
      });

      const backupPath = path.join(bundlePath, 'database.db');
      return {
        backupPath,
        bundlePath,
        manifestPath: path.join(bundlePath, 'manifest.json'),
        copiedFiles: manifest.files.map((entry) => path.join(bundlePath, entry.path)),
        validation: { quickCheck: 'ok' as const, foreignKeyViolations: 0 as const },
        totalBytes: manifest.totals.bytes,
        totalFiles: manifest.totals.files
      };
    } catch (error) {
      await removeWithRetry(pendingPath, { recursive: true, force: true }).catch(() => undefined);
      await MaintenanceHistoryService.record({
        type: input.type === 'complete' ? 'backup_complete' : 'backup_database',
        status: error instanceof MaintenanceCancelledError ? 'cancelled' : 'failed',
        startedAt,
        durationMs: Date.now() - startedAtMs,
        sourceLabel: input.type === 'complete' ? input.filesRootDirectory || 'documentos' : 'banco local',
        destinationLabel: backupDirectory,
        files: null,
        bytes: null,
        user: 'admin',
        auditId: null,
        error
      }).catch(() => undefined);
      throw error;
    }
  }

  static async validateBackup(bundlePath: string, allowedBackupDirectory = this.getBackupDirectory(), unlock: BackupUnlockOptions = {}) {
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
    if (!SUPPORTED_BACKUP_FORMATS.has(manifest.formatVersion) || manifest.application !== 'GeoGestor') {
      throw new Error('Formato de backup incompatível.');
    }
    const backupKey = resolveBackupDataKey(manifest, unlock);
    if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 0) {
      throw new Error('Versão de schema inválida no manifesto do backup.');
    }
    if (manifest.schemaVersion > GEOSPATIAL_POLISH_MIGRATION.version) {
      throw new Error('Este backup foi criado por uma versão mais nova do GeoGestor. Atualize o aplicativo antes de restaurar.');
    }
    if (!Array.isArray(manifest.files) || !manifest.totals || !Number.isInteger(manifest.totals.files)) {
      throw new Error('Manifesto de backup inválido ou incompleto.');
    }

    let totalBytes = 0;
    let checksumFilesVerified = 0;
    for (const entry of manifest.files) {
      const filePath = path.join(resolvedBundle, entry.path);
      assertInside(filePath, resolvedBundle);
      const stats = await fs.stat(filePath);
      if (!stats.isFile() || stats.size !== entry.sizeBytes) throw new Error(`Tamanho divergente no backup: ${entry.path}`);
      if (entry.sha256) {
        if (await sha256File(filePath) !== entry.sha256) throw new Error(`Checksum divergente no backup: ${entry.path}`);
        checksumFilesVerified += 1;
      } else if (manifest.formatVersion >= 2) {
        throw new Error(`Checksum ausente no backup: ${entry.path}`);
      }
      if (manifest.encryption && entry.kind === 'document') {
        if (!backupKey || !entry.logicalPathEncrypted) throw new Error('Entrada protegida de documento está incompleta.');
        safeLogicalPath(decryptLogicalPath(backupKey, entry.logicalPathEncrypted));
        await verifyEncryptedFile(filePath, backupKey);
      }
      totalBytes += stats.size;
    }
    if (manifest.totals.files !== manifest.files.length || manifest.totals.bytes !== totalBytes) {
      throw new Error('Totais do manifesto de backup são inconsistentes.');
    }
    const backupDatabaseEncryptionKey = manifest.formatVersion >= 4 ? backupKey?.toString('base64') : getDatabaseEncryptionKey();
    const inspection = backupDatabaseEncryptionKey || process.env.GEOGESTOR_DATABASE_WORKER
      ? validateProtectedDatabaseIsolatedSync(path.join(resolvedBundle, 'database.db'), backupDatabaseEncryptionKey)
      : await inspectDatabase(path.join(resolvedBundle, 'database.db'), backupDatabaseEncryptionKey);
    if (manifest.credentialsExcluded && await countSensitiveCredentials(path.join(resolvedBundle, 'database.db'), backupDatabaseEncryptionKey) !== 0) {
      throw new Error('O backup contém credenciais que deveriam estar excluídas.');
    }
    if (inspection.schemaVersion !== manifest.schemaVersion) throw new Error('Versão do schema diverge do manifesto.');
    backupKey?.fill(0);
    return {
      manifest,
      quickCheck: 'ok' as const,
      foreignKeyViolations: 0 as const,
      integrity: checksumFilesVerified === manifest.files.length ? 'verified' as const : 'legacy-unverified' as const,
      checksumFilesVerified
    };
  }

  static async restoreBackup(input: {
    bundlePath: string;
    targetDatabasePath: string;
    targetFilesRoot?: string;
    confirmation: string;
    allowedBackupDirectory?: string;
    historyType?: 'restore' | 'restore_test';
    recoveryCode?: string | null;
    recoverySecret?: string | null;
    skipHistory?: boolean;
  }) {
    if (process.env.GEOGESTOR_BACKUP_RESTORE_WORKER_ACTIVE !== '1') {
      const isolated = runRestoreWorkerSync({
        ...input,
        allowedBackupDirectory: input.allowedBackupDirectory || this.getBackupDirectory()
      });
      if (isolated) return isolated as {
        restored: true;
        schemaVersion: number;
        safetyDatabasePath: string | null;
        safetyFilesPath: string | null;
        checksumFilesVerified: number;
      };
    }
    if (input.confirmation !== RESTORE_CONFIRMATION) throw new Error('Confirmação de restauração inválida.');
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();
    const unlock = { recoveryCode: input.recoveryCode, recoverySecret: input.recoverySecret };
    const validation = await this.validateBackup(input.bundlePath, input.allowedBackupDirectory || this.getBackupDirectory(), unlock);
    if (validation.manifest.type === 'complete' && !input.targetFilesRoot) {
      throw new Error('A restauração completa exige uma pasta de destino para os documentos.');
    }

    const operationId = crypto.randomUUID();
    const targetDatabasePath = path.resolve(input.targetDatabasePath);
    const pendingDatabasePath = `${targetDatabasePath}.restore-${operationId}.pending`;
    const safetyDatabasePath = `${targetDatabasePath}.before-restore-${operationId}`;
    const sourceDatabasePath = path.join(path.resolve(input.bundlePath), 'database.db');
    await fs.mkdir(path.dirname(targetDatabasePath), { recursive: true });
    const restoreDataKey = resolveBackupDataKey(validation.manifest, unlock);
    if (validation.manifest.formatVersion >= 4 && restoreDataKey) {
      cloneDatabaseWithKeysSync(
        sourceDatabasePath,
        restoreDataKey.toString('base64'),
        pendingDatabasePath,
        getDatabaseEncryptionKey()
      );
    } else {
      await fs.copyFile(sourceDatabasePath, pendingDatabasePath);
    }
    const databaseEntry = validation.manifest.files.find((entry) => entry.kind === 'database' || entry.path === 'database.db');
    if (validation.manifest.formatVersion < 4 && databaseEntry?.sha256 && await sha256File(pendingDatabasePath) !== databaseEntry.sha256) {
      await removeWithRetry(pendingDatabasePath, { force: true }).catch(() => undefined);
      throw new Error('Checksum divergente ao preparar o banco restaurado.');
    }

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
        validateProtectedDatabaseIsolatedSync(targetDatabasePath);
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
        if (validation.manifest.encryption) {
          const backupKey = restoreDataKey || resolveBackupDataKey(validation.manifest, unlock);
          if (!backupKey) throw new Error('A chave dos documentos do backup não está disponível.');
          await fs.mkdir(pendingFilesPath, { recursive: true });
          try {
            for (const entry of validation.manifest.files.filter((item) => item.kind === 'document')) {
              const logicalPath = safeLogicalPath(decryptLogicalPath(backupKey, entry.logicalPathEncrypted!));
              const source = path.join(path.resolve(input.bundlePath), entry.path);
              const target = path.join(pendingFilesPath, logicalPath);
              assertInside(target, pendingFilesPath);
              await decryptFile(source, target, backupKey);
              if (entry.contentSha256 && await sha256File(target) !== entry.contentSha256) {
                throw new Error(`Checksum divergente após restaurar o documento: ${logicalPath}`);
              }
            }
          } finally {
            backupKey.fill(0);
          }
        } else {
          const sourceFiles = path.join(path.resolve(input.bundlePath), 'files');
          await fs.cp(sourceFiles, pendingFilesPath, { recursive: true, force: false });
          for (const entry of validation.manifest.files.filter((item) => item.kind === 'document' || item.path.startsWith('files/'))) {
            const logicalPath = safeLogicalPath(entry.path.replace(/^files\//, ''));
            const restoredFile = path.join(pendingFilesPath, logicalPath);
            const expectedHash = entry.contentSha256 || entry.sha256;
            if (expectedHash && await sha256File(restoredFile) !== expectedHash) {
              throw new Error(`Checksum divergente após restaurar o documento: ${logicalPath}`);
            }
          }
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

      validateProtectedDatabaseIsolatedSync(targetDatabasePath);
      if (validation.manifest.credentialsExcluded && await countSensitiveCredentials(targetDatabasePath) !== 0) {
        throw new Error('A restauração detectou credenciais que deveriam estar excluídas do backup.');
      }
      await this.restoreFailureInjector?.('validated');
      if (!input.skipHistory) await MaintenanceHistoryService.record({
        type: input.historyType || 'restore',
        status: 'success',
        startedAt,
        durationMs: Date.now() - startedAtMs,
        sourceLabel: input.bundlePath,
        destinationLabel: input.historyType === 'restore_test' ? 'área temporária isolada' : targetDatabasePath,
        files: validation.manifest.totals.files,
        bytes: validation.manifest.totals.bytes,
        user: 'admin',
        auditId: null,
        details: {
          schemaVersion: validation.manifest.schemaVersion,
          checksumsVerified: validation.checksumFilesVerified,
          credentialsExcluded: Boolean(validation.manifest.credentialsExcluded)
        }
      });
      return {
        restored: true,
        schemaVersion: validation.manifest.schemaVersion,
        safetyDatabasePath: databaseMovedToSafety ? safetyDatabasePath : null,
        safetyFilesPath: filesMovedToSafety ? safetyFilesPath : null,
        checksumFilesVerified: validation.checksumFilesVerified
      };
    } catch (error) {
      if (filesInstalled && targetFilesRoot) await removeWithRetry(targetFilesRoot, { recursive: true, force: true }).catch(() => undefined);
      if (filesMovedToSafety && targetFilesRoot && safetyFilesPath) await renameWithRetry(safetyFilesPath, targetFilesRoot).catch(() => undefined);
      if (databaseInstalled) await removeWithRetry(targetDatabasePath, { force: true }).catch(() => undefined);
      if (databaseMovedToSafety) await renameWithRetry(safetyDatabasePath, targetDatabasePath).catch(() => undefined);
      if (pendingFilesPath) await removeWithRetry(pendingFilesPath, { recursive: true, force: true }).catch(() => undefined);
      await removeWithRetry(pendingDatabasePath, { force: true }).catch(() => undefined);
      if (!input.skipHistory) await MaintenanceHistoryService.record({
        type: input.historyType || 'restore',
        status: 'failed',
        startedAt,
        durationMs: Date.now() - startedAtMs,
        sourceLabel: input.bundlePath,
        destinationLabel: input.historyType === 'restore_test' ? 'área temporária isolada' : targetDatabasePath,
        files: validation.manifest.totals.files,
        bytes: validation.manifest.totals.bytes,
        user: 'admin',
        auditId: null,
        error
      }).catch(() => undefined);
      throw error;
    } finally {
      restoreDataKey?.fill(0);
    }
  }

  static async testRestore(bundlePath: string, allowedBackupDirectory = this.getBackupDirectory(), unlock: BackupUnlockOptions = {}) {
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();
    const validation = await this.validateBackup(bundlePath, allowedBackupDirectory, unlock);
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'geogestor-restore-test-'));
    const targetDatabasePath = path.join(temporaryRoot, 'database', 'geogestor.db');
    const targetFilesRoot = validation.manifest.type === 'complete'
      ? path.join(temporaryRoot, 'documents')
      : undefined;
    try {
      const restore = await this.restoreBackup({
        bundlePath,
        targetDatabasePath,
        targetFilesRoot,
        confirmation: RESTORE_CONFIRMATION,
        allowedBackupDirectory,
        historyType: 'restore_test',
        skipHistory: true,
        ...unlock
      });
      validateProtectedDatabaseIsolatedSync(targetDatabasePath);
      const credentialsFound = await countSensitiveCredentials(targetDatabasePath);
      if (validation.manifest.credentialsExcluded && credentialsFound !== 0) {
        throw new Error('O teste isolado encontrou credenciais sensíveis no banco restaurado.');
      }
      const result = {
        tested: true,
        testedAt: new Date().toISOString(),
        schemaVersion: validation.manifest.schemaVersion,
        type: validation.manifest.type,
        totals: validation.manifest.totals,
        checksumFilesVerified: restore.checksumFilesVerified,
        checksumCoverage: validation.integrity,
        credentialsExcluded: Boolean(validation.manifest.credentialsExcluded),
        temporaryDataRemoved: true
      };
      await MaintenanceHistoryService.record({
        type: 'restore_test',
        status: 'success',
        startedAt,
        durationMs: Date.now() - startedAtMs,
        sourceLabel: path.basename(bundlePath),
        destinationLabel: 'área temporária isolada',
        files: validation.manifest.totals.files,
        bytes: validation.manifest.totals.bytes,
        user: 'sistema',
        auditId: null,
        details: { schemaVersion: validation.manifest.schemaVersion, checksumsVerified: restore.checksumFilesVerified }
      });
      return result;
    } catch (error) {
      await MaintenanceHistoryService.record({
        type: 'restore_test',
        status: 'failed',
        startedAt,
        durationMs: Date.now() - startedAtMs,
        sourceLabel: path.basename(bundlePath),
        destinationLabel: 'área temporária isolada',
        files: validation.manifest.totals.files,
        bytes: validation.manifest.totals.bytes,
        user: 'sistema',
        auditId: null,
        error
      }).catch(() => undefined);
      throw error;
    } finally {
      await removeWithRetry(temporaryRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  static async testLatestCompleteBackup(destinationDirectory?: string | null) {
    const backupDirectory = this.getBackupDirectory(destinationDirectory);
    const storage = await this.getStorageStatus(destinationDirectory);
    const latest = storage.latestByType.complete;
    if (!latest) return null;
    return this.testRestore(path.join(backupDirectory, latest.directory), backupDirectory);
  }

  static async rotateRecoveryEnvelopes(backupDirectory: string, currentRecoverySecret: string, nextRecoverySecret: string) {
    if (BackupRecoveryService.keyId(currentRecoverySecret) === BackupRecoveryService.keyId(nextRecoverySecret)) {
      throw new Error('A nova chave de recuperação deve ser diferente da chave atual.');
    }
    const root = path.resolve(backupDirectory);
    const entries = await fs.readdir(root, { withFileTypes: true });
    let updated = 0;
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^geogestor-backup-(database|complete)-/.test(entry.name) || entry.name.includes('.pending-')) continue;
      const manifestPath = path.join(root, entry.name, 'manifest.json');
      const manifest = await fs.readFile(manifestPath, 'utf8').then((raw) => JSON.parse(raw) as BackupManifest).catch(() => null);
      if (!manifest || manifest.formatVersion < 4 || !manifest.encryption?.keyEnvelopes) continue;
      const recoveryEnvelope = manifest.encryption.keyEnvelopes.find((item) => item.purpose === 'recovery');
      if (!recoveryEnvelope) continue;
      const dataKey = BackupRecoveryService.unwrapDataKey(recoveryEnvelope, currentRecoverySecret);
      try {
        manifest.encryption.keyEnvelopes = [
          ...manifest.encryption.keyEnvelopes.filter((item) => item.purpose !== 'recovery'),
          BackupRecoveryService.wrapDataKey(dataKey, nextRecoverySecret, 'recovery')
        ];
        await writeJsonAtomic(manifestPath, manifest);
        updated += 1;
      } finally {
        dataKey.fill(0);
      }
    }
    return { updated, recoveryKeyId: BackupRecoveryService.keyId(nextRecoverySecret) };
  }

  static async enforceRetention(
    retention = Number(process.env.GEOGESTOR_BACKUP_RETENTION || DEFAULT_RETENTION),
    backupDirectory = this.getBackupDirectory(),
    maxStorageBytes = 0,
    retentionRecentHours = 24,
    retentionDailyDays = 30,
    retentionMonthlyMonths = 12
  ) {
    const entries = await fs.readdir(backupDirectory, { withFileTypes: true });
    const bundleNames = entries
      .filter((entry) => entry.isDirectory() && /^geogestor-backup-(database|complete)-/.test(entry.name) && !entry.name.includes('.pending-'))
      .map((entry) => entry.name)
      .sort()
      .reverse();
    const bundles = (await Promise.all(bundleNames.map(async (name) => {
      const target = path.join(backupDirectory, name);
      const manifest = await fs.readFile(path.join(target, 'manifest.json'), 'utf8')
        .then((raw) => JSON.parse(raw) as BackupManifest)
        .catch(() => null);
      const completedAt = manifest?.completedAt || manifest?.createdAt || '';
      return { name, target, manifest, completedAt, completedAtMs: Date.parse(completedAt), bytes: Number(manifest?.totals?.bytes || 0) };
    }))).sort((left, right) => right.completedAt.localeCompare(left.completedAt));
    if (bundles.length <= 1) return;

    const now = Date.now();
    const keep = new Set<string>();
    const newestByType = new Set<string>();
    for (const type of ['database', 'complete'] as const) {
      const newest = bundles.find((bundle) => bundle.manifest?.type === type);
      if (newest) newestByType.add(newest.name);
    }
    const dailyBuckets = new Set<string>();
    const monthlyBuckets = new Set<string>();
    for (const [index, bundle] of bundles.entries()) {
      if (index === 0 || newestByType.has(bundle.name) || index < Math.max(1, retention)) {
        keep.add(bundle.name);
        continue;
      }
      const ageMs = Number.isFinite(bundle.completedAtMs) ? Math.max(0, now - bundle.completedAtMs) : Number.POSITIVE_INFINITY;
      if (ageMs <= Math.max(1, retentionRecentHours) * 60 * 60 * 1000) {
        keep.add(bundle.name);
        continue;
      }
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      const dayBucket = `${bundle.manifest?.type || 'unknown'}:${bundle.completedAt.slice(0, 10)}`;
      if (ageDays <= Math.max(1, retentionDailyDays) && dayBucket && !dailyBuckets.has(dayBucket)) {
        dailyBuckets.add(dayBucket);
        keep.add(bundle.name);
        continue;
      }
      const ageMonths = ageDays / 30.4375;
      const monthBucket = `${bundle.manifest?.type || 'unknown'}:${bundle.completedAt.slice(0, 7)}`;
      if (ageMonths <= Math.max(1, retentionMonthlyMonths) && monthBucket && !monthlyBuckets.has(monthBucket)) {
        monthlyBuckets.add(monthBucket);
        keep.add(bundle.name);
      }
    }

    let keptBytes = bundles.filter((bundle) => keep.has(bundle.name)).reduce((sum, bundle) => sum + bundle.bytes, 0);
    if (maxStorageBytes > 0 && keptBytes > maxStorageBytes) {
      for (const bundle of [...bundles].reverse()) {
        if (bundle.name === bundles[0].name || newestByType.has(bundle.name) || !keep.has(bundle.name)) continue;
        keep.delete(bundle.name);
        keptBytes -= bundle.bytes;
        if (keptBytes <= maxStorageBytes) break;
      }
    }

    for (const bundle of bundles) {
      if (keep.has(bundle.name)) continue;
      assertInside(bundle.target, backupDirectory);
      await fs.rm(bundle.target, { recursive: true, force: true });
    }
  }
}
