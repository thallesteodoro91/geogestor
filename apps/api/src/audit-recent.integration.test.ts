import { injectWithRecordVersion } from './test-support/record-request';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.join(os.tmpdir(), `geogestor-audit-recent-${process.pid}`);
process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = path.join(testRoot, 'geogestor.db');
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('histórico recente informa disponibilidade sem remover eventos antigos', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  const [{ runRuntimeMigrations }, { db, closeDb }, { schema }, { server }] = await Promise.all([
    import('./services/runtime-migrations.service'),
    import('./db'),
    import('@geogestor/database'),
    import('./server')
  ]);
  try {
    await runRuntimeMigrations();
    await db.insert(schema.clientes).values([
      { id: 'cliente-ativo', nome: 'Cliente ativo' },
      { id: 'cliente-removido', nome: 'Cliente removido', deletedAt: '2026-09-26' }
    ]);
    await db.insert(schema.auditLogs).values([
      { id: 'evento-ativo', action: 'UPDATE', entity: 'Cliente', newData: JSON.stringify({ id: 'cliente-ativo', nome: 'Cliente ativo' }) },
      { id: 'evento-removido', action: 'UPDATE', entity: 'Cliente', newData: JSON.stringify({ id: 'cliente-removido', nome: 'Cliente removido' }) }
    ]);

    const response = await injectWithRecordVersion(server, { method: 'GET', url: '/api/audit-logs/recent?limit=20', headers: { 'x-api-token': 'test-token' } });
    assert.equal(response.statusCode, 200);
    const events = response.json() as Array<{ id: string; recordAvailable: boolean; newData: string }>;
    assert.equal(events.find((event) => event.id === 'evento-ativo')?.recordAvailable, true);
    assert.equal(events.find((event) => event.id === 'evento-removido')?.recordAvailable, false);
    assert.match(events.find((event) => event.id === 'evento-removido')?.newData || '', /Cliente removido/);
  } finally {
    await server.close();
    await closeDb();
  }
});
