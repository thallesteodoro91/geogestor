import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createClient, type Client } from '@libsql/client';
import { MaintenanceCoordinator } from './maintenance-coordinator.service';
import { OperationalLogService } from './operational-log.service';

const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_WAL_CHECKPOINT_BYTES = 16 * 1024 * 1024;

function configuredNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function databasePath() {
  return process.env.GEOGESTOR_DB_PATH || path.resolve(__dirname, '../../../../data/geogestor.db');
}

async function fileSize(target: string) {
  try {
    return (await fs.stat(target)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw error;
  }
}

async function exactDuplicateIndexes(client: Client) {
  const indexes = await client.execute(`
    SELECT name, tbl_name AS table_name
    FROM sqlite_schema
    WHERE type = 'index' AND sql IS NOT NULL
    ORDER BY tbl_name, name
  `);
  const signatures = new Map<string, string>();
  const duplicates: Array<{ index: string; duplicates: string }> = [];
  for (const row of indexes.rows) {
    const indexName = String(row.name);
    const tableName = String(row.table_name);
    const escapedIndex = indexName.replace(/"/g, '""');
    const columns = await client.execute(`PRAGMA index_info("${escapedIndex}")`);
    const signature = `${tableName}:${columns.rows.map((column) => String(column.name)).join(',')}`;
    const previous = signatures.get(signature);
    if (previous) duplicates.push({ index: indexName, duplicates: previous });
    else signatures.set(signature, indexName);
  }
  return duplicates;
}

export class SqliteMaintenanceService {
  private static lastRunAt = 0;
  private static firstRun = true;

  static async runIfDue(force = false) {
    const interval = configuredNumber('GEOGESTOR_SQLITE_MAINTENANCE_INTERVAL_MS', DEFAULT_INTERVAL_MS);
    if (!force && Date.now() - this.lastRunAt < interval) return null;

    return MaintenanceCoordinator.runExclusive('sqlite-maintenance', async () => {
      if (!force && Date.now() - this.lastRunAt < interval) return null;
      const startedAt = performance.now();
      const dbPath = path.resolve(databasePath());
      const client = createClient({ url: `file:${dbPath}` });
      try {
        await client.execute('PRAGMA foreign_keys = ON;');
        await client.execute('PRAGMA busy_timeout = 5000;');
        const optimizeMode = this.firstRun ? '0x10002' : '';
        const optimizeResult = await client.execute(`PRAGMA optimize${optimizeMode ? `=${optimizeMode}` : ''};`);
        this.firstRun = false;

        const walBytesBefore = await fileSize(`${dbPath}-wal`);
        const checkpointThreshold = configuredNumber('GEOGESTOR_WAL_CHECKPOINT_BYTES', DEFAULT_WAL_CHECKPOINT_BYTES);
        let checkpoint: Record<string, unknown> | null = null;
        if (walBytesBefore >= checkpointThreshold) {
          const checkpointResult = await client.execute('PRAGMA wal_checkpoint(PASSIVE);');
          checkpoint = checkpointResult.rows[0]
            ? Object.fromEntries(Object.entries(checkpointResult.rows[0]))
            : {};
        }

        const duplicates = await exactDuplicateIndexes(client);
        const completedAt = new Date().toISOString();
        this.lastRunAt = Date.now();
        const result = {
          completedAt,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          optimizeActions: optimizeResult.rows.length,
          databaseBytes: await fileSize(dbPath),
          walBytesBefore,
          walBytesAfter: await fileSize(`${dbPath}-wal`),
          checkpoint,
          exactDuplicateIndexes: duplicates,
          coordinator: MaintenanceCoordinator.snapshot()
        };
        await OperationalLogService.setState('sqliteMaintenance', duplicates.length ? 'degraded' : 'ok', result);
        await OperationalLogService.info('sqlite-maintenance-completed', result);
        return result;
      } catch (error) {
        await OperationalLogService.setState('sqliteMaintenance', 'failed', { error });
        await OperationalLogService.error('sqlite-maintenance-failed', { error });
        throw error;
      } finally {
        await client.close();
      }
    });
  }

  static resetForTests() {
    if (process.env.NODE_ENV !== 'test' && !process.env.GEOGESTOR_DB_PATH?.includes('scratch')) {
      throw new Error('A manutenção só pode ser reiniciada em ambiente de teste.');
    }
    this.lastRunAt = 0;
    this.firstRun = true;
  }
}
