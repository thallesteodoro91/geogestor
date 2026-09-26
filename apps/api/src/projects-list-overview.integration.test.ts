import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const testRoot = path.resolve(process.cwd(), 'scratch', `projects-list-overview-${process.pid}`);
const databasePath = path.join(testRoot, 'projects-list-overview.integration.test.db');
const token = 'projects-list-overview-token';

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = token;

test('Projetos mantém resumo exclusivo, tipos consistentes e paginação estável com 1.000 registros', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(testRoot, { recursive: true });
  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);
  const request = (url: string) => server.inject({ method: 'GET', url, headers: { 'x-api-token': token } });

  try {
    await dbReady;
    await runRuntimeMigrations();
    const clients = Array.from({ length: 400 }, (_, index) => ({
      id: crypto.randomUUID(),
      nome: `Cliente sintético ${String(index + 1).padStart(3, '0')}`,
      municipio: index % 2 === 0 ? 'Florianópolis' : 'São José',
      uf: 'SC'
    }));
    for (let offset = 0; offset < clients.length; offset += 100) {
      await db.insert(schema.clientes).values(clients.slice(offset, offset + 100));
    }

    const projects = Array.from({ length: 1_000 }, (_, index) => ({
      id: crypto.randomUUID(),
      clienteId: clients[index % clients.length].id,
      nome: `Projeto sintético ${String(index + 1).padStart(4, '0')}`,
      descricao: index === 999 ? 'Descrição extensa para validar pesquisa e conteúdo sem carregar detalhes adicionais no mapa.' : null,
      status: index < 250
        ? 'Concluído'
        : index < 750
          ? 'Em Andamento'
          : index < 875
            ? 'Em Análise'
            : 'Atrasado',
      tipo: index < 500 ? null : index < 750 ? 'Rural' : 'Ambiental',
      dataInicio: '2026-01-01',
      dataEntrega: index < 500 ? '2000-01-01' : index < 875 ? '2999-12-31' : null,
      municipio: index % 2 === 0 ? 'Florianópolis' : 'São José',
      latitude: index % 2 === 0 ? -27.59 + index / 100_000 : null,
      longitude: index % 2 === 0 ? -48.55 - index / 100_000 : null,
      updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString()
    }));
    for (let offset = 0; offset < projects.length; offset += 100) {
      await db.insert(schema.projetos).values(projects.slice(offset, offset + 100));
    }

    const [overviewResponse, uninformedListResponse, uninformedOverviewResponse, sortedResponse, filtersResponse] = await Promise.all([
      request('/api/projetos/overview'),
      request('/api/projetos?mode=page&limit=24&tipo=N%C3%A3o%20informado'),
      request('/api/projetos/overview?tipo=N%C3%A3o%20informado'),
      request('/api/projetos?mode=page&limit=24&sort=name&direction=asc'),
      request('/api/projetos/filters')
    ]);
    for (const response of [overviewResponse, uninformedListResponse, uninformedOverviewResponse, sortedResponse, filtersResponse]) {
      assert.equal(response.statusCode, 200, response.body);
    }

    const overview = overviewResponse.json<{ total: number; completed: number; late: number; inProgress: number; other: number; typeStats: Array<{ type: string; count: number }> }>();
    assert.deepEqual({ total: overview.total, completed: overview.completed, late: overview.late, inProgress: overview.inProgress, other: overview.other }, {
      total: 1_000,
      completed: 250,
      late: 375,
      inProgress: 250,
      other: 125
    });
    assert.equal(overview.completed + overview.late + overview.inProgress + overview.other, overview.total);
    assert.ok(Object.values(overview).filter((value): value is number => typeof value === 'number').every((value) => value >= 0));
    assert.deepEqual(overview.typeStats, [
      { type: 'Ambiental', count: 250 },
      { type: 'Não informado', count: 500 },
      { type: 'Rural', count: 250 }
    ]);

    const uninformedList = uninformedListResponse.json<{ items: Array<{ tipo: string | null }>; total: number }>();
    const uninformedOverview = uninformedOverviewResponse.json<{ total: number; typeStats: Array<{ type: string; count: number }> }>();
    assert.equal(uninformedList.total, 500);
    assert.ok(uninformedList.items.every((project) => project.tipo == null || project.tipo.trim() === ''));
    assert.equal(uninformedOverview.total, 500);
    assert.deepEqual(uninformedOverview.typeStats, [{ type: 'Não informado', count: 500 }]);

    const sorted = sortedResponse.json<{ items: Array<{ nome: string }>; limit: number; total: number }>();
    assert.equal(sorted.limit, 24);
    assert.equal(sorted.total, 1_000);
    assert.equal(sorted.items[0]?.nome, 'Projeto sintético 0001');
    assert.equal(sorted.items[23]?.nome, 'Projeto sintético 0024');

    const filters = filtersResponse.json<{ types: Array<{ value: string; count: number }> }>();
    assert.ok(filters.types.some((item) => item.value === 'Não informado' && item.count === 500));

    const durations: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      const startedAt = performance.now();
      const response = await request('/api/projetos?mode=page&limit=24&sort=updated&direction=desc');
      durations.push(performance.now() - startedAt);
      assert.equal(response.statusCode, 200, response.body);
    }
    durations.sort((left, right) => left - right);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    assert.ok(p95 < 200, `P95 da listagem foi ${p95.toFixed(2)} ms`);

    const client = createClient({ url: `file:${databasePath}` });
    try {
      const plan = await client.execute(`EXPLAIN QUERY PLAN
        SELECT id, nome FROM projetos
        WHERE deleted_at IS NULL
        ORDER BY updated_at DESC, id
        LIMIT 24 OFFSET 0`);
      const details = plan.rows.map((row) => String(row.detail)).join('\n');
      assert.match(details, /idx_projetos_active_updated/);
      assert.doesNotMatch(details, /TEMP B-TREE FOR ORDER BY/);
    } finally {
      await client.close();
    }
  } finally {
    await server.close();
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
  }
});
