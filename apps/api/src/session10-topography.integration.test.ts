import { injectWithRecordVersion } from './test-support/record-request';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `session10-topography-${process.pid}`);
const databasePath = path.join(testRoot, 'geogestor.db');
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';
process.env.NODE_ENV = 'test';

const headers = { 'content-type': 'application/json', 'x-api-token': 'test-token' };

test('Sessão 10 persiste cálculo topográfico com contrato, vínculo, auditoria e legado resilientes', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  const [{ server }, { db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }, { AuditLogService }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database'),
    import('./services/audit.service'),
  ]);
  const request = (method: 'GET' | 'POST', url: string, payload?: Record<string, unknown>) => injectWithRecordVersion(server, {
    method,
    url,
    headers: payload === undefined ? { 'x-api-token': 'test-token' } : headers,
    payload,
  });
  const clientA = crypto.randomUUID();
  const clientB = crypto.randomUUID();
  const projectA = crypto.randomUUID();
  const base = {
    tipo: 'topografico',
    nome: 'QA-AUDIT-S10-20260913-Cálculo projetado',
    dataCalculo: '2026-09-13',
    entradas: { distanceMode: 'projetada', spatialReference: { code: 'EPSG:31982' } },
    resultado: { distanceMeters: 10 },
    unidade: 'm',
    metodo: 'Plano/quadrícula · EPSG:31982',
  };

  try {
    await dbReady;
    await runRuntimeMigrations();
    await db.insert(schema.clientes).values([
      { id: clientA, nome: 'QA-AUDIT-S10-20260913-Cliente A' },
      { id: clientB, nome: 'QA-AUDIT-S10-20260913-Cliente B' },
    ]);
    await db.insert(schema.projetos).values({ id: projectA, clienteId: clientA, nome: 'QA-AUDIT-S10-20260913-Projeto A' });

    for (const payload of [
      { ...base, entradas: null },
      { ...base, entradas: [] },
      { ...base, resultado: 10 },
      { ...base, extra: true },
      { ...base, dataCalculo: '2026-02-29' },
    ]) {
      const response = await request('POST', '/api/dados-operacionais/calculos', payload);
      assert.equal(response.statusCode, 400, response.body);
    }

    const conflicting = await request('POST', '/api/dados-operacionais/calculos', { ...base, clienteId: clientB, projetoId: projectA });
    assert.equal(conflicting.statusCode, 400, conflicting.body);

    const created = await request('POST', '/api/dados-operacionais/calculos', { ...base, projetoId: projectA });
    assert.equal(created.statusCode, 201, created.body);
    assert.equal(created.json<{ clienteId: string }>().clienteId, clientA);

    const unknownType = await request('GET', '/api/dados-operacionais/calculos?tipo=desconhecido');
    assert.equal(unknownType.statusCode, 400, unknownType.body);
    const extraQuery = await request('GET', '/api/dados-operacionais/calculos?tipo=topografico&extra=1');
    assert.equal(extraQuery.statusCode, 400, extraQuery.body);

    const timestamp = '2026-09-13T12:00:00.000Z';
    await db.insert(schema.calculosSalvos).values([
      { id: '00000000-0000-4000-8000-000000000002', tipo: 'topografico', nome: 'QA-AUDIT-S10-20260913-Legado primitivo', dataCalculo: '2026-09-12', entradasJson: '[]', resultadoJson: '42', createdAt: timestamp, updatedAt: timestamp },
      { id: '00000000-0000-4000-8000-000000000003', tipo: 'topografico', nome: 'QA-AUDIT-S10-20260913-Legado inválido', dataCalculo: '2026-09-12', entradasJson: '{inválido', resultadoJson: '{}', createdAt: timestamp, updatedAt: timestamp },
      { id: '00000000-0000-4000-8000-000000000004', tipo: 'topografico', nome: 'QA-AUDIT-S10-20260913-Removido', dataCalculo: '2026-09-14', entradasJson: '{}', resultadoJson: '{}', createdAt: timestamp, updatedAt: timestamp, deletedAt: timestamp },
    ]);
    const listed = await request('GET', '/api/dados-operacionais/calculos?tipo=topografico');
    assert.equal(listed.statusCode, 200, listed.body);
    const items = listed.json<Array<{ nome: string; dadosInvalidos: boolean }>>();
    assert.equal(items.some((item) => item.nome.endsWith('Removido')), false);
    assert.equal(items.find((item) => item.nome.endsWith('Legado primitivo'))?.dadosInvalidos, true);
    assert.equal(items.find((item) => item.nome.endsWith('Legado inválido'))?.dadosInvalidos, true);
    const auditRows = await db.select().from(schema.auditLogs);
    assert.equal(auditRows.some((row) => row.entity === 'CalculoSalvo' && row.action === 'INSERT'), true);

    AuditLogService.setFailureInjectorForTests((_action, entity) => {
      if (entity === 'CalculoSalvo') throw new Error('QA-AUDIT-S10-20260913-falha-auditoria');
    });
    const failed = await request('POST', '/api/dados-operacionais/calculos', { ...base, nome: 'QA-AUDIT-S10-20260913-Deve reverter' });
    assert.equal(failed.statusCode, 500, failed.body);
    const calculationsAfterFailure = await db.select().from(schema.calculosSalvos);
    assert.equal(calculationsAfterFailure.some((item) => item.nome.endsWith('Deve reverter')), false);
  } finally {
    AuditLogService.setFailureInjectorForTests(null);
    await server.close();
    await closeDb();
    await fs.rm(testRoot, { recursive: true, force: true }).catch(() => undefined);
  }
});
