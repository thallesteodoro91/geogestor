import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'libsql';

const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'ascii');
const KEY_ENV = 'GEOGESTOR_DB_ENCRYPTION_KEY';

type NativeDatabaseOptions = Database.Options & { encryptionKey?: string; encryptionCipher?: string };
type SchemaObject = { type: string; name: string; tbl_name: string; sql: string };
type ColumnInfo = { name: string; hidden?: number | bigint };

export type DatabaseProtectionResult = {
  status: 'disabled' | 'created-encrypted' | 'already-encrypted' | 'migrated';
  keyId: string | null;
  recoveryPath: string | null;
};

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function nativeDatabase(databasePath: string, encryptionKey?: string) {
  const options: NativeDatabaseOptions = encryptionKey
    ? { encryptionKey, encryptionCipher: 'aes256cbc' }
    : {};
  return new Database(databasePath, options);
}

function firstValue(row: Record<string, unknown> | undefined) {
  return row ? Object.values(row)[0] : undefined;
}

function validateBase64Key(encoded: string) {
  const decoded = Buffer.from(encoded, 'base64');
  if (decoded.length !== 32 || decoded.toString('base64') !== encoded) {
    decoded.fill(0);
    throw new Error('A chave de criptografia do banco é inválida.');
  }
  decoded.fill(0);
  return encoded;
}

export function getDatabaseEncryptionKey(required: true): string;
export function getDatabaseEncryptionKey(required?: boolean): string | undefined;
export function getDatabaseEncryptionKey(required = process.env.NODE_ENV === 'production') {
  const encoded = process.env[KEY_ENV]?.trim();
  if (!encoded) {
    if (required) throw new Error('A chave protegida do banco não foi fornecida pelo aplicativo desktop.');
    return undefined;
  }
  return validateBase64Key(encoded);
}

export function databaseKeyId(encryptionKey = getDatabaseEncryptionKey()) {
  if (!encryptionKey) return null;
  return crypto.createHash('sha256').update(encryptionKey, 'utf8').digest('hex').slice(0, 16);
}

export function databaseClientConfig(databasePath: string, encryptionKey = getDatabaseEncryptionKey()) {
  return {
    url: `file:${databasePath}`,
    ...(encryptionKey ? { encryptionKey } : {})
  };
}

function hasSqliteHeader(databasePath: string) {
  if (!fs.existsSync(databasePath) || fs.statSync(databasePath).size < SQLITE_HEADER.length) return false;
  const descriptor = fs.openSync(databasePath, 'r');
  try {
    const header = Buffer.alloc(SQLITE_HEADER.length);
    fs.readSync(descriptor, header, 0, header.length, 0);
    return header.equals(SQLITE_HEADER);
  } finally {
    fs.closeSync(descriptor);
  }
}

function assertDatabase(database: Database.Database) {
  const quickCheck = database.prepare('PRAGMA quick_check').get() as Record<string, unknown> | undefined;
  if (String(firstValue(quickCheck)) !== 'ok') throw new Error('O banco falhou na verificação de integridade.');
  const foreignKeys = database.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeys.length > 0) throw new Error(`O banco contém ${foreignKeys.length} vínculo(s) inválido(s).`);
}

