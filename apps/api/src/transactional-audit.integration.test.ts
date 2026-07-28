import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { count } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `transactional-audit-${process.pid}`);
const dbPath = path.join(testRoot, 'geogestor.db');

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('falha obrigatória de auditoria reverte integralmente a mutação financeira', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(testRoot, { recursive: true });
  const [{ runRuntimeMigrations }, { db }, { schema }, { server }, { AuditLogService }] = await Promise.all([
    import('./services/runtime-migrations.service'),
    import('./db'),
    import('@geogestor/database'),
    import('./server'),
    import('./services/audit.service')
  ]);
  await runRuntimeMigrations();
  await db.insert(schema.clientes).values({ id: 'client-audit', nome: 'Cliente Sintético' });
  AuditLogService.setFailureInjectorForTests((action, entity) => {
    if (action === 'INSERT' && entity === 'Despesa') throw new Error('Falha sintética de auditoria');
  });
  try {
    const response = await server.inject({
      method: 'POST',
      url: '/api/financeiro/despesas',
      headers: { 'content-type': 'application/json', 'x-api-token': 'test-token' },
      payload: {
        clienteId: 'client-audit',
        descricao: 'Despesa que deve sofrer rollback',
        valor: 10_000,
        data: '2026-07-21',
        categoria: 'Teste'
      }
    });
    assert.equal(response.statusCode, 500);
    assert.equal(Number((await db.select({ total: count() }).from(schema.despesas))[0].total), 0);
    assert.equal(Number((await db.select({ total: count() }).from(schema.auditLogs))[0].total), 0);
  } finally {
    AuditLogService.setFailureInjectorForTests(null);
    await server.close();
  }
});
