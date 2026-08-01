import fs from 'node:fs/promises';
import path from 'node:path';

const valueAfter = (flag: string) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const copyPath = valueAfter('--copy');
const reportPath = valueAfter('--report');
const simulatedVersion = valueAfter('--simulate-version');
if (!copyPath || !reportPath) throw new Error('Informe --copy e --report.');

process.env.GEOGESTOR_DB_PATH = path.resolve(copyPath);
process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DATABASE_WORKER = path.resolve(process.cwd(), 'apps/api/src/database-security-worker.ts');
process.env.GEOGESTOR_DATABASE_WORKER_RUNNER = path.resolve(process.cwd(), 'apps/api/node_modules/tsx/dist/cli.mjs');

const inspect = async () => {
  const { createClient } = await import('@libsql/client');
  const { databaseClientConfig } = await import('@geogestor/database');
  const client = createClient(databaseClientConfig(process.env.GEOGESTOR_DB_PATH!));
  const tables = ['clientes', 'projetos', 'propriedades', 'orcamentos', 'parcelas', 'recebimentos', 'despesas', 'documentos', 'licencas', 'tarefas', 'compromissos', 'oportunidades'];
  try {
    const quick = await client.execute('PRAGMA quick_check;');
    const foreignKeys = await client.execute('PRAGMA foreign_key_check;');
    const version = await client.execute('PRAGMA user_version;');
    const counts: Record<string, number | null> = {};
    for (const table of tables) {
      try {
        const result = await client.execute(`SELECT COUNT(*) AS total FROM ${table}`);
        counts[table] = Number(result.rows[0]?.total || 0);
      } catch (error) {
        if (!/no such table/i.test(error instanceof Error ? error.message : String(error))) throw error;
        counts[table] = null;
      }
    }
    const residual = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '__new_%' OR name LIKE '%_runtime_migration')");
    const migrations = await client.execute("SELECT version, name, status, started_at, completed_at FROM schema_migrations ORDER BY version")
      .then((result) => result.rows)
      .catch(() => []);
    return {
      quickCheck: String(Object.values(quick.rows[0] || {})[0] || ''),
      foreignKeyViolations: foreignKeys.rows.length,
      userVersion: Number(Object.values(version.rows[0] || {})[0] || 0),
      counts,
      residualTables: residual.rows.map((row) => String(row.name)),
      migrations
    };
  } finally {
    await client.close();
  }
};

async function main() {
  if (simulatedVersion) {
    const { createClient } = await import('@libsql/client');
    const { databaseClientConfig } = await import('@geogestor/database');
    const simulationClient = createClient(databaseClientConfig(process.env.GEOGESTOR_DB_PATH!));
    try {
      await simulationClient.execute(`PRAGMA user_version = ${Number(simulatedVersion)}`);
      await simulationClient.execute({
        sql: 'UPDATE schema_migrations SET status = ? WHERE version > ?',
        args: ['failed', Number(simulatedVersion)]
      }).catch(() => undefined);
    } finally {
      await simulationClient.close();
    }
  }
  const startedAt = new Date().toISOString();
  const before = await inspect();
  const { dbReady, closeDb } = await import('./db');
  const { runRuntimeMigrations } = await import('./services/runtime-migrations.service');
  await dbReady;
  await runRuntimeMigrations();
  const firstRun = await inspect();
  await runRuntimeMigrations();
  const secondRun = await inspect();
  await closeDb();
  const countDifferences = Object.fromEntries(Object.keys(before.counts).map((table) => [table, {
    before: before.counts[table], after: secondRun.counts[table],
    preserved: before.counts[table] === null || before.counts[table] === secondRun.counts[table]
  }]));
  const report = {
    startedAt, completedAt: new Date().toISOString(), simulatedVersion: simulatedVersion ? Number(simulatedVersion) : null,
    before, firstRun, secondRun, countDifferences,
    idempotent: JSON.stringify(firstRun.counts) === JSON.stringify(secondRun.counts) && firstRun.userVersion === secondRun.userVersion,
    successful: secondRun.quickCheck === 'ok'
      && secondRun.foreignKeyViolations === 0
      && secondRun.residualTables.length === 0
      && Object.values(countDifferences).every((item) => item.preserved)
  };
  await fs.writeFile(reportPath!, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (!report.successful) process.exitCode = 2;
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
