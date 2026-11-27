import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import test from 'node:test';
const root = path.resolve('scratch', `scale-pagination-${process.pid}-${crypto.randomUUID()}`);
process.env.GEOGESTOR_DB_PATH = path.join(root, 'qa.db');
process.env.GEOGESTOR_API_TOKEN = 'qa-token';
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';
test('páginas SQL preservam filtros, estabilidade e todas as pendências de importação', async () => {
  const [{ server }, { db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }, imports] = await Promise.all([
    import('./server'), import('./db'), import('./services/runtime-migrations.service'), import('@geogestor/database'), import('./services/import-run.service')
  ]);
  const get = async (url: string) => { const r = await server.inject({ method: 'GET', url, headers: { 'x-api-token': 'qa-token' } }); assert.equal(r.statusCode, 200, r.body); return r.json(); };
  try {
    await dbReady; await runRuntimeMigrations();
    const clientId = crypto.randomUUID(), projectId = crypto.randomUUID();
    await db.insert(schema.clientes).values({ id: clientId, nome: 'QA cliente', origem: 'ÚLTIMO CAMPO' });
    await db.insert(schema.projetos).values({ id: projectId, clienteId: clientId, nome: 'QA projeto' });
    await db.insert(schema.licencas).values(Array.from({ length: 120 }, (_, i) => ({ id: crypto.randomUUID(), projetoId: projectId, clienteId: clientId,
      numero: `QA-${i}`, tipoLicenca: 'LAO', orgao: 'QA', dataEmissao: '2026-01-01', dataVencimento: '2099-01-01', status: i % 2 ? 'Válida' : 'Suspensa' })));
    const first = await get('/api/licencas?mode=page&limit=25&status=V%C3%A1lida');
    const second = await get('/api/licencas?mode=page&limit=25&status=V%C3%A1lida&page=2');
    assert.equal(first.total, 60); assert.equal(first.items.length, 25); assert.equal(second.items.length, 25);
    assert.ok(first.items.every((item: { id: string }) => !second.items.some((other: { id: string }) => other.id === item.id)));
    assert.deepEqual(first.items, (await get('/api/licencas?mode=page&limit=25&status=V%C3%A1lida')).items);
    assert.equal((await get('/api/licencas/summary')).total, 120);
    const issues = Array.from({ length: 203 }, (_, i) => ({ row: i + 2, field: 'nome', severity: 'warning', message: `Aviso QA ${i}` }));
    const preview = await imports.registerImportPreview({ entity: 'complete', digest: 'qa-digest', totalRows: 203, preview: { status: 'ready', issues } });
    const pages = await Promise.all([1, 2, 3, 4, 5].map(page => get(`/api/importacoes/${preview.previewId}/pendencias?kind=row&page=${page}&limit=50`)));
    assert.equal(pages[0].total, 203); assert.deepEqual(pages.flatMap(page => page.items), issues);
    assert.equal((await get(`/api/importacoes/${preview.previewId}/linhas?errorsOnly=false`)).total, 0);
    assert.equal((await get('/api/search?q=ultimo')).results[0].id, clientId);
  } finally { await server.close(); closeDb(); }
});
