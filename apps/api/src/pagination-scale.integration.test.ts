import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `pagination-scale-${process.pid}`);
const databasePath = path.join(testRoot, 'pagination-scale.integration.test.db');

process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

async function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) {
    await fs.rm(`${databasePath}${suffix}`, { force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
  }
}

test('busca paginada localiza registros após 1.000 sem duplicar e mantém KPIs completos', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await cleanup();
  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  try {
    await dbReady;
    await runRuntimeMigrations();
    const clientIds = Array.from({ length: 1_500 }, () => crypto.randomUUID());
    await db.insert(schema.clientes).values(clientIds.map((id, index) => ({
      id,
      nome: `Cliente escala ${String(index + 1).padStart(4, '0')}`
    })));
    const projects = Array.from({ length: 1_200 }, (_, index) => ({
      id: crypto.randomUUID(),
      clienteId: clientIds[index],
      nome: `Projeto escala ${String(index + 1).padStart(4, '0')}`
    }));
    await db.insert(schema.projetos).values(projects);
    await db.insert(schema.tarefas).values(Array.from({ length: 2_000 }, (_, index) => ({
      id: crypto.randomUUID(),
      clienteId: clientIds[index % clientIds.length],
      projetoId: projects[index % projects.length].id,
      titulo: `Tarefa escala ${String(index + 1).padStart(4, '0')}`,
      status: index < 800 ? 'Concluído' : 'A Fazer',
      contextoTipo: 'projeto'
    })));
    await db.insert(schema.propriedades).values(Array.from({ length: 1_100 }, (_, index) => ({
      id: crypto.randomUUID(),
      clienteId: clientIds[index],
      nome: `Propriedade escala ${String(index + 1).padStart(4, '0')}`
    })));

    const headers = { 'x-api-token': 'test-token' };
    const [overview, clientsPage, clientSearch, projectsPage, projectSearch, tasksPage, taskSearch, propertiesPage, propertySearch] = await Promise.all([
      server.inject({ method: 'GET', url: '/api/dashboard/overview', headers }),
      server.inject({ method: 'GET', url: '/api/clientes/options?mode=page&page=15&limit=100', headers }),
      server.inject({ method: 'GET', url: '/api/clientes/options?mode=page&q=Cliente%20escala%201401', headers }),
      server.inject({ method: 'GET', url: '/api/projetos?mode=page&page=12&limit=100', headers }),
      server.inject({ method: 'GET', url: '/api/projetos?mode=page&q=Projeto%20escala%201101', headers }),
      server.inject({ method: 'GET', url: '/api/tarefas?mode=page&page=20&limit=100', headers }),
      server.inject({ method: 'GET', url: '/api/tarefas?mode=page&q=Tarefa%20escala%201901', headers }),
      server.inject({ method: 'GET', url: '/api/dados-operacionais/propriedades?page=11&limit=100', headers }),
      server.inject({ method: 'GET', url: '/api/dados-operacionais/propriedades?q=Propriedade%20escala%201050', headers })
    ]);

    for (const response of [overview, clientsPage, clientSearch, projectsPage, projectSearch, tasksPage, taskSearch, propertiesPage, propertySearch]) {
      assert.equal(response.statusCode, 200, response.body);
    }
    const totals = overview.json<{
      clientsTotal: number; projectsTotal: number; tasksTotal: number;
      tasksCompleted: number; tasksPending: number; taskCompletionRate: number;
    }>();
    assert.deepEqual({
      clientsTotal: totals.clientsTotal,
      projectsTotal: totals.projectsTotal,
      tasksTotal: totals.tasksTotal,
      tasksCompleted: totals.tasksCompleted,
      tasksPending: totals.tasksPending,
      taskCompletionRate: totals.taskCompletionRate
    }, {
      clientsTotal: 1_500,
      projectsTotal: 1_200,
      tasksTotal: 2_000,
      tasksCompleted: 800,
      tasksPending: 1_200,
      taskCompletionRate: 40
    });
    assert.equal(clientsPage.json<{ items: unknown[]; total: number }>().items.length, 100);
    assert.equal(clientsPage.json<{ total: number }>().total, 1_500);
    assert.equal(clientSearch.json<{ items: Array<{ nome: string }> }>().items[0]?.nome, 'Cliente escala 1401');
    assert.equal(projectsPage.json<{ items: unknown[]; total: number }>().items.length, 100);
    assert.equal(projectsPage.json<{ total: number }>().total, 1_200);
    assert.equal(projectSearch.json<{ items: Array<{ nome: string }> }>().items[0]?.nome, 'Projeto escala 1101');
    assert.equal(tasksPage.json<{ items: unknown[]; total: number }>().items.length, 100);
    assert.equal(tasksPage.json<{ total: number }>().total, 2_000);
    assert.equal(taskSearch.json<{ items: Array<{ titulo: string }> }>().items[0]?.titulo, 'Tarefa escala 1901');
    assert.equal(propertiesPage.json<{ items: unknown[]; total: number }>().items.length, 100);
    assert.equal(propertiesPage.json<{ total: number }>().total, 1_100);
    assert.equal(propertySearch.json<{ items: Array<{ nome: string }> }>().items[0]?.nome, 'Propriedade escala 1050');
  } finally {
    await server.close();
    await cleanup();
  }
});
