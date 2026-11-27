import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('scratch', `edit-concurrency-${process.pid}-${crypto.randomUUID()}`);
process.env.GEOGESTOR_DB_PATH = path.join(root, 'test.db');
process.env.GEOGESTOR_API_TOKEN = 'test-token';
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';

test('edição atômica recusa versões obsoletas, exclusão, ausência de token e permite resolver conflito', async () => {
  await fs.mkdir(root, { recursive: true });
  const [{ server }, { db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'), import('./db'), import('./services/runtime-migrations.service'), import('@geogestor/database')
  ]);
  const request = (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: Record<string, unknown>, token?: string) => server.inject({
    method, url, payload,
    headers: { 'x-api-token': 'test-token', ...(token ? { 'if-match': token } : {}) }
  });
  try {
    await dbReady;
    await runRuntimeMigrations();
    const clienteId = crypto.randomUUID();
    await db.insert(schema.clientes).values({ id: clienteId, nome: 'Empresa fictícia QA' });
    const create = async (nome: string) => {
      const response = await request('POST', '/api/dados-operacionais/propriedades', { clienteId, nome, matricula: nome, municipio: 'Florianópolis', uf: 'SC' });
      assert.equal(response.statusCode, 201, response.body);
      return response.json<{ id: string; editToken: string }>();
    };
    const a = await create('Propriedade A');
    const b = await create('Propriedade B');
    const url = `/api/dados-operacionais/propriedades/${a.id}`;
    assert.equal((await request('PATCH', url, { observacoes: 'Sem versão' })).statusCode, 409);
    const attempts = await Promise.all([
      request('PATCH', url, { observacoes: 'Janela A' }, a.editToken),
      request('PATCH', url, { observacoes: 'Janela B' }, a.editToken)
    ]);
    assert.deepEqual(attempts.map((r) => r.statusCode).sort(), [200, 409]);
    assert.equal((await request('PATCH', `/api/dados-operacionais/propriedades/${b.id}`, { observacoes: 'Independente' }, b.editToken)).statusCode, 200);
    const current = (await request('GET', url)).json<{ editToken: string }>();
    const retry = await request('PATCH', url, { observacoes: 'Rascunho revisto' }, current.editToken);
    assert.equal(retry.statusCode, 200, retry.body);
    const latest = retry.json<{ editToken: string }>();
    assert.notEqual(latest.editToken, current.editToken);
    assert.equal((await request('DELETE', url, undefined, latest.editToken)).statusCode, 204);
    assert.equal((await request('PATCH', url, { observacoes: 'Tentativa após exclusão' }, latest.editToken)).statusCode, 409);
    assert.equal((await request('GET', url)).statusCode, 404);

    const key = 'geogestor_tipos_servico';
    const catalog = (nome: string) => [{ id: 'qa-service', nome, categoria: 'QA', valorSugerido: 0, ativo: true }];
    const settingsUrl = '/api/dados-operacionais/configuracoes-operacionais';
    assert.equal((await request('PUT', settingsUrl, { values: { [key]: catalog('Inicial') }, expectedValues: { [key]: null } })).statusCode, 200);
    const stale = { [key]: catalog('Inicial') };
    const catalogAttempts = await Promise.all(['A', 'B'].map((name) => request('PUT', settingsUrl, { values: { [key]: catalog(name) }, expectedValues: stale })));
    assert.deepEqual(catalogAttempts.map((r) => r.statusCode).sort(), [200, 409], catalogAttempts.map((r) => r.body).join('\n'));
    const currentSettings = (await request('GET', settingsUrl)).json<Record<string, unknown>>();
    assert.equal((await request('PUT', settingsUrl, { values: { [key]: catalog('Resolvido') }, expectedValues: { [key]: currentSettings[key] } })).statusCode, 200);
    assert.equal((await request('PUT', settingsUrl, { values: { [key]: catalog('Sem base') } })).statusCode, 409);
  } finally {
    await server.close();
    closeDb();
  }
});
