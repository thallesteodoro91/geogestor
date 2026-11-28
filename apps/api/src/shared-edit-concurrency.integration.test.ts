import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
const root = path.resolve('scratch', `shared-edit-${process.pid}-${crypto.randomUUID()}`);
process.env.GEOGESTOR_DB_PATH = path.join(root, 'qa.db');
process.env.GEOGESTOR_API_TOKEN = 'qa-token';
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';

test('registros compartilhados congelam versões e revalidam integridade após cada transação', async () => {
  const [{ server }, { db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }, { sql, eq }] = await Promise.all([
    import('./server'), import('./db'), import('./services/runtime-migrations.service'), import('@geogestor/database'), import('drizzle-orm')
  ]);
  const request = (method: 'GET' | 'PATCH' | 'DELETE', url: string, payload?: unknown, version?: string) => server.inject({ method, url, payload: payload as object,
    headers: { 'x-api-token': 'qa-token', ...(version ? { 'x-record-version': version } : {}) } });
  try {
    await dbReady; await runRuntimeMigrations();
    const [a, b] = await db.insert(schema.clientes).values(['A', 'B'].map(nome => ({ id: crypto.randomUUID(), nome: `QA sintético ${nome}` }))).returning();
    const url = `/api/clientes/${a.id}`;
    const attempts = await Promise.all(['Primeira janela', 'Segunda janela'].map(nome => request('PATCH', url, { nome }, a.updatedAt)));
    assert.deepEqual(attempts.map(r => r.statusCode).sort(), [200, 409]);
    const independent = await request('PATCH', `/api/clientes/${b.id}`, { nome: 'Registro independente' }, b.updatedAt);
    assert.equal(independent.statusCode, 200, independent.body);
    const reviewed = (await request('GET', `/api/edicao/atual?path=${encodeURIComponent(url)}`)).json<{ updatedAt: string }>();
    assert.equal((await request('PATCH', url, { nome: 'Rascunho revisto' }, reviewed.updatedAt)).statusCode, 200);
    const [latest] = await db.select().from(schema.clientes).where(eq(schema.clientes.id, a.id));
    assert.equal((await request('DELETE', url, undefined, latest.updatedAt)).statusCode, 204);
    assert.equal((await request('PATCH', url, { nome: 'Não ressuscitar' }, latest.updatedAt)).statusCode, 409);
    assert.equal((await request('GET', `/api/edicao/atual?path=${encodeURIComponent(url)}`)).statusCode, 404);
    const foreignKeys = await db.all(sql`PRAGMA foreign_keys`);
    assert.equal(Number((foreignKeys[0] as { foreign_keys: number }).foreign_keys), 1);
    await assert.rejects(db.transaction(tx => tx.insert(schema.projetos).values({ id: crypto.randomUUID(), nome: 'Vínculo inválido', clienteId: crypto.randomUUID() })), error => /FOREIGN KEY/.test(String((error as Error & { cause?: Error }).cause?.message || error)));
  } finally { await server.close(); closeDb(); }
});
