import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `project-import-association-${process.pid}`);
const dbPath = path.join(testRoot, 'project-import-association.test.db');
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'project-import-association-token';
process.env.NODE_ENV = 'test';

const headers = { 'content-type': 'application/json', 'x-api-token': 'project-import-association-token' };

test('prévia e confirmação associam projetos somente a clientes ativos e confirmados', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await Promise.all(dbFiles.map(file => fs.rm(file, { force: true })));
  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }, { AuditLogService }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database'),
    import('./services/audit.service')
  ]);
  try {
    await dbReady;
    await runRuntimeMigrations();
    const documentClientId = crypto.randomUUID();
    const exactNameClientId = crypto.randomUUID();
    const duplicateOneId = crypto.randomUUID();
    const duplicateTwoId = crypto.randomUUID();
    const inactiveId = crypto.randomUUID();
    const deletedId = crypto.randomUUID();
    await db.insert(schema.clientes).values([
      { id: documentClientId, nome: 'Empresa Documento', tipoPessoa: 'PJ', cnpj: '45.723.174/0001-10', documentoNormalizado: '45723174000110', municipio: 'Florianópolis', situacao: 'Ativo' },
      { id: exactNameClientId, nome: 'Cliente Nome Exato', municipio: 'São José', situacao: 'Ativo' },
      { id: duplicateOneId, nome: 'Cliente Duplicado', situacao: 'Ativo' },
      { id: duplicateTwoId, nome: 'Cliente Duplicado', situacao: 'Ativo' },
      { id: inactiveId, nome: 'Cliente Inativo', situacao: 'Inativo' },
      { id: deletedId, nome: 'Cliente Excluído', situacao: 'Ativo', deletedAt: new Date().toISOString() }
    ]);

    const optionsResponse = await server.inject({ method: 'GET', url: '/api/projetos/lote/clientes?q=Cliente', headers });
    assert.equal(optionsResponse.statusCode, 200, optionsResponse.body);
    const options = optionsResponse.json<Array<{ id: string; documentoMascarado: string | null }>>();
    assert.ok(options.some(option => option.id === exactNameClientId));
    assert.ok(!options.some(option => option.id === inactiveId || option.id === deletedId));
    const documentOptionsResponse = await server.inject({ method: 'GET', url: '/api/projetos/lote/clientes?q=45.723.174', headers });
    const documentOption = documentOptionsResponse.json<Array<{ id: string; documentoMascarado: string | null }>>()[0];
    assert.equal(documentOption.documentoMascarado, 'CNPJ **.***.***/****-10');
    assert.ok(!documentOptionsResponse.body.includes('45723174000110'));

    const previewResponse = await server.inject({
      method: 'POST', url: '/api/projetos/lote/preview', headers,
      payload: [
        { nome: 'Por documento', clienteReferencia: '45.723.174/0001-10' },
        { nome: 'Por nome', clienteReferencia: ' cliente nome exato ' },
        { nome: 'Ambíguo', clienteReferencia: 'Cliente Duplicado' },
        { nome: 'Inexistente', clienteReferencia: 'Cliente que não existe' },
        { nome: 'Manual', clienteReferencia: 'Cliente Duplicado', clienteId: exactNameClientId, associacaoManual: true },
        { nome: 'Inativo manual', clienteId: inactiveId, associacaoManual: true },
        { nome: 'Pendente manual', clienteReferencia: 'Cliente Nome Exato', associacaoPendente: true }
      ]
    });
    assert.equal(previewResponse.statusCode, 200, previewResponse.body);
    const preview = previewResponse.json<{ status: string; counts: { automatic: number; manual: number; pending: number; ambiguous: number; missing: number }; rows: Array<{ reason: string; association?: { clientId: string } }> }>();
    assert.equal(preview.status, 'blocked');
    assert.equal(preview.counts.automatic, 2);
    assert.equal(preview.counts.manual, 1);
    assert.equal(preview.counts.pending, 4);
    assert.equal(preview.counts.ambiguous, 1);
    assert.equal(preview.counts.missing, 2);
    assert.equal(preview.rows[0].association?.clientId, documentClientId);
    assert.equal(preview.rows[1].association?.clientId, exactNameClientId);
    assert.equal(preview.rows[2].reason, 'ambiguous');
    assert.equal(preview.rows[5].reason, 'missing');
    assert.equal(preview.rows[6].reason, 'manual_pending');

    const partialResponse = await server.inject({
      method: 'POST', url: '/api/projetos/lote', headers,
      payload: [
        { nome: 'Projeto válido por documento', clienteReferencia: '45.723.174/0001-10' },
        { nome: 'Projeto sem cliente', clienteReferencia: 'Cliente inexistente' }
      ]
    });
    assert.equal(partialResponse.statusCode, 201, partialResponse.body);
    const partial = partialResponse.json<{ status: string; imported: number; failed: number; results: Array<{ association?: { method: string } }> }>();
    assert.equal(partial.status, 'partial');
    assert.equal(partial.imported, 1);
    assert.equal(partial.failed, 1);
    assert.equal(partial.results[0].association?.method, 'document');
    assert.equal((await db.select().from(schema.projetos).where(eq(schema.projetos.nome, 'Projeto sem cliente'))).length, 0);

    const manualResponse = await server.inject({
      method: 'POST', url: '/api/projetos/lote', headers,
      payload: [{ nome: 'Projeto associado manualmente', clienteReferencia: 'Cliente Duplicado', clienteId: exactNameClientId, associacaoManual: true }]
    });
    assert.equal(manualResponse.statusCode, 201, manualResponse.body);
    const manual = manualResponse.json<{ results: Array<{ association?: { clientId: string; method: string } }> }>();
    assert.equal(manual.results[0].association?.clientId, exactNameClientId);
    assert.equal(manual.results[0].association?.method, 'manual');
    const [manualProject] = await db.select().from(schema.projetos).where(eq(schema.projetos.nome, 'Projeto associado manualmente'));
    assert.equal(manualProject.clienteId, exactNameClientId);

    AuditLogService.setFailureInjectorForTests(() => { throw new Error('falha de auditoria da importação de projetos'); });
    const rollbackResponse = await server.inject({
      method: 'POST', url: '/api/projetos/lote', headers,
      payload: [{ nome: 'Projeto que deve ser revertido', clienteId: exactNameClientId, associacaoManual: true }]
    });
    AuditLogService.setFailureInjectorForTests(null);
    assert.equal(rollbackResponse.statusCode, 500);
    assert.equal((await db.select().from(schema.projetos).where(eq(schema.projetos.nome, 'Projeto que deve ser revertido'))).length, 0);
  } finally {
    AuditLogService.setFailureInjectorForTests(null);
    await server.close();
    (db as unknown as { $client: { close: () => void } }).$client.close();
    await Promise.allSettled(dbFiles.map(file => fs.rm(file, { force: true })));
  }
});
