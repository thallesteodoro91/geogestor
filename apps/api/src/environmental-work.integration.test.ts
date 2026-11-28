import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq, sql } from 'drizzle-orm';
import type { EnvironmentalDemandDetail } from '@geogestor/contracts';

const root = path.resolve('scratch', `environmental-work-${process.pid}-${crypto.randomUUID()}`);
process.env.GEOGESTOR_DB_PATH = path.join(root, 'test.db');
process.env.GEOGESTOR_API_TOKEN = 'test-token';
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';

test('encerramento e reabertura ambientais são atômicos, preservam registros e protegem todas as entradas de andamento', async () => {
  await fs.mkdir(root, { recursive: true });
  const [{ server }, { db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'), import('./db'), import('./services/runtime-migrations.service'), import('@geogestor/database')
  ]);
  const client = crypto.randomUUID(), id = crypto.randomUUID(), legacy = crypto.randomUUID(), assessment = crypto.randomUUID();
  const request = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) => server.inject({ method, url, payload, headers: { 'x-api-token': 'test-token' } });
  const detail = async (target = id) => {
    const result = await request('GET', `/api/ambiental/${target}`); assert.equal(result.statusCode, 200, result.body); return result.json<EnvironmentalDemandDetail>();
  };
  const progress = { titulo: 'Vistoria registrada', descricao: 'Observação informada para teste.', categoria: 'Campo', data: '2022-09-01' };
  try {
    await dbReady; await runRuntimeMigrations();
    await db.insert(schema.clientes).values({ id: client, nome: 'Cliente sintético CAR' });
    await db.insert(schema.projetos).values([
      { id, clienteId: client, nome: 'CAR sintético', tipo: 'Ambiental', status: 'Em Andamento', dataInicio: '2022-08-08', dataEntrega: '2022-09-28', createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z' },
      { id: legacy, clienteId: client, nome: 'CAR legado', tipo: 'Ambiental', status: 'Concluído' },
      { id: assessment, clienteId: client, nome: 'Perícia legada', tipo: 'Perícia', status: 'Finalizado' }
    ]);
    await db.insert(schema.ambiental).values([
      { id: crypto.randomUUID(), projetoId: id, clienteId: client, tipoDemanda: 'CAR', statusFase: null, updatedAt: '2026-01-01T12:00:00Z' },
      { id: crypto.randomUUID(), projetoId: legacy, clienteId: client, statusFase: null }
    ]);
    await db.insert(schema.tarefas).values([
      { id: crypto.randomUUID(), projetoId: id, titulo: 'Próxima tarefa real', status: 'A Fazer', dataLimite: '2026-10-30' },
      { id: crypto.randomUUID(), projetoId: id, titulo: 'Concluída', status: 'Concluído', dataLimite: '2020-01-01' },
      { id: crypto.randomUUID(), projetoId: id, titulo: 'Cancelada', status: 'Cancelado' }
    ]);
    assert.equal((await detail(legacy)).encerramento, null);
    assert.equal((await detail(legacy)).statusFase, null);
    const original = await detail();
    assert.equal(original.proximaAcao, 'Próxima tarefa real'); assert.equal(original.pendingTaskCount, 1);
    assert.equal((await request('POST', `/api/ambiental/${id}/andamentos`, progress)).statusCode, 201);
    const afterProgress = await detail();
    assert.ok(Date.parse(afterProgress.updatedAt) > Date.parse(original.updatedAt));
    assert.equal(afterProgress.history[0].data, progress.data); assert.equal(afterProgress.dataInicio, original.dataInicio);
    assert.equal((await request('PATCH', `/api/ambiental/${id}/fase`, { statusFase: 'Documentação' })).statusCode, 200);
    assert.equal((await detail()).statusFase, 'Documentação');
    const historyBefore = (await detail()).history;
    const document = path.join(root, 'documento-preservado.txt'); await fs.writeFile(document, 'evidência sintética');
    assert.equal((await request('POST', `/api/ambiental/${id}/concluir`)).statusCode, 200);
    const completed = await detail();
    assert.equal(completed.status, 'Concluído'); assert.ok(completed.encerramento?.data);
    assert.equal(completed.history.length, historyBefore.length + 1);
    const repeated = await request('POST', `/api/ambiental/${id}/concluir`); assert.equal(repeated.statusCode, 409);
    for (const payload of [{ statusFase: 'Protocolo' }, { statusFase: 'Protocolo', status: 'Em Andamento' }]) {
      const blocked = await request('PATCH', `/api/ambiental/${id}/fase`, payload); assert.equal(blocked.statusCode, 409, blocked.body);
    }
    assert.equal((await request('POST', `/api/ambiental/${id}/andamentos`, progress)).statusCode, 409);
    const viaClient = await request('POST', `/api/clientes/${client}/historico`, { projetoId: id, titulo: 'Tentativa alternativa', descricao: 'Andamento', data: progress.data, tipo: 'Ambiental' });
    assert.equal(viaClient.statusCode, 409, viaClient.body);
    assert.deepEqual((await detail()).history, completed.history);
    assert.equal((await request('POST', `/api/ambiental/${assessment}/andamentos`, progress)).statusCode, 409);
    // If writing the history fails, the status change must roll back too.
    await db.run(sql`CREATE TRIGGER fail_environmental_history BEFORE INSERT ON interacoes_cliente BEGIN SELECT RAISE(ABORT, 'synthetic-write-failure'); END`);
    assert.equal((await request('POST', `/api/ambiental/${id}/reabrir`)).statusCode, 500);
    assert.equal((await detail()).status, 'Concluído'); assert.deepEqual((await detail()).history, completed.history);
    await db.run(sql`DROP TRIGGER fail_environmental_history`);
    const simultaneous = await Promise.all([request('POST', `/api/ambiental/${id}/reabrir`), request('POST', `/api/ambiental/${id}/reabrir`)]);
    assert.deepEqual(simultaneous.map(response => response.statusCode).sort(), [200, 409]);
    const reopened = await detail();
    assert.equal(reopened.status, 'Em Andamento'); assert.equal(reopened.statusFase, completed.statusFase); assert.equal(reopened.encerramento, null);
    assert.equal(reopened.history.filter(event => event.categoria === 'Reabertura do trabalho').length, 1);
    assert.ok(completed.history.every(event => reopened.history.some(saved => saved.id === event.id)));
    assert.equal(await fs.readFile(document, 'utf8'), 'evidência sintética');
    assert.equal((await request('PATCH', `/api/ambiental/${id}/fase`, { statusFase: 'Protocolo' })).statusCode, 200);
    assert.equal((await request('POST', `/api/ambiental/${id}/andamentos`, progress)).statusCode, 201);
    for (const invalid of [{ ...progress, titulo: '   ' }, { ...progress, descricao: ' '.repeat(10) }, { ...progress, categoria: '\t' }, { ...progress, titulo: 'a'.repeat(181) }, { ...progress, descricao: 'a'.repeat(3001) }, { ...progress, categoria: 'a'.repeat(121) }, { ...progress, data: '2026-02-30' }]) {
      assert.equal((await request('POST', `/api/ambiental/${id}/andamentos`, invalid)).statusCode, 400);
    }
    const boundary = await request('POST', `/api/ambiental/${id}/andamentos`, { ...progress, titulo: ' a' + 'a'.repeat(179) + ' ', descricao: 'b'.repeat(3000), categoria: 'c'.repeat(120) });
    assert.equal(boundary.statusCode, 201, boundary.body); assert.equal(boundary.json().titulo.length, 180);
    await db.update(schema.projetos).set({ deletedAt: new Date().toISOString() }).where(eq(schema.projetos.id, legacy));
    assert.equal((await request('POST', `/api/ambiental/${legacy}/reabrir`)).statusCode, 404);
  } finally { await server.close(); closeDb(); }
});
