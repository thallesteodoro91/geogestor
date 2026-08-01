import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `dashboard-overview-${process.pid}`);
const databasePath = path.join(testRoot, 'dashboard-overview.integration.test.db');
const databaseFiles = [databasePath, `${databasePath}-shm`, `${databasePath}-wal`];

async function removeTestDatabase() {
  for (const file of databaseFiles) {
    try {
      await fs.rm(file, { force: true, maxRetries: 5, retryDelay: 100 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
    }
  }
}

process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('KPIs e listagens não truncam 600 clientes, 250 projetos e 700 tarefas', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();
  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  try {
    await dbReady;
    await runRuntimeMigrations();
    const clientIds = Array.from({ length: 600 }, () => crypto.randomUUID());
    await db.insert(schema.clientes).values(clientIds.map((id, index) => ({
      id,
      nome: `Cliente ${String(index + 1).padStart(4, '0')}`
    })));
    const projects = Array.from({ length: 250 }, (_, index) => ({
      id: crypto.randomUUID(),
      clienteId: clientIds[index % clientIds.length],
      nome: `Projeto ${String(index + 1).padStart(4, '0')}`
    }));
    await db.insert(schema.projetos).values(projects);
    await db.insert(schema.tarefas).values(Array.from({ length: 700 }, (_, index) => ({
      id: crypto.randomUUID(),
      clienteId: clientIds[index % clientIds.length],
      projetoId: projects[index % projects.length].id,
      titulo: `Tarefa ${String(index + 1).padStart(4, '0')}`,
      status: index < 280 ? 'Concluído' : 'A Fazer',
      contextoTipo: 'projeto'
    })));

    const headers = { 'x-api-token': 'test-token' };
    const [overviewResponse, clientsResponse, projectsResponse, tasksResponse] = await Promise.all([
      server.inject({ method: 'GET', url: '/api/dashboard/overview', headers }),
      server.inject({ method: 'GET', url: '/api/clientes?mode=page&limit=100', headers }),
      server.inject({ method: 'GET', url: '/api/projetos?mode=page&limit=100', headers }),
      server.inject({ method: 'GET', url: '/api/tarefas?mode=page&limit=100', headers })
    ]);

    assert.equal(overviewResponse.statusCode, 200, overviewResponse.body);
    const overview = overviewResponse.json<Record<string, unknown>>();
    assert.deepEqual({
      clientsTotal: overview.clientsTotal,
      projectsTotal: overview.projectsTotal,
      tasksTotal: overview.tasksTotal,
      tasksCompleted: overview.tasksCompleted,
      tasksPending: overview.tasksPending,
      taskCompletionRate: overview.taskCompletionRate
    }, {
      clientsTotal: 600,
      projectsTotal: 250,
      tasksTotal: 700,
      tasksCompleted: 280,
      tasksPending: 420,
      taskCompletionRate: 40
    });
    assert.equal(clientsResponse.json<{ total: number; items: unknown[] }>().total, 600);
    assert.equal(projectsResponse.json<{ total: number; items: unknown[] }>().total, 250);
    assert.equal(tasksResponse.json<{ total: number; items: unknown[] }>().total, 700);
  } finally {
    await server.close();
    await removeTestDatabase();
  }
});
