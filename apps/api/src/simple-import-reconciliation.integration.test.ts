import { injectWithRecordVersion } from './test-support/record-request';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { eq } from 'drizzle-orm';

const root = path.resolve(process.cwd(), 'scratch', `simple-import-reconciliation-${process.pid}`);
const dbPath = path.join(root, 'geogestor.db');
const documents = path.join(root, 'documents');
const scratch = path.resolve(process.cwd(), 'scratch');
if (!root.startsWith(`${scratch}${path.sep}`)) throw new Error('Raiz de teste fora de scratch.');
process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'simple-import-reconciliation-token';
process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';

const headers = { 'content-type': 'application/json', 'x-api-token': 'simple-import-reconciliation-token' };
type Result = { importId: string; status: string; rowsRead: number; imported: number; updated: number; failed: number; results: Array<{ row: number; status: string; id?: string }> };

test('Clientes, Contatos e Projetos reconciliam linhas válidas, duplicadas e inválidas sem atualizar registros', async () => {
  await fs.mkdir(documents, { recursive: true });
  const [{ db, dbReady, closeDb }, { schema }, { runRuntimeMigrations }, { server }] = await Promise.all([
    import('./db'), import('@geogestor/database'), import('./services/runtime-migrations.service'), import('./server')
  ]);
  const fixtures: Array<{ key: string; sha256: string; bytes: number }> = [];
  const send = (url: string, rows: unknown[], key: string) => {
    const payload = { rows, sourceRowNumbers: rows.map((_, index) => index + 2) };
    const bytes = Buffer.from(JSON.stringify(payload));
    fixtures.push({ key, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
    return injectWithRecordVersion(server, {
      method: 'POST', url, headers: { ...headers, 'idempotency-key': `simple-recon-${key}` }, payload
    });
  };
  try {
    await dbReady;
    await runRuntimeMigrations();
    await db.insert(schema.configuracoes).values({
      id: crypto.randomUUID(), empresaNome: 'QA Import', dadosPasta: documents,
      adminNome: 'QA', adminEmail: 'qa@example.test', adminSenhaHash: 'scrypt:test:test', setupConcluido: true
    });

    const clientsResponse = await send('/api/clientes/lote', [
      { nome: 'QA-LINHA-Cliente 1', tipoPessoa: 'PF', cpf: '390.533.447-05', telefone: '48988887777' },
      { nome: 'QA-LINHA-Duplicado', tipoPessoa: 'PF', cpf: '390.533.447-05', telefone: '48988887778' },
      { nome: 'QA-LINHA-Inválido', tipoPessoa: 'PF', cpf: '123', telefone: '48988887779' },
      { nome: 'QA-LINHA-Cliente 2', tipoPessoa: 'PF', cpf: '111.444.777-35', telefone: '48988887780' }
    ], 'qa-clients');
    assert.equal(clientsResponse.statusCode, 201, clientsResponse.body);
    const clients = clientsResponse.json<Result>();
    assert.deepEqual([clients.status, clients.rowsRead, clients.imported, clients.updated, clients.failed], ['partial', 4, 2, 0, 2]);
    assert.deepEqual(clients.results.map(row => [row.row, row.status]), [[2, 'success'], [3, 'failed'], [4, 'failed'], [5, 'success']]);
    const clientOneId = clients.results[0].id;
    assert.ok(clientOneId);
    const existingClient = await send('/api/clientes/lote', [
      { nome: 'QA-LINHA-Tentativa de atualização', tipoPessoa: 'PF', cpf: '390.533.447-05', telefone: '48988887781' }
    ], 'qa-client-existing');
    assert.equal(existingClient.statusCode, 201, existingClient.body);
    assert.deepEqual([existingClient.json<Result>().status, existingClient.json<Result>().updated, existingClient.json<Result>().failed], ['failed', 0, 1]);

    const contactsResponse = await send('/api/contatos/lote', [
      { nome: 'QA-LINHA-Contato 1', email: 'contato1@example.test' },
      { nome: 'QA-LINHA-Duplicado', email: 'contato1@example.test' },
      { nome: '', email: 'invalido' },
      { nome: 'QA-LINHA-Contato 2', email: 'contato2@example.test' }
    ], 'qa-contacts');
    assert.equal(contactsResponse.statusCode, 201, contactsResponse.body);
    const contacts = contactsResponse.json<Result>();
    assert.deepEqual([contacts.status, contacts.rowsRead, contacts.imported, contacts.updated, contacts.failed], ['partial', 4, 2, 0, 2]);
    assert.deepEqual(contacts.results.map(row => [row.row, row.status]), [[2, 'success'], [3, 'failed'], [4, 'failed'], [5, 'success']]);
    const existingContact = await send('/api/contatos/lote', [{ nome: 'QA-LINHA-Tentativa de atualização', email: 'contato1@example.test' }], 'qa-contact-existing');
    assert.equal(existingContact.statusCode, 201, existingContact.body);
    assert.deepEqual([existingContact.json<Result>().status, existingContact.json<Result>().updated, existingContact.json<Result>().failed], ['failed', 0, 1]);

    const projectsResponse = await send('/api/projetos/lote', [
      { nome: 'QA-LINHA-Projeto 1', clienteReferencia: 'QA-LINHA-Cliente 1' },
      { nome: 'QA-LINHA-Projeto 1', clienteReferencia: 'QA-LINHA-Cliente 1' },
      { nome: 'QA-LINHA-Sem cliente', clienteReferencia: 'QA-LINHA-Inexistente' },
      { nome: '', clienteReferencia: 'QA-LINHA-Cliente 1' }
    ], 'qa-projects');
    assert.equal(projectsResponse.statusCode, 201, projectsResponse.body);
    const projects = projectsResponse.json<Result>();
    assert.deepEqual([projects.status, projects.rowsRead, projects.imported, projects.updated, projects.failed], ['partial', 4, 1, 0, 3]);
    assert.deepEqual(projects.results.map(row => [row.row, row.status]), [[2, 'success'], [3, 'failed'], [4, 'failed'], [5, 'failed']]);
    const project = (await db.select().from(schema.projetos).where(eq(schema.projetos.id, projects.results[0].id!)))[0];
    assert.equal(project.clienteId, clientOneId);
    const existingProject = await send('/api/projetos/lote', [{ nome: 'QA-LINHA-Projeto 1', clienteReferencia: 'QA-LINHA-Cliente 1' }], 'qa-project-existing');
    assert.equal(existingProject.statusCode, 201, existingProject.body);
    assert.deepEqual([existingProject.json<Result>().status, existingProject.json<Result>().updated, existingProject.json<Result>().failed], ['failed', 0, 1]);

    for (const result of [clients, contacts, projects]) {
      const rows = await db.select().from(schema.importRows).where(eq(schema.importRows.importId, result.importId));
      assert.equal(rows.length, result.rowsRead);
      assert.deepEqual(rows.map(row => [row.rowNumber, row.status]), result.results.map(row => [row.row, row.status]));
      assert.deepEqual(rows.map(row => row.recordId ?? null), result.results.map(row => row.id ?? null));
      const history = await injectWithRecordVersion(server, { method: 'GET', url: `/api/importacoes/${result.importId}/linhas`, headers });
      assert.equal(history.statusCode, 200, history.body);
      assert.equal(history.json<{ items: unknown[] }>().items.length, result.rowsRead);
    }
    assert.equal((await db.select().from(schema.clientes).where(eq(schema.clientes.nome, 'QA-LINHA-Tentativa de atualização'))).length, 0);
    assert.equal((await db.select().from(schema.contatos).where(eq(schema.contatos.nome, 'QA-LINHA-Tentativa de atualização'))).length, 0);
    assert.equal((await db.select().from(schema.projetos).where(eq(schema.projetos.nome, 'QA-LINHA-Sem cliente'))).length, 0);
    const operations = await db.select().from(schema.filesystemOperations);
    assert.equal(operations.filter(row => row.aggregateType === 'client').length, 2);
    assert.equal(operations.filter(row => row.aggregateType === 'project').length, 1);
    const audits = await db.select().from(schema.auditLogs);
    assert.ok(audits.some(row => row.entity === 'Cliente' && row.action === 'INSERT'));
    assert.ok(audits.some(row => row.entity === 'Contato' && row.action === 'INSERT'));
    assert.ok(audits.some(row => row.entity === 'Projeto' && row.action === 'INSERT'));
    console.log('[QA-IMPORT-LINHAS]', JSON.stringify({ fixtures, clients: clients.importId, contacts: contacts.importId, projects: projects.importId, imported: [2, 2, 1], failed: [2, 2, 3], updated: [0, 0, 0], filesystemOperations: operations.length }));
  } finally {
    await server.close();
    closeDb();
    await new Promise(resolve => setTimeout(resolve, 100));
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
