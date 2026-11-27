import { injectWithRecordVersion } from './test-support/record-request';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `shared-records-${process.pid}`);
const databasePath = path.join(testRoot, 'shared-records.integration.test.db');
const databaseFiles = [databasePath, `${databasePath}-shm`, `${databasePath}-wal`];
const headers = { 'content-type': 'application/json', 'x-api-token': 'test-token' };

process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';
process.env.NODE_ENV = 'test';

test('cliente e projeto apresentam os mesmos registros sem duplicar tarefas ou despesas', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await Promise.allSettled(databaseFiles.map((file) => fs.rm(file, { force: true })));

  const [{ server }, { db, dbReady, closeDb }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);
  const request = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: Record<string, unknown>) => injectWithRecordVersion(server, {
    method,
    url,
    headers: payload === undefined ? { 'x-api-token': 'test-token' } : headers,
    ...(payload === undefined ? {} : { payload })
  });

  try {
    await dbReady;
    await runRuntimeMigrations();
    const setupResponse = await request('POST', '/api/configuracoes', {
      empresaNome: 'Empresa sintética',
      dadosPasta: testRoot,
      adminNome: 'Pessoa administradora',
      adminEmail: 'shared-records@example.test',
      adminSenha: 'senha-segura-123'
    });
    assert.equal(setupResponse.statusCode, 200, setupResponse.body);
    const clientId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const otherProjectId = crypto.randomUUID();
    await db.insert(schema.clientes).values({ id: clientId, nome: 'Cliente compartilhado', situacao: 'Ativo' });
    await db.insert(schema.projetos).values([
      { id: projectId, clienteId: clientId, nome: 'Projeto principal' },
      { id: otherProjectId, clienteId: clientId, nome: 'Projeto secundário' }
    ]);

    const clientDocumentsDirectory = path.join(testRoot, 'Clientes', 'Cliente compartilhado', 'Documentos');
    const projectDocumentsDirectory = path.join(testRoot, 'Clientes', 'Cliente compartilhado', 'Projeto principal', 'Mapas');
    await fs.mkdir(clientDocumentsDirectory, { recursive: true });
    await fs.mkdir(projectDocumentsDirectory, { recursive: true });
    await fs.writeFile(path.join(clientDocumentsDirectory, 'documento-geral.pdf'), 'documento geral sintético');
    await fs.writeFile(path.join(projectDocumentsDirectory, 'mapa-projeto.pdf'), 'documento de projeto sintético');

    const consolidatedDocuments = await request('GET', `/api/arquivos/cliente/${clientId}?scope=all`);
    assert.equal(consolidatedDocuments.statusCode, 200, consolidatedDocuments.body);
    const sharedFiles = consolidatedDocuments.json<{
      files: Array<{ documentId: string; originType: string; projetoId: string | null }>;
    }>().files;
    assert.equal(sharedFiles.length, 2);
    assert.equal(sharedFiles.filter((file) => file.originType === 'client' && file.projetoId === null).length, 1);
    assert.equal(sharedFiles.filter((file) => file.originType === 'project' && file.projetoId === projectId).length, 1);
    assert.equal(new Set(sharedFiles.map((file) => file.documentId)).size, 2);
    const documentRows = await db.select().from(schema.documentos);
    assert.equal(documentRows.length, 2);

    const projectTaskResponse = await request('POST', '/api/tarefas', {
      projetoId: projectId,
      titulo: 'Conferir memorial compartilhado'
    });
    assert.equal(projectTaskResponse.statusCode, 200, projectTaskResponse.body);
    const projectTaskId = projectTaskResponse.json<{ id: string }>().id;

    const projectTasks = await request('GET', `/api/tarefas?projetoId=${projectId}`);
    const clientTasks = await request('GET', `/api/tarefas?clienteId=${clientId}`);
    assert.deepEqual(projectTasks.json<Array<{ id: string }>>().map((item) => item.id), [projectTaskId]);
    assert.equal(clientTasks.json<Array<{ id: string }>>().filter((item) => item.id === projectTaskId).length, 1);

    const generalTaskResponse = await request('POST', '/api/tarefas', {
      clienteId: clientId,
      titulo: 'Telefonar para o cliente'
    });
    const generalTaskId = generalTaskResponse.json<{ id: string }>().id;
    const projectTasksAfterGeneral = await request('GET', `/api/tarefas?projetoId=${projectId}`);
    assert.equal(projectTasksAfterGeneral.json<Array<{ id: string }>>().some((item) => item.id === generalTaskId), false);

    const linkedFromClientResponse = await request('POST', '/api/tarefas', {
      clienteId: clientId,
      projetoId: otherProjectId,
      titulo: 'Tarefa criada no cliente para o projeto'
    });
    const linkedTaskId = linkedFromClientResponse.json<{ id: string }>().id;
    const editResponse = await request('PATCH', `/api/tarefas/${linkedTaskId}`, { titulo: 'Tarefa editada uma única vez' });
    assert.equal(editResponse.statusCode, 200, editResponse.body);
    const linkedProjectTasks = await request('GET', `/api/tarefas?projetoId=${otherProjectId}`);
    const editedTask = linkedProjectTasks.json<Array<{ id: string; titulo: string }>>().find((item) => item.id === linkedTaskId);
    assert.equal(editedTask?.titulo, 'Tarefa editada uma única vez');

    const firstTemplate = await request('POST', '/api/tarefas/aplicar-modelo', {
      projetoId: projectId,
      modelo: 'levantamento_topografico'
    });
    const secondTemplate = await request('POST', '/api/tarefas/aplicar-modelo', {
      projetoId: projectId,
      modelo: 'levantamento_topografico'
    });
    assert.equal(firstTemplate.statusCode, 200, firstTemplate.body);
    assert.ok(firstTemplate.json<{ criadas: number }>().criadas > 0);
    assert.equal(secondTemplate.json<{ criadas: number }>().criadas, 0);

    const customModel = await request('POST', '/api/tarefas/modelos', {
      nome: 'Conferência sintética',
      descricao: 'Modelo criado somente no banco temporário do teste.',
      tipoProjeto: 'Topografia',
      ativo: true,
      etapas: [
        { titulo: 'Conferir matrícula', prioridade: 'Alta' },
        { titulo: 'Emitir relatório final', prioridade: 'Média' }
      ]
    });
    assert.equal(customModel.statusCode, 200, customModel.body);
    const customModelId = customModel.json<{ id: string }>().id;
    await request('POST', '/api/tarefas', { projetoId: otherProjectId, titulo: '  Conferir   matricula ' });
    const appliedCustomModel = await request('POST', `/api/tarefas/modelos/${customModelId}/aplicar`, { projetoId: otherProjectId });
    assert.equal(appliedCustomModel.statusCode, 200, appliedCustomModel.body);
    assert.equal(appliedCustomModel.json<{ criadas: number }>().criadas, 1);
    assert.equal(appliedCustomModel.json<{ ignoradas: number }>().ignoradas, 1);

    const expenseResponse = await request('POST', '/api/financeiro/despesas', {
      projetoId: projectId,
      descricao: 'Combustível de campo',
      valor: 180,
      data: '2026-09-05',
      categoria: 'Combustível',
      subcategoria: 'Diesel',
      status: 'Pendente',
      formaPagamento: 'Pix'
    });
    assert.equal(expenseResponse.statusCode, 200, expenseResponse.body);
    const expenseId = expenseResponse.json<{ id: string; status: string }>().id;
    assert.equal(expenseResponse.json<{ status: string }>().status, 'Pendente');
    const projectExpenses = await request('GET', `/api/financeiro/despesas?projetoId=${projectId}`);
    const globalExpense = await request('GET', `/api/financeiro/despesas?selectedId=${expenseId}`);
    assert.equal(projectExpenses.json<Array<{ id: string }>>().filter((item) => item.id === expenseId).length, 1);
    assert.equal(globalExpense.json<Array<{ id: string }>>()[0]?.id, expenseId);
    assert.equal(globalExpense.json<Array<{ subcategoria: string }>>()[0]?.subcategoria, 'Diesel');
    const subcategoryExpenses = await request('GET', '/api/financeiro/despesas?subcategoria=Diesel');
    assert.deepEqual(subcategoryExpenses.json<Array<{ id: string }>>().map((item) => item.id), [expenseId]);

    const [taskCount] = await db.select().from(schema.tarefas);
    assert.ok(taskCount);
    const expenseRows = await db.select().from(schema.despesas);
    assert.equal(expenseRows.filter((item) => item.id === expenseId).length, 1);

    const budgetId = crypto.randomUUID();
    await db.insert(schema.orcamentos).values({
      id: budgetId,
      clienteId: clientId,
      projetoId: projectId,
      descricao: 'Orçamento sintético aprovado',
      valorTotal: 50_000,
      status: 'aprovado'
    });
    const firstInstallment = await request('POST', '/api/financeiro/parcelas', {
      orcamentoId: budgetId,
      valor: 25_000,
      dataVencimento: '2026-10-10'
    });
    assert.equal(firstInstallment.statusCode, 200, firstInstallment.body);
    const duplicateInstallment = await request('POST', '/api/financeiro/parcelas', {
      orcamentoId: budgetId,
      valor: 25_000,
      dataVencimento: '2026-10-10'
    });
    assert.equal(duplicateInstallment.statusCode, 409, duplicateInstallment.body);

    const contextResponse = await request('GET', `/api/projetos/${projectId}/contexto-financeiro`);
    assert.equal(contextResponse.statusCode, 200, contextResponse.body);
    assert.equal(contextResponse.json<{ parcelasConfiguradas: number }>().parcelasConfiguradas, 1);
  } finally {
    await server.close();
    await closeDb();
    await Promise.allSettled(databaseFiles.map((file) => fs.rm(file, { force: true })));
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }).catch(() => undefined);
  }
});
