import { injectWithRecordVersion } from './test-support/record-request';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { and, eq } from 'drizzle-orm';

const testRoot = path.resolve(process.cwd(), 'scratch', `session05-projects-${process.pid}`);
const databasePath = path.join(testRoot, 'session05-projects.integration.test.db');
const authHeaders = { 'x-api-token': 'session05-token' };

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = 'session05-token';

const dateKey = (offsetDays: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

test('Sessão 05 protege contratos, vínculos, interrupção financeira e exclusão', async () => {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(testRoot, { recursive: true });
  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  const request = async (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: unknown
  ): Promise<any> => await injectWithRecordVersion(server, {
    method,
    url,
    headers: payload === undefined ? authHeaders : { ...authHeaders, 'content-type': 'application/json' },
    ...(payload === undefined ? {} : { payload })
  } as any);

  try {
    await dbReady;
    await runRuntimeMigrations();
    const activeClientId = crypto.randomUUID();
    const otherClientId = crypto.randomUUID();
    const inactiveClientId = crypto.randomUUID();
    const otherPropertyId = crypto.randomUUID();
    await db.insert(schema.clientes).values([
      { id: activeClientId, nome: 'QA-AUDIT-S05-Cliente ativo', situacao: 'Ativo' },
      { id: otherClientId, nome: 'QA-AUDIT-S05-Cliente isolado', situacao: 'Ativo' },
      { id: inactiveClientId, nome: 'QA-AUDIT-S05-Cliente inativo', situacao: 'Inativo' }
    ]);
    await db.insert(schema.propriedades).values({
      id: otherPropertyId,
      clienteId: otherClientId,
      nome: 'QA-AUDIT-S05-Imóvel de outro cliente'
    });

    const inactiveClient = await request('POST', '/api/projetos', {
      nome: 'QA-AUDIT-S05-Projeto inválido', clienteId: inactiveClientId, tipo: 'Rural', status: 'Planejamento'
    });
    assert.equal(inactiveClient.statusCode, 400, inactiveClient.body);

    const crossedProperty = await request('POST', '/api/projetos', {
      nome: 'QA-AUDIT-S05-Vínculo cruzado', clienteId: activeClientId, propriedadeId: otherPropertyId,
      tipo: 'Rural', status: 'Planejamento'
    });
    assert.equal(crossedProperty.statusCode, 400, crossedProperty.body);

    const invalidBodies = [
      { nome: 'Campo extra', clienteId: activeClientId, tipo: 'Rural', status: 'Planejamento', admin: true },
      { nome: 'Status inválido', clienteId: activeClientId, tipo: 'Rural', status: 'Inventado' },
      { nome: 'Tipo inválido', clienteId: activeClientId, tipo: 'Inventado', status: 'Planejamento' },
      { nome: 'Data impossível', clienteId: activeClientId, tipo: 'Rural', status: 'Planejamento', dataInicio: '2026-02-30' },
      { nome: 'Datas invertidas', clienteId: activeClientId, tipo: 'Rural', status: 'Planejamento', dataInicio: '2026-10-02', dataEntrega: '2026-10-01' },
      { nome: 'Coordenada incompleta', clienteId: activeClientId, tipo: 'Rural', status: 'Planejamento', latitude: -27.59 },
      { nome: 'UF inválida', clienteId: activeClientId, tipo: 'Rural', status: 'Planejamento', cidade: 'Santa Catarina' }
    ];
    for (const payload of invalidBodies) {
      const response = await request('POST', '/api/projetos', payload);
      assert.equal(response.statusCode, 400, `${payload.nome}: ${response.body}`);
    }

    for (const url of [
      '/api/projetos?mode=page&page=1.5',
      '/api/projetos?inicio=2026-02-30',
      '/api/projetos?inicio=2026-10-02&fim=2026-10-01'
    ]) {
      const response = await request('GET', url);
      assert.equal(response.statusCode, 400, `${url}: ${response.body}`);
    }

    const activeProjectId = crypto.randomUUID();
    const interruptedProjectId = crypto.randomUUID();
    const linkedProjectId = crypto.randomUUID();
    const cleanProjectId = crypto.randomUUID();
    await db.insert(schema.projetos).values([
      { id: activeProjectId, clienteId: activeClientId, nome: 'QA-AUDIT-S05-Ativo', status: 'Em Andamento' },
      { id: interruptedProjectId, clienteId: activeClientId, nome: 'QA-AUDIT-S05-Interrompido', status: 'Em Andamento' },
      { id: linkedProjectId, clienteId: activeClientId, nome: 'QA-AUDIT-S05-Com tarefa', status: 'Planejamento' },
      { id: cleanProjectId, clienteId: activeClientId, nome: 'QA-AUDIT-S05-Sem vínculos', status: 'Planejamento' }
    ]);

    const prematureDecision = await request('POST', `/api/projetos/${activeProjectId}/decisao-financeira`, {
      tipo: 'manter_sem_alteracao', motivo: 'Projeto ainda está em execução.'
    });
    assert.equal(prematureDecision.statusCode, 409, prematureDecision.body);

    const suspension = await request('PATCH', `/api/projetos/${interruptedProjectId}`, { status: 'Suspenso' });
    assert.equal(suspension.statusCode, 200, suspension.body);
    const suspendedContext = await request('GET', `/api/projetos/${interruptedProjectId}/contexto-financeiro`);
    assert.equal(suspendedContext.statusCode, 200, suspendedContext.body);
    assert.equal((suspendedContext.json() as { decisaoFinanceiraPendente: boolean }).decisaoFinanceiraPendente, true);

    const budgetId = crypto.randomUUID();
    await db.insert(schema.orcamentos).values({
      id: budgetId,
      clienteId: activeClientId,
      projetoId: interruptedProjectId,
      descricao: 'QA-AUDIT-S05-Contrato',
      valorTotal: 40_000,
      status: 'Aprovado'
    });
    const installments = {
      overdue: crypto.randomUUID(),
      today: crypto.randomUUID(),
      future: crypto.randomUUID(),
      futurePartial: crypto.randomUUID(),
      futurePaid: crypto.randomUUID()
    };
    await db.insert(schema.parcelas).values([
      { id: installments.overdue, orcamentoId: budgetId, numero: 1, valor: 8_000, valorPago: 0, dataVencimento: dateKey(-5), statusPagamento: 'Atrasado' },
      { id: installments.today, orcamentoId: budgetId, numero: 2, valor: 8_000, valorPago: 0, dataVencimento: dateKey(0), statusPagamento: 'Pendente' },
      { id: installments.future, orcamentoId: budgetId, numero: 3, valor: 8_000, valorPago: 0, dataVencimento: dateKey(5), statusPagamento: 'Pendente' },
      { id: installments.futurePartial, orcamentoId: budgetId, numero: 4, valor: 8_000, valorPago: 2_000, dataVencimento: dateKey(10), statusPagamento: 'Parcial' },
      { id: installments.futurePaid, orcamentoId: budgetId, numero: 5, valor: 8_000, valorPago: 8_000, dataVencimento: dateKey(15), statusPagamento: 'Pago' }
    ]);

    const decisionPayload = { tipo: 'cancelar_parcelas_futuras', motivo: 'Cancelar apenas cobranças com vencimento futuro.' };
    const firstDecision = await request('POST', `/api/projetos/${interruptedProjectId}/decisao-financeira`, decisionPayload);
    assert.equal(firstDecision.statusCode, 201, firstDecision.body);
    const repeatedDecision = await request('POST', `/api/projetos/${interruptedProjectId}/decisao-financeira`, decisionPayload);
    assert.equal(repeatedDecision.statusCode, 200, repeatedDecision.body);

    const installmentRows = await db.select().from(schema.parcelas).where(eq(schema.parcelas.orcamentoId, budgetId));
    const byId = new Map(installmentRows.map((row) => [row.id, row]));
    assert.equal(byId.get(installments.overdue)?.canceladaEm, null);
    assert.equal(byId.get(installments.today)?.canceladaEm, null);
    assert.ok(byId.get(installments.future)?.canceladaEm);
    assert.ok(byId.get(installments.futurePartial)?.canceladaEm);
    assert.equal(byId.get(installments.futurePartial)?.valorPago, 2_000);
    assert.equal(byId.get(installments.futurePaid)?.canceladaEm, null);
    const decisions = await db.select().from(schema.projetoFinanceiroDecisoes).where(and(
      eq(schema.projetoFinanceiroDecisoes.projetoId, interruptedProjectId),
      eq(schema.projetoFinanceiroDecisoes.tipo, 'cancelar_parcelas_futuras')
    ));
    assert.equal(decisions.length, 1);

    await db.insert(schema.tarefas).values({
      id: crypto.randomUUID(), clienteId: activeClientId, projetoId: linkedProjectId,
      titulo: 'QA-AUDIT-S05-Tarefa ativa', status: 'A Fazer', prioridade: 'Alta'
    });
    const linkedDelete = await request('DELETE', `/api/projetos/${linkedProjectId}`);
    assert.equal(linkedDelete.statusCode, 409, linkedDelete.body);
    const [linkedProject] = await db.select().from(schema.projetos).where(eq(schema.projetos.id, linkedProjectId));
    assert.equal(linkedProject.deletedAt, null);

    const cleanDelete = await request('DELETE', `/api/projetos/${cleanProjectId}`);
    assert.equal(cleanDelete.statusCode, 204, cleanDelete.body);
    const repeatedDelete = await request('DELETE', `/api/projetos/${cleanProjectId}`);
    assert.equal(repeatedDelete.statusCode, 404, repeatedDelete.body);
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await fs.rm(testRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => undefined);
  }
});