function schemaObjects(database: Database.Database) {
  return database.prepare(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_schema
    WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
    ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name
  `).all() as SchemaObject[];
}

function copyDatabase(sourcePath: string, sourceKey: string | undefined, targetPath: string, targetKey: string | undefined) {
  if (fs.existsSync(targetPath)) fs.rmSync(targetPath, { force: true });
  const source = nativeDatabase(sourcePath, sourceKey);
  const target = nativeDatabase(targetPath, targetKey);
  let sourceTransaction = false;
  try {
    assertDatabase(source);
    source.exec('BEGIN');
    sourceTransaction = true;
    const objects = schemaObjects(source);
    const tables = objects.filter((entry) => entry.type === 'table');
    const deferredObjects = objects.filter((entry) => entry.type !== 'table');
    const userVersion = Number(firstValue(source.prepare('PRAGMA user_version').get() as Record<string, unknown> | undefined) || 0);
    const applicationId = Number(firstValue(source.prepare('PRAGMA application_id').get() as Record<string, unknown> | undefined) || 0);

    target.pragma('foreign_keys = OFF');
    const performCopy = target.transaction(() => {
      for (const entry of tables) target.exec(entry.sql);
      for (const table of tables) {
        const columns = (source.prepare(`PRAGMA table_xinfo(${quoteIdentifier(table.name)})`).all() as ColumnInfo[])
          .filter((column) => Number(column.hidden || 0) === 0)
          .map((column) => column.name);
        if (!columns.length) continue;
        const columnList = columns.map(quoteIdentifier).join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        const reader = source.prepare(`SELECT ${columnList} FROM ${quoteIdentifier(table.name)}`);
        const writer = target.prepare(`INSERT INTO ${quoteIdentifier(table.name)} (${columnList}) VALUES (${placeholders})`);
        for (const row of reader.iterate() as Iterable<Record<string, unknown>>) {
          writer.run(...columns.map((column) => row[column]));
        }
      }
      for (const entry of deferredObjects) target.exec(entry.sql);
      target.pragma(`user_version = ${userVersion}`);
      target.pragma(`application_id = ${applicationId}`);
    });
    performCopy();
    target.pragma('foreign_keys = ON');
    assertDatabase(target);

    for (const table of tables) {
      const sourceCount = Number(firstValue(source.prepare(`SELECT COUNT(*) AS total FROM ${quoteIdentifier(table.name)}`).get() as Record<string, unknown> | undefined));
      const targetCount = Number(firstValue(target.prepare(`SELECT COUNT(*) AS total FROM ${quoteIdentifier(table.name)}`).get() as Record<string, unknown> | undefined));
      if (sourceCount !== targetCount) throw new Error(`A cópia segura divergiu na tabela ${table.name}.`);
    }
    source.exec('COMMIT');
    sourceTransaction = false;
  } finally {
    if (sourceTransaction) {
      try { source.exec('ROLLBACK'); } catch {}
    }
    target.close();
    source.close();
  }
}

function reopenAndValidate(databasePath: string, encryptionKey: string | undefined) {
  const database = nativeDatabase(databasePath, encryptionKey);
  try {
    assertDatabase(database);
  } finally {
    database.close();
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function waitSync(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function renameSyncWithRetry(source: string, target: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      fs.renameSync(source, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(code || '') || attempt === 19) throw error;
      waitSync(25 * (attempt + 1));
    }
  }
}

function removeFileSyncWithRetry(target: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      fs.rmSync(target, { force: true });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(code || '') || attempt === 19) throw error;
      waitSync(25 * (attempt + 1));
    }
  }
}

export function ensureDatabaseProtectionSync(databasePath: string, encryptionKey = getDatabaseEncryptionKey()): DatabaseProtectionResult {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  if (!encryptionKey) return { status: 'disabled', keyId: null, recoveryPath: null };
  validateBase64Key(encryptionKey);
  const keyId = databaseKeyId(encryptionKey);
  if (!fs.existsSync(databasePath) || fs.statSync(databasePath).size === 0) {
    const database = nativeDatabase(databasePath, encryptionKey);
    database.close();
    return { status: 'created-encrypted', keyId, recoveryPath: null };
  }

  if (!hasSqliteHeader(databasePath)) {
    try {
      reopenAndValidate(databasePath, encryptionKey);
      return { status: 'already-encrypted', keyId, recoveryPath: null };
    } catch (encryptedError) {
      throw new Error('O banco local está criptografado com outra chave ou está corrompido.', { cause: encryptedError });
    }
  }

  const operation = crypto.randomUUID();
  const pendingPath = `${databasePath}.encryption-${operation}.pending`;
  const plaintextSafetyPath = `${databasePath}.legacy-${operation}.pending`;
  const recoveryPath = `${databasePath}.migration-recovery-${timestamp()}`;
  let originalMoved = false;
  let encryptedInstalled = false;
  try {
    cloneDatabaseIsolatedSync(databasePath, undefined, pendingPath, encryptionKey);
    renameSyncWithRetry(databasePath, plaintextSafetyPath);
    originalMoved = true;
    renameSyncWithRetry(pendingPath, databasePath);
    encryptedInstalled = true;
    validateDatabaseIsolatedSync(databasePath, encryptionKey);
    fs.copyFileSync(databasePath, recoveryPath, fs.constants.COPYFILE_EXCL);
    reopenAndValidate(recoveryPath, encryptionKey);
    removeFileSyncWithRetry(plaintextSafetyPath);
    originalMoved = false;
    return { status: 'migrated', keyId, recoveryPath };
  } catch (error) {
    if (encryptedInstalled && fs.existsSync(databasePath)) {
      try { removeFileSyncWithRetry(databasePath); } catch {}
    }
    if (originalMoved && fs.existsSync(plaintextSafetyPath)) renameSyncWithRetry(plaintextSafetyPath, databasePath);
    if (fs.existsSync(pendingPath)) {
      try { removeFileSyncWithRetry(pendingPath); } catch {}
    }
    throw error;
  }
}

export function rotateDatabaseKeySync(databasePath: string, currentKey: string, nextKey: string) {
  validateBase64Key(currentKey);
  validateBase64Key(nextKey);
  if (crypto.timingSafeEqual(Buffer.from(currentKey), Buffer.from(nextKey))) {
    throw new Error('A nova chave deve ser diferente da chave atual.');
  }
  const operation = crypto.randomUUID();
  const pendingPath = `${databasePath}.rekey-${operation}.pending`;
  const recoveryPath = `${databasePath}.before-rekey-${timestamp()}`;
  let originalMoved = false;
  let replacementInstalled = false;
  try {
    cloneDatabaseIsolatedSync(databasePath, currentKey, pendingPath, nextKey);
    renameSyncWithRetry(databasePath, recoveryPath);
    originalMoved = true;
    renameSyncWithRetry(pendingPath, databasePath);
    replacementInstalled = true;
    validateDatabaseIsolatedSync(databasePath, nextKey);
    return { keyId: databaseKeyId(nextKey), recoveryPath };
  } catch (error) {
    if (replacementInstalled && fs.existsSync(databasePath)) {
      try { removeFileSyncWithRetry(databasePath); } catch {}
    }
    if (originalMoved && fs.existsSync(recoveryPath)) renameSyncWithRetry(recoveryPath, databasePath);
    if (fs.existsSync(pendingPath)) {
      try { removeFileSyncWithRetry(pendingPath); } catch {}
    }
    throw error;
  }
}

export function cloneDatabaseEncryptedSync(sourcePath: string, targetPath: string, encryptionKey = getDatabaseEncryptionKey()) {
  cloneDatabaseIsolatedSync(sourcePath, encryptionKey, targetPath, encryptionKey);
}

export function inspectProtectedDatabaseSync(databasePath: string, encryptionKey = getDatabaseEncryptionKey(true)) {
  reopenAndValidate(databasePath, encryptionKey);
  return { encrypted: !hasSqliteHeader(databasePath), keyId: databaseKeyId(encryptionKey) };
}

export function cloneDatabaseWithKeysSync(sourcePath: string, sourceKey: string | undefined, targetPath: string, targetKey: string | undefined) {
  copyDatabase(sourcePath, sourceKey, targetPath, targetKey);
  reopenAndValidate(targetPath, targetKey);
}

function cloneDatabaseIsolatedSync(sourcePath: string, sourceKey: string | undefined, targetPath: string, targetKey: string | undefined) {
  const workerPath = process.env.GEOGESTOR_DATABASE_WORKER;
  if (!workerPath) {
    if (process.platform === 'win32' && (sourceKey || targetKey)) {
      throw new Error('O processo auxiliar de proteção do banco não foi configurado.');
    }
    cloneDatabaseWithKeysSync(sourcePath, sourceKey, targetPath, targetKey);
    return;
  }
  const runner = process.env.GEOGESTOR_DATABASE_WORKER_RUNNER;
  const args = runner
    ? [runner, workerPath, 'clone', sourcePath, targetPath]
    : [workerPath, 'clone', sourcePath, targetPath];
  const env = { ...process.env };
  if (sourceKey) env.GEOGESTOR_DB_SOURCE_KEY = sourceKey;
  else delete env.GEOGESTOR_DB_SOURCE_KEY;
  if (targetKey) env.GEOGESTOR_DB_TARGET_KEY = targetKey;
  else delete env.GEOGESTOR_DB_TARGET_KEY;
  const result = spawnSync(process.execPath, args, {
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 10 * 60 * 1_000
  });
  delete env.GEOGESTOR_DB_SOURCE_KEY;
  delete env.GEOGESTOR_DB_TARGET_KEY;
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr?.trim() || `código ${result.status ?? 'desconhecido'}`;
    throw new Error(`A cópia protegida do banco falhou: ${detail}`);
  }
}

function validateDatabaseIsolatedSync(databasePath: string, encryptionKey: string) {
  const workerPath = process.env.GEOGESTOR_DATABASE_WORKER;
  if (!workerPath) {
    reopenAndValidate(databasePath, encryptionKey);
    return;
  }
  const runner = process.env.GEOGESTOR_DATABASE_WORKER_RUNNER;
  const args = runner
    ? [runner, workerPath, 'validate', databasePath]
    : [workerPath, 'validate', databasePath];
  const result = spawnSync(process.execPath, args, {
    env: { ...process.env, GEOGESTOR_DB_SOURCE_KEY: encryptionKey },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 2 * 60 * 1_000
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message || result.stderr?.trim() || `código ${result.status ?? 'desconhecido'}`;
    throw new Error(`A validação protegida do banco falhou: ${detail}`);
  }
}
