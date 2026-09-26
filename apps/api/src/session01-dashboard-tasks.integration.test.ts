import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `session01-dashboard-tasks-${process.pid}`);
const databasePath = path.join(testRoot, 'geogestor.db');
const databaseFiles = [databasePath, `${databasePath}-shm`, `${databasePath}-wal`];
const headers = { 'x-api-token': 'session01-test-token' };

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = headers['x-api-token'];

async function cleanup() {
  await Promise.allSettled(databaseFiles.map((file) => fs.rm(file, { force: true })));
  await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }).catch(() => undefined);
}

test('tarefas validam o contrato, respeitam exclusão lógica e não ocultam próximos vencimentos', async () => {
  await cleanup();
  await fs.mkdir(testRoot, { recursive: true });
  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database'),
  ]);

  try {
    await dbReady;
    await runRuntimeMigrations();
    const clientId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const deletedProjectId = crypto.randomUUID();
    await db.insert(schema.clientes).values({ id: clientId, nome: 'QA-AUDIT-S01-Cliente' });
    await db.insert(schema.projetos).values([
      { id: projectId, clienteId: clientId, nome: 'QA-AUDIT-S01-Projeto' },
      { id: deletedProjectId, clienteId: clientId, nome: 'QA-AUDIT-S01-Projeto excluído', deletedAt: new Date().toISOString() },
    ]);

    const request = (options: {
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      url: string;
      payload?: Record<string, unknown>;
    }) => server.inject({
      ...options,
      headers: options.payload === undefined ? headers : { ...headers, 'content-type': 'application/json' },
    });

    for (const payload of [
      { projetoId: projectId, titulo: '   ' },
      { projetoId: projectId, titulo: 'Status inválido', status: 'Teleportada' },
      { projetoId: projectId, titulo: 'Prioridade inválida', prioridade: 'Urgentíssima' },
      { projetoId: projectId, titulo: 'Data inválida', dataLimite: '2026-02-30' },
      { projetoId: deletedProjectId, titulo: 'Projeto excluído' },
    ]) {
      const response = await request({ method: 'POST', url: '/api/tarefas', payload });
      assert.equal(response.statusCode, 400, `${JSON.stringify(payload)} retornou ${response.statusCode}: ${response.body}`);
    }

    const createResponse = await request({
      method: 'POST',
      url: '/api/tarefas',
      payload: {
        projetoId: projectId,
        titulo: '  QA-AUDIT-S01-Tarefa válida  ',
        status: 'A Fazer',
        prioridade: 'Alta',
        dataLimite: '2026-09-30',
      },
    });
    assert.equal(createResponse.statusCode, 200, createResponse.body);
    const created = createResponse.json<{ id: string; titulo: string }>();
    assert.equal(created.titulo, 'QA-AUDIT-S01-Tarefa válida');

    const invalidPatch = await request({ method: 'PATCH', url: `/api/tarefas/${created.id}`, payload: { dataLimite: 'não-é-data' } });
    assert.equal(invalidPatch.statusCode, 400, invalidPatch.body);
    const missingPatch = await request({ method: 'PATCH', url: `/api/tarefas/${crypto.randomUUID()}`, payload: { status: 'Concluído' } });
    assert.equal(missingPatch.statusCode, 404, missingPatch.body);

    const deleteResponse = await request({ method: 'DELETE', url: `/api/tarefas/${created.id}` });
    assert.equal(deleteResponse.statusCode, 200, deleteResponse.body);
    assert.equal((await request({ method: 'PATCH', url: `/api/tarefas/${created.id}`, payload: { status: 'Concluído' } })).statusCode, 404);
    assert.equal((await request({ method: 'DELETE', url: `/api/tarefas/${created.id}` })).statusCode, 404);

    await db.insert(schema.tarefas).values([
      ...Array.from({ length: 101 }, (_, index) => ({
        id: crypto.randomUUID(),
        clienteId: clientId,
        projetoId: projectId,
        titulo: `QA-AUDIT-S01-Sem prazo ${index}`,
        dataLimite: '',
        status: 'A Fazer',
      })),
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        projetoId: projectId,
        titulo: 'QA-AUDIT-S01-Próximo vencimento',
        dataLimite: '2026-09-15',
        status: 'Em Progresso',
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        projetoId: projectId,
        titulo: 'QA-AUDIT-S01-Finalizada não deve aparecer',
        dataLimite: '2026-09-10',
        status: 'Finalizado',
      },
    ]);

    const dashboardResponse = await request({
      method: 'GET',
      url: '/api/dashboard/overview?projectScope=active&tasksInicio=2026-09-01&tasksFim=2026-09-30',
    });
    assert.equal(dashboardResponse.statusCode, 200, dashboardResponse.body);
    const upcoming = dashboardResponse.json<{ upcomingTasks: Array<{ titulo: string }> }>().upcomingTasks;
    assert.ok(upcoming.some((task: { titulo: string }) => task.titulo === 'QA-AUDIT-S01-Próximo vencimento'));
    assert.ok(upcoming.every((task: { titulo: string }) => task.titulo !== 'QA-AUDIT-S01-Finalizada não deve aparecer'));
    assert.ok(upcoming.every((task: { titulo: string }) => !task.titulo.startsWith('QA-AUDIT-S01-Sem prazo')));
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await cleanup();
  }
});
