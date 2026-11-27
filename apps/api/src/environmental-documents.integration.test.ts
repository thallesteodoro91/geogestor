import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq, sql } from 'drizzle-orm';
const root = path.resolve('scratch', 'environmental-documents-' + crypto.randomUUID());
process.env.GEOGESTOR_DB_PATH = path.join(root, 'test.db');
process.env.GEOGESTOR_API_TOKEN = 'test-token';
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';
test('emissões locais são atômicas, imutáveis, revisáveis e recuperáveis sem reconstruir PDFs', async t => {
  await fs.mkdir(root, { recursive: true });
  const [{ server }, { db, dbReady, closeDb }, { runRuntimeMigrations }, { schema, databaseClientConfig }, { createClient }] = await Promise.all([
    import('./server'), import('./db'), import('./services/runtime-migrations.service'), import('@geogestor/database'), import('@libsql/client')
  ]);
  const clientId = crypto.randomUUID(), projectId = crypto.randomUUID();
  const options = { projetoNome: 'CAR fictício', clienteNome: 'Cliente fictício', tipoLaudo: 'acompanhamento', tipoDemanda: 'CAR', dataVistoria: '2026-10-12', tecnicoResponsavel: 'Responsável fictício', observacoes: 'EXEMPLO FICTÍCIO — Registro inicial.', sintese: 'EXEMPLO FICTÍCIO — Síntese revisada.' };
  const endpoint = '/api/ambiental/' + projectId + '/documentos';
  const request = (method: 'GET' | 'POST', url: string, payload?: object) => server.inject({ method, url, payload, headers: { 'x-api-token': 'test-token' } });
  let issue: { id: string; codigo: string; revisao: number; sha256: string };
  let original: { pdfBase64: string; snapshot: { options: typeof options; company: { razao: string } } };
  try {
    await dbReady; await runRuntimeMigrations();
    await db.insert(schema.clientes).values({ id: clientId, nome: 'Cliente fictício' });
    await db.insert(schema.projetos).values({ id: projectId, clienteId: clientId, nome: 'CAR fictício', tipo: 'Ambiental', status: 'Concluído' });
    await db.insert(schema.configuracoesOperacionais).values({ id: crypto.randomUUID(), chave: 'geogestor_empresa_template', valorJson: JSON.stringify({ razao: 'Empresa fictícia A', email: 'contato@example.invalid' }) });
    await t.test('migra cópia da versão 18 preservando projeto e aplica versão 19 apenas uma vez', async () => {
      await db.run(sql`DROP TABLE ambiental_documentos_emitidos`);
      await db.run(sql`DELETE FROM schema_migrations WHERE version = 19`); await db.run(sql`PRAGMA user_version = 18`);
      const migrated = await runRuntimeMigrations(); assert.equal(migrated.schemaVersion, 19);
      assert.equal((await db.select().from(schema.projetos).where(eq(schema.projetos.id, projectId)))[0].nome, 'CAR fictício');
      assert.equal((await runRuntimeMigrations()).fastPath, true);
    });
    await t.test('prévia não cria registro e emissão repetida retorna uma única versão', async () => {
      const preview = await request('POST', endpoint + '/previa', { options }); assert.equal(preview.statusCode, 200, preview.body);
      assert.equal((await request('GET', endpoint)).json().length, 0);
      const payload = { options, previewHash: preview.json().previewHash, requestId: crypto.randomUUID() };
      const responses = await Promise.all([request('POST', endpoint + '/emitir', payload), request('POST', endpoint + '/emitir', payload)]);
      responses.forEach(response => assert.equal(response.statusCode, 201, response.body));
      issue = responses[0].json(); assert.equal(issue.revisao, 1); assert.deepEqual(responses[1].json(), issue);
      original = (await request('GET', endpoint + '/' + issue.id)).json();
      assert.equal(crypto.createHash('sha256').update(Buffer.from(original.pdfBase64, 'base64')).digest('hex'), issue.sha256);
      assert.equal(original.snapshot.company.razao, 'Empresa fictícia A');
      assert.equal((await request('GET', endpoint)).json().length, 1);
      const reused = await request('POST', endpoint + '/emitir', { ...payload, options: { ...options, observacoes: 'Outro conteúdo' } }); assert.equal(reused.statusCode, 409);
    });
    await t.test('projeto e empresa atualizados não alteram a emissão anterior; revisão mantém série', async () => {
      await db.update(schema.projetos).set({ nome: 'Nome atualizado' }).where(eq(schema.projetos.id, projectId));
      await db.update(schema.configuracoesOperacionais).set({ valorJson: JSON.stringify({ razao: 'Empresa fictícia B' }) }).where(eq(schema.configuracoesOperacionais.chave, 'geogestor_empresa_template'));
      assert.deepEqual((await request('GET', endpoint + '/' + issue.id)).json().snapshot, original.snapshot);
      assert.equal((await request('GET', endpoint + '/' + issue.id)).json().pdfBase64, original.pdfBase64);
      const revisedOptions = { ...options, observacoes: 'EXEMPLO FICTÍCIO — Nova revisão.' };
      const preview = await request('POST', endpoint + '/previa', { options: revisedOptions });
      const revised = await request('POST', endpoint + '/emitir', { options: revisedOptions, previewHash: preview.json().previewHash, requestId: crypto.randomUUID(), revisionOf: issue.id });
      assert.equal(revised.statusCode, 201, revised.body); assert.equal(revised.json().revisao, 2); assert.equal(revised.json().codigo, issue.codigo);
      assert.equal((await request('GET', endpoint + '/' + issue.id)).json().pdfBase64, original.pdfBase64);
      await assert.rejects(() => db.run(sql`UPDATE ambiental_documentos_emitidos SET nome_arquivo = 'alterado.pdf' WHERE id = ${issue.id}`));
    });
    await t.test('falha de armazenamento não deixa emissão parcial e permite repetir a tentativa', async () => {
      const preview = await request('POST', endpoint + '/previa', { options });
      const payload = { options, previewHash: preview.json().previewHash, requestId: crypto.randomUUID(), revisionOf: issue.id };
      await db.run(sql`CREATE TRIGGER fail_document_issue BEFORE INSERT ON ambiental_documentos_emitidos BEGIN SELECT RAISE(ABORT, 'synthetic-storage-failure'); END`);
      assert.equal((await request('POST', endpoint + '/emitir', payload)).statusCode, 500);
      assert.equal((await request('GET', endpoint)).json().length, 2);
      await db.run(sql`DROP TRIGGER fail_document_issue`);
      const saved = await request('POST', endpoint + '/emitir', payload); assert.equal(saved.statusCode, 201, saved.body); assert.equal(saved.json().revisao, 3);
    });
    await t.test('dados de empresa alterados exigem nova prévia e demandas diferentes não acessam emissão', async () => {
      const preview = await request('POST', endpoint + '/previa', { options });
      await db.update(schema.configuracoesOperacionais).set({ valorJson: '{}' }).where(eq(schema.configuracoesOperacionais.chave, 'geogestor_empresa_template'));
      assert.equal((await request('POST', endpoint + '/emitir', { options, previewHash: preview.json().previewHash, requestId: crypto.randomUUID() })).statusCode, 409);
      assert.equal((await request('GET', '/api/ambiental/' + crypto.randomUUID() + '/documentos/' + issue.id)).statusCode, 404);
    });
    await t.test('empresa com logo incorporado e cadastro incompleto produz prévia local', async () => {
      const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNg87MGAADtAJA6UTl/AAAAAElFTkSuQmCC';
      await db.update(schema.configuracoesOperacionais).set({ valorJson: JSON.stringify({ razao: 'Empresa fictícia com logo', logo }) }).where(eq(schema.configuracoesOperacionais.chave, 'geogestor_empresa_template'));
      const withLogo = await request('POST', endpoint + '/previa', { options }); assert.equal(withLogo.statusCode, 200, withLogo.body);
      await db.update(schema.configuracoesOperacionais).set({ valorJson: '{}' }).where(eq(schema.configuracoesOperacionais.chave, 'geogestor_empresa_template'));
      const emptyCompany = await request('POST', endpoint + '/previa', { options: { ...options, sintese: '' } }); assert.equal(emptyCompany.statusCode, 200, emptyCompany.body);
    });
    await t.test('backup e restauração em cópia isolada preservam PDF e dados da emissão', async () => {
      const { BackupService } = await import('./services/backup.service');
      const filesRoot = path.join(root, 'files'); await fs.mkdir(filesRoot, { recursive: true });
      await db.update(schema.configuracoes).set({ dadosPasta: filesRoot });
      const destination = path.join(root, 'backups');
      const backup = await BackupService.createLocalBackup({ destinationDirectory: destination });
      const target = path.join(root, 'restored', 'copy.db');
      await BackupService.restoreBackup({ bundlePath: backup.bundlePath, targetDatabasePath: target, targetFilesRoot: path.join(root, 'restored', 'files'), confirmation: 'RESTORE_GEOGESTOR', allowedBackupDirectory: BackupService.getBackupDirectory(destination), historyType: 'restore_test', skipHistory: true });
      const copy = createClient(databaseClientConfig(target));
      try {
        const row = (await copy.execute({ sql: 'SELECT pdf_base64, snapshot_json FROM ambiental_documentos_emitidos WHERE id=?', args: [issue.id] })).rows[0];
        assert.equal(row.pdf_base64, original.pdfBase64); assert.deepEqual(JSON.parse(String(row.snapshot_json)), original.snapshot);
      } finally { copy.close(); }
    });
    const reopened = createClient(databaseClientConfig(process.env.GEOGESTOR_DB_PATH!));
    try {
      const rows = await reopened.execute({ sql: 'SELECT pdf_base64, snapshot_json FROM ambiental_documentos_emitidos WHERE id=?', args: [issue!.id] });
      assert.equal(rows.rows[0].pdf_base64, original!.pdfBase64); assert.deepEqual(JSON.parse(String(rows.rows[0].snapshot_json)), original!.snapshot);
    } finally { reopened.close(); }
  } finally { await server.close().catch(() => {}); closeDb(); }
});
