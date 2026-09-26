import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `session09-tasks-${process.pid}`);
const databasePath = path.join(testRoot, 'geogestor.db');
const token = 'session09-tasks-token';
const headers = { 'x-api-token': token };
const prefix = 'QA-AUDIT-S09-20260913-';

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = token;
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';

test('Sessão 09 preserva contratos, paginação, vínculos, modelos e auditoria de tarefas', async (t) => {
  await fs.mkdir(testRoot, { recursive: true });
  await Promise.all([databasePath, `${databasePath}-shm`, `${databasePath}-wal`].map((file) => fs.rm(file, { force: true })));
  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'), import('./db'), import('./services/runtime-migrations.service'), import('@geogestor/database')
  ]);
  const ids = {
    clientA: crypto.randomUUID(), clientB: crypto.randomUUID(), deletedClient: crypto.randomUUID(),
    projectA: crypto.randomUUID(), projectB: crypto.randomUUID(), emptyProject: crypto.randomUUID(), deletedProject: crypto.randomUUID(),
    directTask: crypto.randomUUID(), deletedTask: crypto.randomUUID(), legacyTask: crypto.randomUUID()
  };
  const request: (input: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; url: string; payload?: unknown }) => Promise<any> =
    (input) => (server.inject as any)({ ...input, headers });

  try {
    await dbReady;
    await runRuntimeMigrations();
    const now = new Date().toISOString();
    await db.insert(schema.clientes).values([
      { id: ids.clientA, nome: `${prefix}Cliente Açores`, situacao: 'Ativo' },
      { id: ids.clientB, nome: `${prefix}Cliente B`, situacao: 'Ativo' },
      { id: ids.deletedClient, nome: `${prefix}Cliente removido`, situacao: 'Ativo', deletedAt: now }
    ]);
    await db.insert(schema.projetos).values([
      { id: ids.projectA, clienteId: ids.clientA, nome: `${prefix}Projeto São José`, status: 'Em Andamento' },
      { id: ids.projectB, clienteId: ids.clientB, nome: `${prefix}Projeto B`, status: 'Em Andamento' },
      { id: ids.emptyProject, clienteId: ids.clientA, nome: `${prefix}Projeto vazio`, status: 'Em Andamento' },
      { id: ids.deletedProject, clienteId: ids.clientA, nome: `${prefix}Projeto removido`, status: 'Em Andamento', deletedAt: now }
    ]);
    await db.insert(schema.tarefas).values([
      {
        id: ids.directTask, clienteId: ids.clientA, projetoId: null, titulo: `${prefix}Contato direto`,
        descricao: 'Descrição única com emoji 🧭', status: 'A Fazer', prioridade: 'Baixa', dataLimite: '2024-02-29'
      },
      {
        id: ids.deletedTask, clienteId: ids.clientA, projetoId: ids.projectA, titulo: `${prefix}Removida`,
        status: 'A Fazer', prioridade: 'Média', dataLimite: '2024-02-01', deletedAt: now
      },
      {
        id: ids.legacyTask, clienteId: ids.clientA, projetoId: ids.projectA, titulo: `${prefix}Status legado`,
        status: 'Aguardando terceiro', prioridade: 'Urgente', dataLimite: ''
      },
      ...Array.from({ length: 101 }, (_, index) => ({
        id: crypto.randomUUID(), clienteId: ids.clientA, projetoId: ids.projectA,
        titulo: `${prefix}Volume ${String(index).padStart(3, '0')}`,
        descricao: index === 0 ? 'Memorial descritivo especial' : '',
        status: (['A Fazer', 'Em Progresso', 'Concluído'] as const)[index % 3],
        prioridade: (['Baixa', 'Média', 'Alta'] as const)[index % 3],
        dataLimite: index === 0 ? '2024-02-01' : index === 100 ? '2024-02-29' : '2024-02-15'
      }))
    ]);

    await t.test('rejeita query inválida e compõe busca em título, descrição, projeto e cliente', async () => {
      for (const url of [
        '/api/tarefas?mode=page&page=1.5',
        '/api/tarefas?mode=page&limit=10.5',
        '/api/tarefas?mode=page&inicio=2023-02-29',
        '/api/tarefas?mode=page&inicio=2024-03-01&fim=2024-02-29',
        '/api/tarefas?mode=page&prioridade=Urgente',
        '/api/tarefas?mode=page&extra=1'
      ]) {
        const response = await request({ method: 'GET', url });
        assert.equal(response.statusCode, 400, `${url} => ${response.body}`);
      }
      for (const term of ['memorial', 'sao jose', 'acores', 'contato direto']) {
        const response = await request({ method: 'GET', url: `/api/tarefas?mode=page&q=${encodeURIComponent(term)}` });
        assert.equal(response.statusCode, 200, response.body);
        assert.ok((response.json() as { total: number }).total >= 1, term);
      }
      const endOnly = await request({ method: 'GET', url: '/api/tarefas?mode=page&fim=2024-02-29' });
      assert.equal((endOnly.json() as { total: number }).total, 102, 'tarefas sem prazo não podem entrar em um intervalo com apenas data final');
    });

    await t.test('modo paginado reconcilia 100 + segunda página e legado não trunca', async () => {
      const first = await request({ method: 'GET', url: `/api/tarefas?mode=page&limit=100&projetoId=${ids.projectA}` });
      assert.equal(first.statusCode, 200, first.body);
      const firstBody = first.json() as { items: Array<{ id: string }>; total: number; totalPages: number; statusTotals: Record<string, number> };
      assert.equal(firstBody.items.length, 100);
      assert.equal(firstBody.total, 102);
      assert.equal(firstBody.totalPages, 2);
      assert.equal((Object.values(firstBody.statusTotals) as number[]).reduce((sum, value) => sum + value, 0), 102);
      assert.equal(firstBody.statusTotals.outros, 1);
      const second = await request({ method: 'GET', url: `/api/tarefas?mode=page&page=2&limit=100&projetoId=${ids.projectA}` });
      assert.equal((second.json() as { items: unknown[] }).items.length, 2);
      const legacy = await request({ method: 'GET', url: `/api/tarefas?mode=legacy&projetoId=${ids.projectA}` });
      assert.equal((legacy.json() as unknown[]).length, 102);
    });

    await t.test('valida cliente/projeto, datas, limites, payload estrito e PATCH não vazio', async () => {
      const invalidCreates = [
        { titulo: 'Sem vínculo' },
        { titulo: 'Cliente inexistente', clienteId: crypto.randomUUID() },
        { titulo: 'Cliente removido', clienteId: ids.deletedClient },
        { titulo: 'Projeto removido', projetoId: ids.deletedProject },
        { titulo: 'Vínculo cruzado', clienteId: ids.clientA, projetoId: ids.projectB },
        { titulo: 'Data impossível', projetoId: ids.projectA, dataLimite: '2023-02-29' },
        { titulo: 'Prioridade inválida', projetoId: ids.projectA, prioridade: 'Urgente' },
        { titulo: 'Campo extra', projetoId: ids.projectA, segredo: 'não persistir' }
      ];
      for (const payload of invalidCreates) {
        const response = await request({ method: 'POST', url: '/api/tarefas', payload });
        assert.equal(response.statusCode, 400, `${JSON.stringify(payload)} => ${response.body}`);
      }
      assert.equal((await request({ method: 'PATCH', url: `/api/tarefas/${ids.directTask}`, payload: {} })).statusCode, 400);
      assert.equal((await request({ method: 'PATCH', url: `/api/tarefas/${ids.directTask}`, payload: { segredo: true } })).statusCode, 400);
      const valid = await request({ method: 'PATCH', url: `/api/tarefas/${ids.directTask}`, payload: {
        titulo: `${prefix}Contato direto editado`, dataLimite: '2024-02-29'
      } });
      assert.equal(valid.statusCode, 200, valid.body);
      assert.equal((valid.json() as { projetoId: null; clienteId: string }).projetoId, null);
      assert.equal((valid.json() as { clienteId: string }).clienteId, ids.clientA);
    });

    await t.test('transições, exclusão lógica e auditoria são persistentes e idempotentes', async () => {
      const created = await request({ method: 'POST', url: '/api/tarefas', payload: {
        projetoId: ids.projectB, titulo: `${prefix}<script>inerte()</script>`, descricao: 'Descrição', prioridade: 'Alta', dataLimite: '2024-02-29'
      } });
      assert.equal(created.statusCode, 200, created.body);
      const taskId = (created.json() as { id: string; clienteId: string; status: string }).id;
      assert.equal((created.json() as { clienteId: string }).clienteId, ids.clientB);
      assert.equal((created.json() as { status: string }).status, 'A Fazer');
      assert.equal((await request({ method: 'PATCH', url: `/api/tarefas/${taskId}`, payload: { status: 'Em Progresso' } })).statusCode, 200);
      assert.equal((await request({ method: 'PATCH', url: `/api/tarefas/${taskId}`, payload: { status: 'Concluído' } })).statusCode, 200);
      const journeyAfterCompletion = (await db.select().from(schema.interacoes_cliente)).filter((entry) => entry.titulo?.includes(`${prefix}<script>inerte()`));
      assert.equal(journeyAfterCompletion.filter((entry) => entry.titulo?.startsWith('Tarefa concluída:')).length, 1);
      assert.equal((await request({ method: 'PATCH', url: `/api/tarefas/${taskId}`, payload: { descricao: 'Editada concluída' } })).statusCode, 200);
      const journeyAfterEdit = (await db.select().from(schema.interacoes_cliente)).filter((entry) => entry.titulo?.startsWith('Tarefa concluída:') && entry.titulo.includes(prefix));
      assert.equal(journeyAfterEdit.length, 1);
      assert.equal((await request({ method: 'DELETE', url: `/api/tarefas/${taskId}` })).statusCode, 200);
      assert.equal((await request({ method: 'DELETE', url: `/api/tarefas/${taskId}` })).statusCode, 404);
      assert.equal((await request({ method: 'GET', url: `/api/tarefas/${taskId}` })).statusCode, 404);
      const audits = await db.select().from(schema.auditLogs);
      assert.ok(audits.some((entry) => entry.entity === 'Tarefa' && entry.action === 'INSERT'));
      assert.ok(audits.some((entry) => entry.entity === 'Tarefa' && entry.action === 'UPDATE'));
      assert.ok(audits.some((entry) => entry.entity === 'Tarefa' && entry.action === 'DELETE (SOFT)'));
    });

    await t.test('modelos são estritos, duplicáveis, idempotentes, normalizados e preservam histórico', async () => {
      const invalidModel = await request({ method: 'POST', url: '/api/tarefas/modelos', payload: {
        nome: 'Inválido', ativo: true, etapas: [{ titulo: 'Etapa', prioridade: 'Média', extra: true }]
      } });
      assert.equal(invalidModel.statusCode, 400, invalidModel.body);
      const modelResponse = await request({ method: 'POST', url: '/api/tarefas/modelos', payload: {
        nome: `${prefix}Modelo`, descricao: 'Modelo sintético', tipoProjeto: 'Topografia', ativo: true,
        etapas: [
          { titulo: 'Conferir matrícula', prioridade: 'Alta' },
          { titulo: '  conferir   MATRICULA ', prioridade: 'Baixa' },
          { titulo: 'Emitir relatório', prioridade: 'Média' }
        ]
      } });
      assert.equal(modelResponse.statusCode, 200, modelResponse.body);
      const modelId = (modelResponse.json() as { id: string }).id;
      const duplicate = await request({ method: 'POST', url: `/api/tarefas/modelos/${modelId}/duplicar`, payload: {} });
      assert.equal(duplicate.statusCode, 200, duplicate.body);
      assert.equal((duplicate.json() as { ativo: boolean; etapas: unknown[] }).ativo, false);
      assert.equal((duplicate.json() as { etapas: unknown[] }).etapas.length, 3);
      const first = await request({ method: 'POST', url: `/api/tarefas/modelos/${modelId}/aplicar`, payload: { projetoId: ids.emptyProject } });
      assert.equal(first.statusCode, 200, first.body);
      assert.deepEqual({ criadas: (first.json() as { criadas: number }).criadas, ignoradas: (first.json() as { ignoradas: number }).ignoradas }, { criadas: 2, ignoradas: 1 });
      const second = await request({ method: 'POST', url: `/api/tarefas/modelos/${modelId}/aplicar`, payload: { projetoId: ids.emptyProject } });
      assert.deepEqual({ criadas: (second.json() as { criadas: number }).criadas, ignoradas: (second.json() as { ignoradas: number }).ignoradas }, { criadas: 0, ignoradas: 3 });
      const applicationsBeforeDelete = (await db.select().from(schema.checklistModeloAplicacoes)).filter((row) => row.modeloId === modelId);
      assert.equal(applicationsBeforeDelete.length, 2);
      assert.ok((await db.select().from(schema.auditLogs)).some((entry) => entry.entity === 'AplicacaoModeloChecklist'));
      assert.equal((await request({ method: 'DELETE', url: `/api/tarefas/modelos/${modelId}` })).statusCode, 200);
      assert.equal((await request({ method: 'POST', url: `/api/tarefas/modelos/${modelId}/aplicar`, payload: { projetoId: ids.emptyProject } })).statusCode, 404);
      assert.equal((await db.select().from(schema.checklistModeloAplicacoes)).filter((row) => row.modeloId === modelId).length, 2);
      assert.equal((await db.select().from(schema.tarefas)).filter((row) => row.projetoId === ids.emptyProject && !row.deletedAt).length, 2);
    });
  } finally {
    await server.close();
    (db as unknown as { $client: { close: () => void } }).$client.close();
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
