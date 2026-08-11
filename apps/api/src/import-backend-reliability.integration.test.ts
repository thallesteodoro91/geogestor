import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq, sql } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `import-backend-reliability-${process.pid}`);
const dbPath = path.join(testRoot, 'import-backend-reliability.test.db');
const authHeaders = { 'content-type': 'application/json', 'x-api-token': 'import-reliability-token' };

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'import-reliability-token';
process.env.NODE_ENV = 'test';

async function removeDatabase() {
  for (const suffix of ['', '-shm', '-wal']) {
    await fs.rm(`${dbPath}${suffix}`, { force: true, maxRetries: 5, retryDelay: 50 });
  }
}

test('importador preserva idempotência, histórico, limites, prévia e sucesso após commit', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeDatabase();
  const [database, databasePackage, migrations, serverModule, runService, outboxModule, auditModule] = await Promise.all([
    import('./db'),
    import('@geogestor/database'),
    import('./services/runtime-migrations.service'),
    import('./server'),
    import('./services/import-run.service'),
    import('./services/filesystem-outbox.service'),
    import('./services/audit.service')
  ]);
  const { db, dbReady, closeDb } = database;
  const { schema } = databasePackage;
  const { server } = serverModule;
  const request = async (options: { method: 'GET' | 'POST'; url: string; payload?: any; key?: string }) => server.inject({
    method: options.method,
    url: options.url,
    payload: options.payload,
    headers: options.payload === undefined
      ? { 'x-api-token': authHeaders['x-api-token'] }
      : { ...authHeaders, ...(options.key ? { 'idempotency-key': options.key } : {}) }
  });

  try {
    await dbReady;
    await migrations.runRuntimeMigrations();
    await runService.ensureImportInfrastructure();

    const contactKey = `contact-${crypto.randomUUID()}`;
    const contactPayload = [{ nome: 'Contato Idempotente', email: 'IDEMPOTENTE@EXEMPLO.COM' }];
    const first = await request({ method: 'POST', url: '/api/contatos/lote', payload: contactPayload, key: contactKey });
    assert.equal(first.statusCode, 201, first.body);
    const firstResult = first.json<{ importId: string; imported: number }>();
    assert.equal(firstResult.imported, 1);

    const replay = await request({ method: 'POST', url: '/api/contatos/lote', payload: contactPayload, key: contactKey });
    assert.equal(replay.statusCode, 200, replay.body);
    assert.equal(replay.json<{ requestReused: boolean; importId: string }>().requestReused, true);
    assert.equal(replay.json<{ importId: string }>().importId, firstResult.importId);
    const contactCount = await db.select({ count: sql<number>`count(*)` }).from(schema.contatos)
      .where(eq(schema.contatos.email, 'idempotente@exemplo.com'));
    assert.equal(Number(contactCount[0].count), 1);
    assert.ok(!JSON.stringify((await request({ method: 'GET', url: `/api/importacoes/${firstResult.importId}` })).json()).includes('idempotente@exemplo.com'));

    const concurrentKey = `concurrent-${crypto.randomUUID()}`;
    const concurrentPayload = [{ nome: 'Contato Concorrente', telefone: '(48) 99999-1010' }];
    const concurrent = await Promise.all([
      request({ method: 'POST', url: '/api/contatos/lote', payload: concurrentPayload, key: concurrentKey }),
      request({ method: 'POST', url: '/api/contatos/lote', payload: concurrentPayload, key: concurrentKey })
    ]);
    assert.deepEqual(concurrent.map(response => response.statusCode).sort(), [200, 201]);
    const concurrentCount = await db.select({ count: sql<number>`count(*)` }).from(schema.contatos)
      .where(eq(schema.contatos.telefone, '48999991010'));
    assert.equal(Number(concurrentCount[0].count), 1);

    const conflict = await request({
      method: 'POST', url: '/api/contatos/lote', key: contactKey,
      payload: [{ nome: 'Outro conteúdo', email: 'outro@exemplo.com' }]
    });
    assert.equal(conflict.statusCode, 409, conflict.body);
    assert.equal(conflict.json<{ code: string }>().code, 'IDEMPOTENCY_CONFLICT');

    const tooMany = await request({
      method: 'POST', url: '/api/contatos/lote', key: `limit-${crypto.randomUUID()}`,
      payload: Array.from({ length: 501 }, (_, index) => ({ nome: `Contato ${index}` }))
    });
    assert.equal(tooMany.statusCode, 400, tooMany.body);

    const nested = await request({
      method: 'POST', url: '/api/contatos/lote', key: `nested-${crypto.randomUUID()}`,
      payload: [{ nome: 'Estrutura inválida', empresa: { nome: 'Aninhada' } }]
    });
    assert.equal(nested.statusCode, 201, nested.body);
    assert.equal(nested.json<{ status: string; imported: number }>().status, 'failed');
    assert.equal(nested.json<{ imported: number }>().imported, 0);

    const auditName = `Auditoria ${crypto.randomUUID()}`;
    const originalAuditLog = auditModule.AuditLogService.log;
    auditModule.AuditLogService.log = async () => { throw new Error('falha de auditoria simulada'); };
    try {
      const auditFailure = await request({
        method: 'POST', url: '/api/contatos/lote', key: `audit-${crypto.randomUUID()}`,
        payload: [{ nome: auditName }]
      });
      assert.equal(auditFailure.statusCode, 500, auditFailure.body);
      const rolledBack = await db.select({ count: sql<number>`count(*)` }).from(schema.contatos)
        .where(eq(schema.contatos.nome, auditName));
      assert.equal(Number(rolledBack[0].count), 0);
    } finally {
      auditModule.AuditLogService.log = originalAuditLog;
    }

    const originalProcessPending = outboxModule.FileSystemOutboxService.processPending;
    outboxModule.FileSystemOutboxService.processPending = async () => { throw new Error('pasta temporariamente indisponível'); };
    try {
      const client = await request({
        method: 'POST', url: '/api/clientes/lote', key: `client-${crypto.randomUUID()}`,
        payload: [{ nome: 'Cliente Persistido', tipoPessoa: 'PJ', cnpj: '45.723.174/0001-10', telefone: '(48) 3333-4444' }]
      });
      assert.equal(client.statusCode, 201, client.body);
      const clientResult = client.json<{ imported: number; filesystemPending: boolean; status: string; results: Array<{ id?: string }> }>();
      assert.equal(clientResult.imported, 1);
      assert.equal(clientResult.filesystemPending, true);
      assert.equal(clientResult.status, 'completed_with_warnings');
      const clientId = clientResult.results[0].id;
      assert.ok(clientId);

      const duplicateProjectPayload = [
        { nome: 'Projeto Repetido', clienteReferencia: '45.723.174/0001-10' },
        { nome: '  projeto   repetido  ', clienteReferencia: '45.723.174/0001-10' }
      ];
      const projectPreview = await request({ method: 'POST', url: '/api/projetos/lote/preview', payload: duplicateProjectPayload });
      assert.equal(projectPreview.statusCode, 200, projectPreview.body);
      const projectRows = projectPreview.json<{ status: string; rows: Array<{ action: string; message: string }> }>();
      assert.equal(projectRows.status, 'blocked');
      assert.equal(projectRows.rows[1].action, 'reject');
      assert.match(projectRows.rows[1].message, /repetido/i);

      const singleProject = [{ nome: 'Projeto Cliente Ativo', clienteId: clientId! }];
      const activePreview = await request({ method: 'POST', url: '/api/projetos/lote/preview', payload: singleProject });
      assert.equal(activePreview.json<{ status: string }>().status, 'ready');
      await db.update(schema.clientes).set({ situacao: 'Inativo' }).where(eq(schema.clientes.id, clientId!));
      const inactiveResult = await request({
        method: 'POST', url: '/api/projetos/lote', payload: singleProject, key: `inactive-${crypto.randomUUID()}`
      });
      assert.equal(inactiveResult.statusCode, 201, inactiveResult.body);
      assert.equal(inactiveResult.json<{ imported: number }>().imported, 0);
      await db.update(schema.clientes).set({ situacao: 'Ativo' }).where(eq(schema.clientes.id, clientId!));
    } finally {
      outboxModule.FileSystemOutboxService.processPending = originalProcessPending;
    }

    const history = await request({ method: 'GET', url: '/api/importacoes/historico?limit=20' });
    assert.equal(history.statusCode, 200, history.body);
    const historyItems = history.json<{ items: Array<{ importId: string }> }>().items;
    assert.ok(historyItems.some(item => item.importId === firstResult.importId));
    const detail = await request({ method: 'GET', url: `/api/importacoes/${firstResult.importId}` });
    assert.equal(detail.statusCode, 200, detail.body);
    const lines = await request({ method: 'GET', url: `/api/importacoes/${firstResult.importId}/linhas` });
    assert.equal(lines.statusCode, 200, lines.body);

    const digest = runService.importContentDigest({ headers: ['Cliente'], rows: [{ Cliente: 'Teste' }] });
    const preview = await runService.registerImportPreview({
      entity: 'complete', digest, totalRows: 1, preview: { status: 'ready' }
    });
    await assert.rejects(
      () => runService.queueConfirmedPreview(preview.previewId, `${digest.slice(0, -1)}${digest.endsWith('0') ? '1' : '0'}`, {}),
      (error: unknown) => error instanceof runService.ImportRunError && error.code === 'PREVIEW_CONTENT_CHANGED'
    );
    const queued = await runService.queueConfirmedPreview(preview.previewId, digest, { safe: true });
    assert.equal(queued.status, 'queued');
    const competingDigest = `${digest}-competing`;
    const competingPreview = await runService.registerImportPreview({
      entity: 'complete', digest: competingDigest, totalRows: 1, preview: { status: 'ready' }
    });
    await assert.rejects(
      () => runService.queueConfirmedPreview(competingPreview.previewId, competingDigest, {}),
      (error: unknown) => error instanceof runService.ImportRunError && error.code === 'HEAVY_IMPORT_IN_PROGRESS'
    );
    await assert.rejects(
      () => runService.queueConfirmedPreview(preview.previewId, digest, {}),
      (error: unknown) => error instanceof runService.ImportRunError && error.code === 'PREVIEW_ALREADY_USED'
    );
    await runService.failImportRun(preview.previewId, new Error('encerramento controlado do teste de uso único'));
    await runService.failImportRun(competingPreview.previewId, new Error('encerramento controlado da prévia concorrente'));

    const expired = await runService.registerImportPreview({
      entity: 'complete', digest: `${digest}-expired`, totalRows: 1, ttlMs: -1, preview: { status: 'ready' }
    });
    await assert.rejects(
      () => runService.queueConfirmedPreview(expired.previewId, `${digest}-expired`, {}),
      (error: unknown) => error instanceof runService.ImportRunError && error.code === 'PREVIEW_EXPIRED'
    );

    const interruptedId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.run(sql`INSERT INTO import_runs (id, entity, import_type, status, stage, progress, request_digest, created_at, started_at, updated_at)
      VALUES (${interruptedId}, 'contatos', 'simple', 'processing', 'Gravando dados', 50, 'interrupted-test', ${now}, ${now}, ${now})`);
    await runService.recoverInterruptedImportRuns();
    assert.equal((await runService.getImportRun(interruptedId))?.status, 'failed');

    const fullPayload = {
      fileName: 'importacao-assincrona.xlsx',
      fileHash: crypto.createHash('sha256').update('importacao-assincrona').digest('hex'),
      headers: ['Cliente', 'CNPJ', 'Telefone', 'Projeto'],
      rows: [{
        Cliente: 'Cliente Assíncrono',
        CNPJ: '11.222.333/0001-81',
        Telefone: '(48) 3333-5555',
        Projeto: 'Projeto Assíncrono'
      }]
    };
    const fullPreviewResponse = await request({
      method: 'POST', url: '/api/importacoes/migracao-completa/preview', payload: fullPayload
    });
    assert.equal(fullPreviewResponse.statusCode, 200, fullPreviewResponse.body);
    const fullPreview = fullPreviewResponse.json<{ previewId: string; status: string }>();
    assert.equal(fullPreview.status, 'ready', fullPreviewResponse.body);
    const confirmation = await request({
      method: 'POST', url: '/api/importacoes/migracao-completa/confirmar',
      payload: { ...fullPayload, previewId: fullPreview.previewId }
    });
    assert.equal(confirmation.statusCode, 202, confirmation.body);
    const queuedFull = confirmation.json<{ importId: string; pollUrl: string }>();
    let terminal: { status: string; progress: number; result?: unknown } | null = null;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const statusResponse = await request({ method: 'GET', url: queuedFull.pollUrl });
      assert.equal(statusResponse.statusCode, 200, statusResponse.body);
      const status = statusResponse.json<{ status: string; progress: number; result?: unknown }>();
      if (['completed', 'partial', 'completed_with_warnings', 'failed'].includes(status.status)) {
        terminal = status;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.ok(terminal, 'A importação assíncrona não alcançou estado terminal.');
    assert.notEqual(terminal.status, 'failed');
    assert.equal(terminal.progress, 100);
    assert.ok(terminal.result);

    const performanceStarted = performance.now();
    const representative = await request({
      method: 'POST', url: '/api/contatos/lote', key: `volume-${crypto.randomUUID()}`,
      payload: Array.from({ length: 500 }, (_, index) => ({ nome: `Contato de volume ${index + 1}` }))
    });
    assert.equal(representative.statusCode, 201, representative.body);
    assert.equal(representative.json<{ imported: number }>().imported, 500);
    assert.ok(performance.now() - performanceStarted < 10_000, 'O lote representativo excedeu 10 segundos.');
  } finally {
    await server.close();
    closeDb();
    await new Promise(resolve => setTimeout(resolve, 100));
    await removeDatabase().catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
    });
  }
});
