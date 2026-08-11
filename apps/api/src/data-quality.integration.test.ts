import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `data-quality-${process.pid}`);
const databasePath = path.join(testRoot, 'data-quality.integration.test.db');
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

async function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) await fs.rm(`${databasePath}${suffix}`, { force: true }).catch(() => undefined);
}

test('painel de qualidade é somente leitura, filtrável e exportável; política de backup persiste', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await cleanup();
  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'), import('./db'), import('./services/runtime-migrations.service'), import('@geogestor/database')
  ]);
  const headers = { 'x-api-token': 'test-token' };
  try {
    await dbReady;
    await runRuntimeMigrations();
    const clientId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    await db.insert(schema.clientes).values({ id: clientId, nome: 'Cliente diagnóstico' });
    await db.insert(schema.projetos).values({ id: projectId, clienteId: clientId, nome: 'Projeto sem propriedade' });
    await db.insert(schema.orcamentos).values({
      id: crypto.randomUUID(), grupoId: crypto.randomUUID(), clienteId: clientId,
      valorTotal: 10_000, status: 'aprovado', descricao: 'Aprovado legado sem projeto'
    });

    const beforeCounts = {
      projects: (await db.select().from(schema.projetos)).length,
      budgets: (await db.select().from(schema.orcamentos)).length
    };
    const report = await server.inject({ method: 'GET', url: '/api/sistema/qualidade-dados', headers });
    assert.equal(report.statusCode, 200, report.body);
    const payload = report.json<{ summary: { critical: number; warnings: number }; issues: Array<{ code: string; module: string; severity: string; title: string }> }>();
    assert.ok(payload.summary.critical >= 1);
    assert.ok(payload.summary.warnings >= 1);
    assert.ok(payload.issues.some((issue) => issue.code === 'approvedBudgetsWithoutProject'));
    assert.ok(payload.issues.some((issue) => issue.code === 'projectsWithoutProperty'));
    assert.deepEqual({
      projects: (await db.select().from(schema.projetos)).length,
      budgets: (await db.select().from(schema.orcamentos)).length
    }, beforeCounts);

    const filtered = await server.inject({ method: 'GET', url: '/api/sistema/qualidade-dados?module=Projetos&severity=warning', headers });
    assert.equal(filtered.statusCode, 200, filtered.body);
    assert.ok(filtered.json<{ issues: Array<{ module: string; severity: string }> }>().issues.every((issue) => issue.module === 'Projetos' && issue.severity === 'warning'));
    const csv = await server.inject({ method: 'GET', url: '/api/sistema/qualidade-dados.csv', headers });
    assert.equal(csv.statusCode, 200, csv.body);
    assert.match(csv.headers['content-type'] || '', /text\/csv/);
    assert.match(csv.body, /Problema/);
    const csvIssue = payload.issues[0];
    assert.ok(csvIssue);
    const filteredCsv = await server.inject({ method: 'GET', url: `/api/sistema/qualidade-dados.csv?module=${encodeURIComponent(csvIssue.module)}&severity=${encodeURIComponent(csvIssue.severity)}`, headers });
    assert.equal(filteredCsv.statusCode, 200, filteredCsv.body);
    assert.match(filteredCsv.body, new RegExp(csvIssue.module));
    assert.match(filteredCsv.body, new RegExp(csvIssue.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

    const policy = {
      databaseIntervalHours: 12, completeIntervalDays: 3, retention: 6,
      destinationDirectory: path.join(testRoot, 'custom-backups'), maxStorageBytes: 5 * 1024 ** 3,
      overdueGraceHours: 4, runOnStartup: true, runOnShutdown: false
    };
    const saved = await server.inject({ method: 'PUT', url: '/api/sistema/backups/politica', headers: { ...headers, 'content-type': 'application/json' }, payload: policy });
    assert.equal(saved.statusCode, 200, saved.body);
    const status = await server.inject({ method: 'GET', url: '/api/sistema/backups/status', headers });
    assert.equal(status.statusCode, 200, status.body);
    assert.equal(status.json<{ policy: { retention: number; databaseIntervalHours: number } }>().policy.retention, 6);
    assert.equal(status.json<{ policy: { retention: number; databaseIntervalHours: number } }>().policy.databaseIntervalHours, 12);
  } finally {
    await server.close();
    await cleanup();
  }
});
