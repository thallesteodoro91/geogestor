import { injectWithRecordVersion } from './test-support/record-request';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `dashboard-filters-${process.pid}`);
const databasePath = path.join(testRoot, 'dashboard-filters.integration.test.db');

process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

async function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) {
    await fs.rm(`${databasePath}${suffix}`, { force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
  }
}

test('dashboard aplica carteira atual e calcula conclusão pelas tarefas com prazo no período', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await cleanup();
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
    await db.insert(schema.clientes).values({ id: clientId, nome: 'Cliente Dashboard' });

    const projects = [
      { nome: 'Topografia ativa', tipo: 'Topografia', status: 'Em Andamento' },
      { nome: 'Ambiental ativo', tipo: 'Ambiental', status: 'Aguardando Documentação' },
      { nome: 'Topografia concluída', tipo: 'Topografia', status: 'Concluído' },
      { nome: 'Topografia concluída no feminino', tipo: 'Topografia', status: 'Concluída' },
      { nome: 'Topografia concluída sem acento', tipo: 'Topografia', status: 'Concluido' },
      { nome: 'Topografia concluída no feminino sem acento', tipo: 'Topografia', status: 'Concluida' },
      { nome: 'Especial finalizado', tipo: 'Especial', status: 'Finalizado' },
      { nome: 'Especial finalizada', tipo: 'Especial', status: 'Finalizada' },
      { nome: 'Ambiental cancelado', tipo: 'Ambiental', status: 'Cancelado' },
      { nome: 'Ambiental cancelada', tipo: 'Ambiental', status: 'Cancelada' },
      { nome: 'Jurídico arquivado', tipo: 'Jurídico', status: 'Arquivado' },
      { nome: 'Jurídico arquivada', tipo: 'Jurídico', status: 'Arquivada' },
    ].map((project) => ({ id: crypto.randomUUID(), clienteId: clientId, ...project }));
    await db.insert(schema.projetos).values([
      ...projects,
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        nome: 'Projeto excluído',
        tipo: 'Topografia',
        status: 'Em Andamento',
        deletedAt: '2026-08-10T10:00:00.000Z',
      },
    ]);

    await db.insert(schema.tarefas).values([
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        projetoId: projects[0].id,
        titulo: 'Concluída em agosto',
        status: 'Concluído',
        dataLimite: '2026-08-05',
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        projetoId: projects[0].id,
        titulo: 'Pendente em agosto',
        status: 'Em Progresso',
        dataLimite: '2026-08-20',
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        projetoId: projects[0].id,
        titulo: 'Concluída em julho',
        status: 'Finalizada',
        dataLimite: '2026-07-31',
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        projetoId: projects[0].id,
        titulo: 'Sem prazo',
        status: 'A Fazer',
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        projetoId: projects[0].id,
        titulo: 'Tarefa excluída',
        status: 'Concluído',
        dataLimite: '2026-08-15',
        deletedAt: '2026-08-16T10:00:00.000Z',
      },
    ]);

    const headers = { 'x-api-token': 'test-token' };
    const activeResponse = await injectWithRecordVersion(server, {
      method: 'GET',
      url: '/api/dashboard/overview?projectScope=active&tasksInicio=2026-08-01&tasksFim=2026-08-31',
      headers,
    });
    assert.equal(activeResponse.statusCode, 200, activeResponse.body);
    const active = activeResponse.json<{
      projectsTotal: number;
      projectsInScope: number;
      projectScope: string;
      projectByType: Array<{ name: string; value: number }>;
      projectByTypeStatus: Array<{ type: string; status: string; value: number }>;
      taskCompletion: { inicio: string; fim: string; total: number; completed: number; pending: number; rate: number };
    }>();
    assert.equal(active.projectsTotal, 12);
    assert.equal(active.projectsInScope, 2);
    assert.equal(active.projectScope, 'active');
    assert.deepEqual(active.projectByType.sort((a, b) => a.name.localeCompare(b.name)), [
      { name: 'Ambiental', value: 1 },
      { name: 'Topografia', value: 1 },
    ]);
    assert.deepEqual(active.taskCompletion, {
      inicio: '2026-08-01',
      fim: '2026-08-31',
      total: 2,
      completed: 1,
      pending: 1,
      rate: 50,
    });

    const allResponse = await injectWithRecordVersion(server, {
      method: 'GET',
      url: '/api/dashboard/overview?projectScope=all&tasksInicio=2026-09-01&tasksFim=2026-09-30',
      headers,
    });
    assert.equal(allResponse.statusCode, 200, allResponse.body);
    const all = allResponse.json<{
      projectsInScope: number;
      projectScope: string;
      taskCompletion: { total: number; completed: number; pending: number; rate: number };
    }>();
    assert.equal(all.projectsInScope, 12);
    assert.equal(all.projectScope, 'all');
    assert.deepEqual(all.taskCompletion, { inicio: '2026-09-01', fim: '2026-09-30', total: 0, completed: 0, pending: 0, rate: 0 });

    const invalidRange = await injectWithRecordVersion(server, {
      method: 'GET',
      url: '/api/dashboard/overview?tasksInicio=2026-08-31&tasksFim=2026-08-01',
      headers,
    });
    assert.equal(invalidRange.statusCode, 400);

    const incompleteRange = await injectWithRecordVersion(server, {
      method: 'GET',
      url: '/api/dashboard/overview?tasksInicio=2026-08-01',
      headers,
    });
    assert.equal(incompleteRange.statusCode, 400);

    const impossibleDate = await injectWithRecordVersion(server, {
      method: 'GET',
      url: '/api/dashboard/overview?tasksInicio=2026-02-30&tasksFim=2026-03-01',
      headers,
    });
    assert.equal(impossibleDate.statusCode, 400);

    const invalidScope = await injectWithRecordVersion(server, {
      method: 'GET',
      url: '/api/dashboard/overview?projectScope=historico',
      headers,
    });
    assert.equal(invalidScope.statusCode, 400);
  } finally {
    await server.close();
    await cleanup();
  }
});
