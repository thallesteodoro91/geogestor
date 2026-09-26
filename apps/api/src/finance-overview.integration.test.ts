import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `finance-overview-${process.pid}`);
const databasePath = path.join(testRoot, 'finance-overview.integration.test.db');
const databaseFiles = [databasePath, `${databasePath}-shm`, `${databasePath}-wal`];
const token = 'finance-overview-integration-token';
const headers = { 'x-api-token': token };

process.env.NODE_ENV = 'test';
process.env.GEOGESTOR_DB_PATH = databasePath;
process.env.GEOGESTOR_API_TOKEN = token;

type Overview = {
  analytics: {
    monthly: Array<{ mes: string; receitaContratada: number; receitaRecebida: number; despesasLancadas: number; despesasPagas: number }>;
    categorias: Array<{ categoria: string; total: number; count: number }>;
    clientes: Array<{ clienteId: string; receitaContratada: number; receitaRecebida: number; despesas: number }>;
    kpis: Record<string, number>;
  };
  recentEntries: Array<{ id: string }>;
  meta: { launchCount: number; expenseCount: number; hasSourceData: boolean; hasFilteredData: boolean };
};

test('resumo financeiro SQL preserva regras, filtros, centavos e invalidação do cache', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await Promise.all(databaseFiles.map((file) => fs.rm(file, { force: true })));

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  const clientA = crypto.randomUUID();
  const clientWithoutMovement = crypto.randomUUID();
  const projectA = crypto.randomUUID();
  const directBudget = crypto.randomUUID();
  const installmentBudget = crypto.randomUUID();
  const pipelineBudget = crypto.randomUUID();
  const deletedBudget = crypto.randomUUID();
  const installmentPartial = crypto.randomUUID();
  const installmentPaid = crypto.randomUUID();
  const installmentCancelled = crypto.randomUUID();

  try {
    await dbReady;
    await runRuntimeMigrations();

    await db.insert(schema.clientes).values([
      { id: clientA, nome: 'Cliente A', situacao: 'Ativo' },
      { id: clientWithoutMovement, nome: 'Cliente sem movimento', situacao: 'Ativo' }
    ]);
    await db.insert(schema.projetos).values({ id: projectA, clienteId: clientA, nome: 'Projeto A', status: 'Em Andamento' });
    await db.insert(schema.orcamentos).values([
      {
        id: directBudget, clienteId: clientA, projetoId: projectA, valorTotal: 10_001, status: 'pago',
        descricao: 'Contrato direto', dataCompetencia: '2025-12-15', dataOrcamento: '2025-12-15', dataPagamento: '2025-12-20', impostosPrevistos: 1_001
      },
      {
        id: installmentBudget, clienteId: clientA, projetoId: projectA, valorTotal: 20_002, status: 'aprovado',
        descricao: 'Contrato parcelado', dataCompetencia: '2026-01-10', dataOrcamento: '2026-01-10', impostosPrevistos: 2_002
      },
      {
        id: pipelineBudget, clienteId: clientA, projetoId: projectA, valorTotal: 5_003, status: 'emitido',
        descricao: 'Proposta em aberto', dataCompetencia: '2026-01-12', dataOrcamento: '2026-01-12'
      },
      {
        id: deletedBudget, clienteId: clientA, valorTotal: 999_999, status: 'aprovado',
        descricao: 'Excluído', dataCompetencia: '2026-01-15', deletedAt: '2026-01-16T00:00:00.000Z'
      }
    ]);
    await db.insert(schema.parcelas).values([
      {
        id: installmentPartial, orcamentoId: installmentBudget, valor: 10_001, valorPago: 5_001,
        dataCompetencia: '2026-01-01', dataVencimento: '2026-01-20', statusPagamento: 'Pendente'
      },
      {
        id: installmentPaid, orcamentoId: installmentBudget, valor: 10_001, valorPago: 10_001,
        dataCompetencia: '2026-02-01', dataVencimento: '2026-02-20', dataPagamento: '2026-02-10', statusPagamento: 'Pago'
      },
      {
        id: installmentCancelled, orcamentoId: installmentBudget, valor: 80_000, valorPago: 0,
        dataCompetencia: '2026-01-01', dataVencimento: '2026-01-25', statusPagamento: 'Pendente', canceladaEm: '2026-01-02T00:00:00.000Z'
      }
    ]);
    await db.insert(schema.recebimentos).values([
      { id: crypto.randomUUID(), parcelaId: installmentPartial, valorPrincipal: 3_001, valorRecebido: 3_001, dataRecebimento: '2026-01-05' },
      { id: crypto.randomUUID(), parcelaId: installmentPartial, valorPrincipal: 2_000, valorRecebido: 2_000, dataRecebimento: '2026-01-15' },
      { id: crypto.randomUUID(), parcelaId: installmentPaid, valorPrincipal: 10_001, valorRecebido: 10_001, dataRecebimento: '2026-02-10' },
      { id: crypto.randomUUID(), parcelaId: installmentPartial, valorPrincipal: 90_000, valorRecebido: 90_000, dataRecebimento: '2026-01-18', deletedAt: '2026-01-19T00:00:00.000Z' }
    ]);
    await db.insert(schema.despesas).values([
      {
        id: crypto.randomUUID(), clienteId: clientA, projetoId: projectA, descricao: 'Campo pago', valor: 1_001,
        data: '2025-12-18', dataCompetencia: '2025-12-01', dataPagamento: '2025-12-18', categoria: 'Campo', categoriaCodigo: 'outros', tipoCusto: 'Fixo', centroCusto: 'Operação', status: 'Pago'
      },
      {
        id: crypto.randomUUID(), clienteId: clientA, projetoId: projectA, descricao: 'Software pendente', valor: 2_002,
        data: '2026-12-15', dataCompetencia: '2026-01-01', categoria: 'Software', categoriaCodigo: 'outros', tipoCusto: 'Fixo', centroCusto: 'Operação', status: 'Pendente'
      },
      {
        id: crypto.randomUUID(), clienteId: null, projetoId: null, descricao: 'Taxa vencida', valor: 503,
        data: '2026-01-15', dataCompetencia: '2026-02-01', categoria: 'Tributos', categoriaCodigo: 'tributos', status: 'Pendente'
      },
      {
        id: crypto.randomUUID(), clienteId: clientA, descricao: 'Despesa excluída', valor: 999_999,
        data: '2026-01-15', categoria: 'Ignorar', categoriaCodigo: 'outros', status: 'Pago', deletedAt: '2026-01-16T00:00:00.000Z'
      }
    ]);

    const periodUrl = '/api/financeiro/overview?inicio=2025-12-01&fim=2026-02-28';
    const fullResponse = await server.inject({ method: 'GET', url: periodUrl, headers });
    assert.equal(fullResponse.statusCode, 200, fullResponse.body);
    const full = fullResponse.json<Overview>();
    assert.equal(full.analytics.kpis.receitaContratada, 30_003);
    assert.equal(full.analytics.kpis.receitaRecebida, 25_003);
    assert.equal(full.analytics.kpis.receitaAtrasada, 5_000);
    assert.equal(full.analytics.kpis.receitaPipeline, 5_003);
    assert.equal(full.analytics.kpis.despesasLancadas, 3_506);
    assert.equal(full.analytics.kpis.despesasPagas, 1_001);
    assert.equal(full.analytics.kpis.despesasAtrasadas, 503);
    assert.equal(full.analytics.kpis.impostosEstimados, 3_003);
    assert.equal(full.analytics.kpis.orcamentosSemParcelas, 1);
    assert.equal(full.analytics.kpis.despesasSemCliente, 1);
    assert.equal(full.meta.launchCount, 5);
    assert.equal(full.meta.expenseCount, 3);
    assert.equal(new Set(full.recentEntries.map((item) => item.id)).size, full.recentEntries.length);

    const december = full.analytics.monthly.find((item) => item.mes === '2025-12');
    const january = full.analytics.monthly.find((item) => item.mes === '2026-01');
    const february = full.analytics.monthly.find((item) => item.mes === '2026-02');
    assert.deepEqual(december && { contracted: december.receitaContratada, received: december.receitaRecebida, expenses: december.despesasLancadas }, { contracted: 10_001, received: 10_001, expenses: 1_001 });
    assert.deepEqual(january && { contracted: january.receitaContratada, received: january.receitaRecebida, expenses: january.despesasLancadas }, { contracted: 20_002, received: 5_001, expenses: 2_002 });
    assert.deepEqual(february && { received: february.receitaRecebida, expenses: february.despesasLancadas }, { received: 10_001, expenses: 503 });

    const januaryOnlyResponse = await server.inject({ method: 'GET', url: `/api/financeiro/overview?inicio=2026-01-01&fim=2026-01-31&clienteId=${clientA}&categoria=Software&tipoCusto=Fixo&centroCusto=Operação`, headers });
    assert.equal(januaryOnlyResponse.statusCode, 200, januaryOnlyResponse.body);
    const januaryOnly = januaryOnlyResponse.json<Overview>();
    assert.equal(januaryOnly.analytics.kpis.receitaRecebida, 5_001);
    assert.equal(januaryOnly.analytics.kpis.despesasLancadas, 2_002);
    assert.deepEqual(januaryOnly.analytics.categorias.map((item) => item.categoria), ['Software']);

    const emptyResponse = await server.inject({ method: 'GET', url: '/api/financeiro/overview?inicio=2035-01-01&fim=2035-01-31', headers });
    assert.equal(emptyResponse.statusCode, 200);
    const empty = emptyResponse.json<Overview>();
    assert.equal(empty.meta.hasSourceData, false);
    assert.equal(empty.meta.hasFilteredData, false);
    assert.equal(empty.analytics.kpis.receitaContratada, 0);
    assert.equal(empty.analytics.kpis.despesasLancadas, 0);

    const createExpenseResponse = await server.inject({
      method: 'POST',
      url: '/api/financeiro/despesas',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: {
        clienteId: clientA,
        projetoId: projectA,
        descricao: 'Despesa que invalida o cache',
        valor: 707,
        data: '2026-12-20',
        dataCompetencia: '2026-01-20',
        categoria: 'Software',
        tipoCusto: 'Fixo',
        centroCusto: 'Operação',
        status: 'Pendente'
      }
    });
    assert.equal(createExpenseResponse.statusCode, 200, createExpenseResponse.body);
    const refreshedResponse = await server.inject({ method: 'GET', url: periodUrl, headers });
    assert.equal(refreshedResponse.statusCode, 200, refreshedResponse.body);
    assert.equal(refreshedResponse.json<Overview>().analytics.kpis.despesasLancadas, 4_213);

    const legacyResponse = await server.inject({ method: 'GET', url: '/api/financeiro/despesas?mode=legacy', headers });
    assert.equal(legacyResponse.statusCode, 200);
    assert.equal(legacyResponse.headers.deprecation, 'true');
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await Promise.allSettled(databaseFiles.map((file) => fs.rm(file, { force: true })));
  }
});
