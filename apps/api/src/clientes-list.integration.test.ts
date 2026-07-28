import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';

const testRoot = path.resolve(process.cwd(), 'scratch', `clientes-list-${process.pid}`);
const dbPath = path.join(testRoot, 'geogestor.db');
const token = 'clientes-list-token';

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = token;

test('listagem preserva contrato, paginação, soft delete e contagem híbrida entre 0 e 500 clientes', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(testRoot, { recursive: true });
  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);
  const request = (url: string) => server.inject({ method: 'GET', url, headers: { 'x-api-token': token } });

  async function addClients(start: number, end: number) {
    const values = Array.from({ length: end - start }, (_, offset) => {
      const index = start + offset;
      const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
      return {
        id: `cliente-${String(index).padStart(4, '0')}`,
        nome: `Cliente sintético ${String(index).padStart(4, '0')}`,
        tipoPessoa: index % 2 === 0 ? 'PF' : 'PJ',
        email: `cliente-${index}@example.invalid`,
        municipio: 'Florianópolis',
        uf: 'SC',
        situacao: 'Ativo',
        createdAt: timestamp,
        updatedAt: timestamp
      };
    });
    for (let offset = 0; offset < values.length; offset += 20) {
      await db.insert(schema.clientes).values(values.slice(offset, offset + 20));
    }
  }

  try {
    await dbReady;
    await runRuntimeMigrations();

    const empty = await request('/api/clientes?limit=500');
    assert.equal(empty.statusCode, 200, empty.body);
    assert.deepEqual(empty.json(), []);

    await addClients(0, 1);
    await db.insert(schema.propriedades).values([
      { id: 'property-active-1', clienteId: 'cliente-0000', nome: 'Imóvel estruturado 1' },
      { id: 'property-active-2', clienteId: 'cliente-0000', nome: 'Imóvel estruturado 2' },
      { id: 'property-deleted', clienteId: 'cliente-0000', nome: 'Imóvel excluído', deletedAt: new Date().toISOString() }
    ]);
    await db.insert(schema.projetos).values([
      { id: 'legacy-project', clienteId: 'cliente-0000', nome: 'Projeto legado' },
      { id: 'structured-project', clienteId: 'cliente-0000', nome: 'Projeto vinculado', propriedadeId: 'property-active-1' },
      { id: 'deleted-project', clienteId: 'cliente-0000', nome: 'Projeto excluído', deletedAt: new Date().toISOString() }
    ]);

    const one = await request('/api/clientes?limit=500');
    assert.equal(one.statusCode, 200, one.body);
    const oneBody = one.json<Array<Record<string, unknown>>>();
    assert.equal(oneBody.length, 1);
    assert.equal(oneBody[0].propriedadesCount, 3);
    const databaseRow = (await db.select().from(schema.clientes).limit(1))[0];
    assert.deepEqual(Object.keys(oneBody[0]).sort(), [...Object.keys(databaseRow), 'propriedadesCount'].sort());
    for (const [key, value] of Object.entries(databaseRow)) {
      assert.equal(typeof oneBody[0][key], typeof value, `tipo divergente no campo ${key}`);
    }
    assert.equal(typeof oneBody[0].propriedadesCount, 'number');

    await addClients(1, 100);
    const hundred = await request('/api/clientes?limit=100');
    assert.equal(hundred.statusCode, 200, hundred.body);
    assert.equal(hundred.json<unknown[]>().length, 100);

    await addClients(100, 400);
    const fourHundred = await request('/api/clientes?limit=500');
    assert.equal(fourHundred.statusCode, 200, fourHundred.body);
    assert.equal(fourHundred.json<unknown[]>().length, 400);

    await addClients(400, 500);
    await db.insert(schema.clientes).values({
      id: 'cliente-soft-deleted',
      nome: 'Cliente excluído',
      deletedAt: new Date().toISOString()
    });
    const fiveHundred = await request('/api/clientes?limit=500');
    assert.equal(fiveHundred.statusCode, 200, fiveHundred.body);
    assert.equal(fiveHundred.json<unknown[]>().length, 500);
    assert.equal(fiveHundred.json<Array<{ id: string }>>().some((cliente) => cliente.id === 'cliente-soft-deleted'), false);

    for (let page = 1; page <= 5; page += 1) {
      const response = await request(`/api/clientes?page=${page}&limit=100`);
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json<unknown[]>().length, 100);
    }
    const afterLastPage = await request('/api/clientes?page=6&limit=100');
    assert.equal(afterLastPage.statusCode, 200, afterLastPage.body);
    assert.deepEqual(afterLastPage.json(), []);

    const client = createClient({ url: `file:${dbPath}` });
    try {
      const plan = await client.execute(`EXPLAIN QUERY PLAN
        SELECT c.*,
          (SELECT count(*) FROM propriedades p WHERE p.cliente_id = c.id AND p.deleted_at IS NULL)
          + (SELECT count(*) FROM projetos pr WHERE pr.cliente_id = c.id AND pr.propriedade_id IS NULL AND pr.deleted_at IS NULL)
        FROM clientes c
        WHERE c.deleted_at IS NULL
        ORDER BY c.created_at DESC
        LIMIT 500 OFFSET 0`);
      const details = plan.rows.map((row) => String(row.detail)).join('\n');
      assert.match(details, /idx_clientes_active_created_at/);
      assert.match(details, /idx_propriedades_cliente_id/);
      assert.match(details, /idx_projetos_cliente_status_data|idx_projetos_cliente_id/);
      assert.doesNotMatch(details, /TEMP B-TREE FOR ORDER BY/);
    } finally {
      await client.close();
    }
  } finally {
    await server.close();
  }
});
