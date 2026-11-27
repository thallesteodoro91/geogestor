import { injectWithRecordVersion } from './test-support/record-request';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `session08-calendar-${process.pid}`);
const databasePath = path.join(testRoot, 'geogestor.db');
const token = 'session08-calendar-token';
const headers = { 'x-api-token': token };
const prefix = 'QA-AUDIT-S08-20260912-';

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = token;
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';

test('Sessão 08 preserva contratos, fontes, vínculos, ordem e auditoria do calendário', async (t) => {
  await fs.mkdir(testRoot, { recursive: true });
  await Promise.all([databasePath, `${databasePath}-shm`, `${databasePath}-wal`].map((file) => fs.rm(file, { force: true })));
  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'), import('./db'), import('./services/runtime-migrations.service'), import('@geogestor/database')
  ]);
  const ids = {
    clientA: crypto.randomUUID(), clientB: crypto.randomUUID(), deletedClient: crypto.randomUUID(),
    projectA: crypto.randomUUID(), projectB: crypto.randomUUID(), deletedProject: crypto.randomUUID(),
    task: crypto.randomUUID(), deletedTask: crypto.randomUUID()
  };
  const request = (input: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; url: string; payload?: Record<string, unknown> }) =>
    injectWithRecordVersion(server, { ...input, headers });

  try {
    await dbReady;
    await runRuntimeMigrations();
    const now = new Date().toISOString();
    await db.insert(schema.clientes).values([
      { id: ids.clientA, nome: `${prefix}Cliente A`, situacao: 'Ativo' },
      { id: ids.clientB, nome: `${prefix}Cliente B`, situacao: 'Ativo' },
      { id: ids.deletedClient, nome: `${prefix}Cliente removido`, situacao: 'Ativo', deletedAt: now }
    ]);
    await db.insert(schema.projetos).values([
      { id: ids.projectA, clienteId: ids.clientA, nome: `${prefix}Projeto A`, status: 'Em Andamento', dataInicio: '2024-02-01', dataEntrega: '2024-02-29' },
      { id: ids.projectB, clienteId: ids.clientB, nome: `${prefix}Projeto B`, status: 'Em Andamento', dataInicio: '2024-01-31', dataEntrega: '2024-03-01' },
      { id: ids.deletedProject, clienteId: ids.clientA, nome: `${prefix}Projeto removido`, status: 'Em Andamento', dataInicio: '2024-02-10', deletedAt: now }
    ]);
    await db.insert(schema.tarefas).values([
      { id: ids.task, clienteId: ids.clientA, projetoId: ids.projectA, titulo: `${prefix}Tarefa`, status: 'Em Progresso', prioridade: 'Alta', dataLimite: '2024-02-29' },
      { id: ids.deletedTask, clienteId: ids.clientA, projetoId: ids.projectA, titulo: `${prefix}Tarefa removida`, status: 'A Fazer', prioridade: 'Média', dataLimite: '2024-02-15', deletedAt: now }
    ]);

    await t.test('valida datas, horas, tipos, campos extras e vínculos ativos', async () => {
      const invalidPayloads = [
        { titulo: '   ', data: '2024-02-29' },
        { titulo: 'Data impossível', data: '2023-02-29' },
        { titulo: 'Hora inválida', data: '2024-02-29', hora: '24:00' },
        { titulo: 'Tipo inválido', data: '2024-02-29', tipo: 'Recorrente' },
        { titulo: 'Campo extra', data: '2024-02-29', segredo: 'não persistir' },
        { titulo: 'Cliente removido', data: '2024-02-29', clienteId: ids.deletedClient },
        { titulo: 'Projeto removido', data: '2024-02-29', projetoId: ids.deletedProject },
        { titulo: 'Vínculo cruzado', data: '2024-02-29', clienteId: ids.clientA, projetoId: ids.projectB }
      ];
      for (const payload of invalidPayloads) {
        const response = await request({ method: 'POST', url: '/api/compromissos', payload });
        assert.equal(response.statusCode, 400, `${JSON.stringify(payload)} => ${response.body}`);
      }
      for (const url of [
        '/api/compromissos?inicio=2024-02-30&fim=2024-03-01',
        '/api/compromissos?inicio=2024-03-01&fim=2024-02-01',
        '/api/compromissos?inicio=2024-02-01&fim=2024-02-29&extra=1',
        '/api/tarefas/calendar?inicio=2024-02-30&fim=2024-03-01',
        '/api/tarefas/calendar?inicio=2024-03-01&fim=2024-02-01'
      ]) {
        const response = await request({ method: 'GET', url });
        assert.equal(response.statusCode, 400, `${url} => ${response.body}`);
      }
    });

    await t.test('deriva cliente do projeto, ordena horários e não duplica por JOIN', async () => {
      const payloads = [
        { titulo: `${prefix}Dia inteiro`, data: '2024-02-29', hora: null, tipo: 'Outro', projetoId: ids.projectA },
        { titulo: `${prefix}Meia-noite`, data: '2024-02-29', hora: '00:00', tipo: 'Ligação', projetoId: ids.projectA },
        { titulo: `${prefix}Manhã`, data: '2024-02-29', hora: '09:00', tipo: 'Reunião', projetoId: ids.projectA },
        { titulo: `${prefix}Noite`, data: '2024-02-29', hora: '23:59', tipo: 'Serviço', projetoId: ids.projectA }
      ];
      for (const payload of payloads) {
        const response = await request({ method: 'POST', url: '/api/compromissos', payload });
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.json<{ clienteId: string }>().clienteId, ids.clientA);
      }
      const response = await request({ method: 'GET', url: '/api/compromissos?inicio=2024-02-01&fim=2024-02-29' });
      assert.equal(response.statusCode, 200, response.body);
      const rows = response.json<Array<{ titulo: string; hora: string | null; clienteId: string; clienteNome: string }>>();
      assert.deepEqual(rows.map((row) => row.hora), ['00:00', '09:00', '23:59', null]);
      assert.equal(new Set(rows.map((row) => row.titulo)).size, rows.length);
      assert.ok(rows.every((row) => row.clienteId === ids.clientA && row.clienteNome === `${prefix}Cliente A`));
    });

    await t.test('retorna todas as fontes nas bordas e detalhe de tarefa por ID', async () => {
      const projects = await request({ method: 'GET', url: '/api/projetos/calendar?inicio=2024-02-01&fim=2024-02-29' });
      assert.equal(projects.statusCode, 200, projects.body);
      assert.deepEqual(projects.json<Array<{ id: string }>>().map((item) => item.id), [ids.projectA]);
      const tasks = await request({ method: 'GET', url: '/api/tarefas/calendar?inicio=2024-02-01&fim=2024-02-29' });
      assert.equal(tasks.statusCode, 200, tasks.body);
      assert.deepEqual(tasks.json<Array<{ id: string }>>().map((item) => item.id), [ids.task]);
      const detail = await request({ method: 'GET', url: `/api/tarefas/${ids.task}` });
      assert.equal(detail.statusCode, 200, detail.body);
      const taskDetail = detail.json<{ id: string; projetoNome: string }>();
      assert.equal(taskDetail.id, ids.task);
      assert.equal(taskDetail.projetoNome, `${prefix}Projeto A`);
      assert.equal((await request({ method: 'GET', url: `/api/tarefas/${ids.deletedTask}` })).statusCode, 404);
      assert.equal((await request({ method: 'GET', url: '/api/tarefas/uuid-invalido' })).statusCode, 400);
    });

    await t.test('PATCH parcial e DELETE persistem com jornada e auditoria atômicas', async () => {
      const created = await request({ method: 'POST', url: '/api/compromissos', payload: {
        titulo: `${prefix}Mutável`, descricao: '<script>inerte()</script>', data: '2024-02-28', hora: '12:30', tipo: 'Administrativo', clienteId: ids.clientA
      } });
      assert.equal(created.statusCode, 200, created.body);
      const id = created.json<{ id: string }>().id;
      assert.equal((await request({ method: 'PATCH', url: `/api/compromissos/${id}`, payload: {} })).statusCode, 400);
      const updated = await request({ method: 'PATCH', url: `/api/compromissos/${id}`, payload: { data: '2024-02-29', hora: null, tipo: 'Entrega' } });
      assert.equal(updated.statusCode, 200, updated.body);
      const updatedBody = updated.json<{ data: string; hora: null; tipo: string }>();
      assert.equal(updatedBody.data, '2024-02-29');
      assert.equal(updatedBody.hora, null);
      assert.equal(updatedBody.tipo, 'Entrega');
      const beforeDeleteAudits = (await db.select().from(schema.auditLogs)).length;
      const deletion = await request({ method: 'DELETE', url: `/api/compromissos/${id}` });
      assert.equal(deletion.statusCode, 200, deletion.body);
      assert.equal((await request({ method: 'DELETE', url: `/api/compromissos/${id}` })).statusCode, 404);
      assert.equal((await request({ method: 'GET', url: `/api/compromissos/${id}` })).statusCode, 404);
      const audits = await db.select().from(schema.auditLogs);
      assert.ok(audits.length >= beforeDeleteAudits + 1);
      assert.ok(audits.some((entry) => entry.entity === 'Compromisso' && entry.action === 'DELETE'));
      const journey = await db.select().from(schema.interacoes_cliente);
      assert.ok(journey.some((entry) => entry.clienteId === ids.clientA && entry.titulo?.includes('Compromisso excluído')));
    });

    await t.test('intervalo mensal não trunca silenciosamente acima de 500 compromissos', async () => {
      await db.insert(schema.compromissos).values(Array.from({ length: 501 }, (_, index) => ({
        id: crypto.randomUUID(), titulo: `${prefix}Volume ${String(index).padStart(3, '0')}`, data: '2024-02-15', hora: null, tipo: 'Outro'
      })));
      const response = await request({ method: 'GET', url: '/api/compromissos?inicio=2024-02-01&fim=2024-02-29' });
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(response.json<unknown[]>().length, 505);
    });
  } finally {
    await server.close();
    (db as unknown as { $client: { close: () => void } }).$client.close();
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
