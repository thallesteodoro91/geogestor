import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `session15-global-search-${process.pid}`);
const dbPath = path.join(testRoot, 'session15-global-search.integration.test.db');
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

async function removeTestDatabase() {
  await Promise.allSettled(dbFiles.map((file) => fs.rm(file, { force: true })));
}

test('pesquisa global exclui registros removidos, preserva seis destinos e aplica limites determinísticos', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  const search = async (query: string) => {
    const response = await server.inject({
      method: 'GET',
      url: `/api/search?q=${encodeURIComponent(query)}`,
      headers: { 'x-api-token': 'test-token' }
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json<{ results: Array<{ id: string; type: string; title: string; path: string }> }>().results;
  };

  try {
    await dbReady;
    await runRuntimeMigrations();

    const deletedAt = '2026-09-18T12:00:00.000Z';
    const activeClientId = crypto.randomUUID();
    const deletedClientId = crypto.randomUUID();
    const activeProjectId = crypto.randomUUID();
    const deletedProjectId = crypto.randomUUID();
    const activeBudgetId = crypto.randomUUID();
    const deletedBudgetId = crypto.randomUUID();
    const activeTaskId = crypto.randomUUID();
    const deletedTaskId = crypto.randomUUID();
    const activeAppointmentId = crypto.randomUUID();
    const deletedAppointmentId = crypto.randomUUID();
    const activeDocumentId = crypto.randomUUID();
    const deletedDocumentId = crypto.randomUUID();

    await db.insert(schema.clientes).values([
      { id: activeClientId, nome: 'QA-AUDIT-S15 Sintético Cliente' },
      { id: deletedClientId, nome: 'QA-AUDIT-S15 Sintético Cliente removido', deletedAt }
    ]);
    await db.insert(schema.projetos).values([
      { id: activeProjectId, clienteId: activeClientId, nome: 'QA-AUDIT-S15 Sintético Projeto' },
      { id: deletedProjectId, clienteId: activeClientId, nome: 'QA-AUDIT-S15 Sintético Projeto removido', deletedAt }
    ]);
    await db.insert(schema.orcamentos).values([
      { id: activeBudgetId, clienteId: activeClientId, projetoId: activeProjectId, descricao: 'QA-AUDIT-S15 Sintético Orçamento', valorTotal: 100 },
      { id: deletedBudgetId, clienteId: activeClientId, projetoId: activeProjectId, descricao: 'QA-AUDIT-S15 Sintético Orçamento removido', valorTotal: 100, deletedAt }
    ]);
    await db.insert(schema.tarefas).values([
      { id: activeTaskId, clienteId: activeClientId, projetoId: activeProjectId, titulo: 'QA-AUDIT-S15 Sintético Tarefa' },
      { id: deletedTaskId, clienteId: activeClientId, projetoId: activeProjectId, titulo: 'QA-AUDIT-S15 Sintético Tarefa removida', deletedAt }
    ]);
    await db.insert(schema.compromissos).values([
      { id: activeAppointmentId, clienteId: activeClientId, projetoId: activeProjectId, titulo: 'QA-AUDIT-S15 Sintético Agenda', data: '2026-09-18' },
      { id: deletedAppointmentId, clienteId: activeClientId, projetoId: activeProjectId, titulo: 'QA-AUDIT-S15 Sintético Agenda removida', data: '2026-09-18', deletedAt }
    ]);
    await db.insert(schema.documentos).values([
      { id: activeDocumentId, clienteId: activeClientId, projetoId: activeProjectId, nome: 'qa-s15-sintetico.pdf', nomeOriginal: 'QA-AUDIT-S15 Sintético Documento.pdf', extensao: '.pdf', caminho: 'qa/ativo.pdf' },
      { id: deletedDocumentId, clienteId: activeClientId, projetoId: activeProjectId, nome: 'qa-s15-sintetico-removido.pdf', nomeOriginal: 'QA-AUDIT-S15 Sintético Documento removido.pdf', extensao: '.pdf', caminho: 'qa/removido.pdf', deletedAt }
    ]);

    assert.deepEqual(await search('x'), []);
    const activeResults = await search('sintetico');
    assert.equal(activeResults.length, 6);
    assert.deepEqual(activeResults.map((result) => result.type), ['Cliente', 'Projeto', 'Orçamento', 'Tarefa', 'Agenda', 'Documento']);
    assert.deepEqual(new Set(activeResults.map((result) => result.id)), new Set([
      activeClientId,
      activeProjectId,
      activeBudgetId,
      activeTaskId,
      activeAppointmentId,
      activeDocumentId
    ]));
    const deletedIds: string[] = [
      deletedClientId,
      deletedProjectId,
      deletedBudgetId,
      deletedTaskId,
      deletedAppointmentId,
      deletedDocumentId
    ];
    assert.equal(activeResults.some((result) => deletedIds.includes(result.id)), false);
    assert.deepEqual(activeResults.map((result) => result.path), [
      `/clientes/${activeClientId}`,
      `/projetos/${activeProjectId}`,
      `/clientes/${activeClientId}?tab=orcamentos&orcamentoId=${activeBudgetId}`,
      `/tarefas?tarefaId=${activeTaskId}`,
      `/calendario/compromisso/${activeAppointmentId}`,
      `/clientes/${activeClientId}?tab=arquivos&documentId=${activeDocumentId}&arquivo=QA-AUDIT-S15+Sint%C3%A9tico+Documento.pdf`
    ]);

    const volumeClients = Array.from({ length: 9 }, (_, index) => ({
      id: crypto.randomUUID(),
      nome: `QA-AUDIT-S15 Volume Cliente ${String(index).padStart(2, '0')}`
    }));
    await db.insert(schema.clientes).values(volumeClients);
    const volumeProjects = Array.from({ length: 9 }, (_, index) => ({
      id: crypto.randomUUID(),
      clienteId: activeClientId,
      nome: `QA-AUDIT-S15 Volume Projeto ${String(index).padStart(2, '0')}`
    }));
    await db.insert(schema.projetos).values(volumeProjects);
    const volumeBudgets = Array.from({ length: 9 }, (_, index) => ({
      id: crypto.randomUUID(),
      clienteId: activeClientId,
      projetoId: activeProjectId,
      descricao: `QA-AUDIT-S15 Volume Orçamento ${String(index).padStart(2, '0')}`,
      valorTotal: 100 + index
    }));
    await db.insert(schema.orcamentos).values(volumeBudgets);
    const volumeTasks = Array.from({ length: 9 }, (_, index) => ({
      id: crypto.randomUUID(),
      clienteId: activeClientId,
      projetoId: activeProjectId,
      titulo: `QA-AUDIT-S15 Volume Tarefa ${String(index).padStart(2, '0')}`
    }));
    await db.insert(schema.tarefas).values(volumeTasks);

    const volumeResults = await search('volume');
    assert.equal(volumeResults.length, 30);
    assert.deepEqual(
      volumeResults.reduce<Record<string, number>>((counts, result) => ({ ...counts, [result.type]: (counts[result.type] || 0) + 1 }), {}),
      { Cliente: 8, Projeto: 8, 'Orçamento': 8, Tarefa: 6 }
    );
    assert.equal(volumeResults.some((result) => result.id === volumeClients[8].id), false);
    assert.deepEqual(
      volumeResults.filter((result) => result.type === 'Cliente').map((result) => result.title),
      volumeClients.slice(0, 8).map((client) => client.nome)
    );
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await removeTestDatabase();
  }
});
