import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { ManagerialReport } from '@geogestor/contracts';

const testRoot = path.resolve(process.cwd(), 'scratch', `session11-reports-${process.pid}`);
const dbPath = path.join(testRoot, `session11.${process.pid}.test.db`);
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';
process.env.GEOGESTOR_DISABLE_SCHEDULER = '1';

const headers = { 'x-api-token': 'test-token' };
const prefix = 'QA-AUDIT-S11-20260917-';

function saoPauloDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test('Sessão 11 reconcilia centavos, coortes, categorias, alertas, cache e contrato HTTP', async (t) => {
  await fs.mkdir(testRoot, { recursive: true });
  await Promise.all(dbFiles.map((file) => fs.rm(file, { force: true })));

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  try {
    await dbReady;
    await runRuntimeMigrations();

    const clientId = crypto.randomUUID();
    await db.insert(schema.clientes).values({ id: clientId, nome: `${prefix}Cliente` });

    const budgets = {
      partial: crypto.randomUUID(),
      directPaid: crypto.randomUUID(),
      directPending: crypto.randomUUID(),
      legacy: crypto.randomUUID(),
      overpaid: crypto.randomUUID(),
      rejected: crypto.randomUUID(),
      expired: crypto.randomUUID(),
      cancelled: crypto.randomUUID(),
      replaced: crypto.randomUUID(),
      draft: crypto.randomUUID(),
      deleted: crypto.randomUUID(),
      previous: crypto.randomUUID()
    };
    await db.insert(schema.orcamentos).values([
      { id: budgets.partial, clienteId: clientId, valorTotal: 10_000, status: '  APROVADO ', dataCompetencia: '2026-09-02', impostosPrevistos: 1_000 },
      { id: budgets.directPaid, clienteId: clientId, valorTotal: 5_000, status: 'pago', dataCompetencia: '2026-09-03', dataPagamento: '2026-09-12', impostosPrevistos: 500 },
      { id: budgets.directPending, clienteId: clientId, valorTotal: 4_000, status: 'aprovado', dataCompetencia: '2026-09-04', impostosPrevistos: 400 },
      { id: budgets.legacy, clienteId: clientId, valorTotal: 6_000, status: 'aprovado', dataCompetencia: '2026-09-05', impostosPrevistos: 600 },
      { id: budgets.overpaid, clienteId: clientId, valorTotal: 2_000, status: 'aprovado', dataCompetencia: '2026-09-06', impostosPrevistos: 200 },
      { id: budgets.rejected, clienteId: clientId, valorTotal: 300_000, status: 'rejeitado', dataCompetencia: '2026-09-07' },
      { id: budgets.expired, clienteId: clientId, valorTotal: 300_000, status: 'expirado', dataCompetencia: '2026-09-08' },
      { id: budgets.cancelled, clienteId: clientId, valorTotal: 900_000, status: 'cancelado', dataCompetencia: '2026-09-09' },
      { id: budgets.replaced, clienteId: clientId, valorTotal: 800_000, status: 'substituido', dataCompetencia: '2026-09-10' },
      { id: budgets.draft, clienteId: clientId, valorTotal: 700_000, status: 'rascunho', dataCompetencia: '2026-09-11' },
      { id: budgets.deleted, clienteId: clientId, valorTotal: 999_999, status: 'aprovado', dataCompetencia: '2026-09-12', deletedAt: '2026-09-13T12:00:00.000Z' },
      { id: budgets.previous, clienteId: clientId, valorTotal: 7_000, status: 'aprovado', dataCompetencia: '2026-08-05', dataPagamento: '2026-08-15' }
    ]);

    const installments = {
      partial: crypto.randomUUID(),
      legacy: crypto.randomUUID(),
      overpaid: crypto.randomUUID()
    };
    await db.insert(schema.parcelas).values([
      { id: installments.partial, orcamentoId: budgets.partial, valor: 10_000, valorPago: 3_000, dataCompetencia: '2026-09-02', dataVencimento: '2026-09-16', statusPagamento: 'Pendente' },
      { id: installments.legacy, orcamentoId: budgets.legacy, valor: 6_000, valorPago: 0, dataCompetencia: '2026-09-05', dataVencimento: '2026-09-13', dataPagamento: '2026-09-13', statusPagamento: 'Pago' },
      { id: installments.overpaid, orcamentoId: budgets.overpaid, valor: 2_000, valorPago: 3_000, dataCompetencia: '2026-09-06', dataVencimento: '2026-09-14', statusPagamento: 'Pendente' },
      { id: crypto.randomUUID(), orcamentoId: budgets.partial, valor: 500_000, dataCompetencia: '2026-09-02', dataVencimento: '2026-09-15', statusPagamento: 'Pendente', canceladaEm: '2026-09-12T12:00:00.000Z' },
      { id: crypto.randomUUID(), orcamentoId: budgets.partial, valor: 600_000, dataCompetencia: '2026-09-02', dataVencimento: '2026-09-15', statusPagamento: 'Pendente', deletedAt: '2026-09-12T12:00:00.000Z' }
    ]);
    await db.insert(schema.recebimentos).values([
      { id: crypto.randomUUID(), parcelaId: installments.partial, valorPrincipal: 1_000, valorRecebido: 1_000, dataRecebimento: '2026-09-10' },
      { id: crypto.randomUUID(), parcelaId: installments.partial, valorPrincipal: 2_000, valorRecebido: 2_000, dataRecebimento: '2026-09-11' },
      { id: crypto.randomUUID(), parcelaId: installments.partial, valorPrincipal: 90_000, valorRecebido: 90_000, dataRecebimento: '2026-09-12', estornadoEm: '2026-09-13T12:00:00.000Z' },
      { id: crypto.randomUUID(), parcelaId: installments.partial, valorPrincipal: 80_000, valorRecebido: 80_000, dataRecebimento: '2026-09-12', deletedAt: '2026-09-13T12:00:00.000Z' }
    ]);

    await db.insert(schema.despesas).values([
      { id: crypto.randomUUID(), clienteId: clientId, descricao: `${prefix}Combustível pago por caixa`, valor: 2_500, data: '2026-08-31', dataCompetencia: '2026-08-31', dataPagamento: '2026-09-14', categoria: 'Combustível', status: 'Pago' },
      { id: crypto.randomUUID(), clienteId: clientId, descricao: `${prefix}Pendente não infla pago`, valor: 9_000, data: '2026-09-15', dataCompetencia: '2026-09-15', categoria: 'Combustível', status: 'Pendente' },
      { id: crypto.randomUUID(), clienteId: clientId, descricao: `${prefix}Paga fora do caixa`, valor: 7_000, data: '2026-09-15', dataCompetencia: '2026-09-15', dataPagamento: '2026-10-01', categoria: 'Fora do caixa', status: 'Pago' },
      { id: crypto.randomUUID(), clienteId: clientId, descricao: `${prefix}Sem categoria`, valor: 500, data: '2026-09-20', dataPagamento: '2026-09-20', categoria: ' ', status: 'Pago' },
      { id: crypto.randomUUID(), clienteId: clientId, descricao: `${prefix}Cancelada`, valor: 500_000, data: '2026-09-20', dataPagamento: '2026-09-20', categoria: 'Cancelada', status: 'Pago', canceladaEm: '2026-09-20T12:00:00.000Z' },
      { id: crypto.randomUUID(), clienteId: clientId, descricao: `${prefix}Estornada`, valor: 500_000, data: '2026-09-20', dataPagamento: '2026-09-20', categoria: 'Estornada', status: 'Pago', estornadaEm: '2026-09-20T12:00:00.000Z' },
      { id: crypto.randomUUID(), clienteId: clientId, descricao: `${prefix}Excluída`, valor: 500_000, data: '2026-09-20', dataPagamento: '2026-09-20', categoria: 'Excluída', status: 'Pago', deletedAt: '2026-09-20T12:00:00.000Z' }
    ]);

    const today = saoPauloDateKey();
    const projectRows = [
      { name: `${prefix}Atrasado`, status: 'Em Andamento', areaHa: null, due: shiftDate(today, -1), type: 'Rural', city: 'Florianópolis' },
      { name: `${prefix}Vence hoje`, status: 'Planejamento', areaHa: 0, due: today, type: 'Urbano', city: 'São José' },
      { name: `${prefix}Vence +30`, status: 'Aguardando Cliente', areaHa: 12.5, due: shiftDate(today, 30), type: '', city: '' },
      { name: `${prefix}Vence +31`, status: 'Suspenso', areaHa: 3, due: shiftDate(today, 31), type: 'Rural', city: 'Florianópolis' },
      { name: `${prefix}Status vazio`, status: '', areaHa: null, due: null, type: '', city: '' },
      { name: `${prefix}Concluído`, status: ' CONCLUÍDO ', areaHa: 100, due: shiftDate(today, -10), type: 'Rural', city: 'Palhoça' },
      { name: `${prefix}Finalizado`, status: 'Finalizado', areaHa: 100, due: shiftDate(today, -10), type: 'Rural', city: 'Palhoça' },
      { name: `${prefix}Entregue`, status: 'Entregue', areaHa: 100, due: shiftDate(today, -10), type: 'Rural', city: 'Palhoça' },
      { name: `${prefix}Cancelado`, status: 'Cancelado', areaHa: 100, due: shiftDate(today, -10), type: 'Rural', city: 'Palhoça' }
    ];
    await db.insert(schema.projetos).values(projectRows.map((row) => ({
      id: crypto.randomUUID(),
      clienteId: clientId,
      nome: row.name,
      status: row.status,
      areaHa: row.areaHa,
      dataInicio: '2026-09-01',
      dataEntrega: row.due,
      tipo: row.type,
      municipio: row.city
    })));
    await db.insert(schema.projetos).values({
      id: crypto.randomUUID(), clienteId: clientId, nome: `${prefix}Projeto excluído`, status: 'Em Andamento', areaHa: 999,
      dataInicio: '2026-09-01', deletedAt: '2026-09-02T12:00:00.000Z'
    });

    const pendingOnlyBudgetId = crypto.randomUUID();
    await db.insert(schema.orcamentos).values([
      { id: pendingOnlyBudgetId, clienteId: clientId, valorTotal: 1_234, status: 'aprovado', dataCompetencia: '2026-05-20' },
      { id: crypto.randomUUID(), clienteId: clientId, valorTotal: 9_000, status: 'rejeitado', dataCompetencia: '2026-07-10' },
      { id: crypto.randomUUID(), clienteId: clientId, valorTotal: 8_000, status: 'expirado', dataCompetencia: '2026-07-11' }
    ]);
    await db.insert(schema.parcelas).values({
      id: crypto.randomUUID(), orcamentoId: pendingOnlyBudgetId, valor: 1_234, valorPago: 0,
      dataCompetencia: '2026-06-15', dataVencimento: '2026-06-20', statusPagamento: 'Pendente'
    });
    await db.insert(schema.despesas).values({
      id: crypto.randomUUID(), clienteId: clientId, descricao: `${prefix}Caixa negativo isolado`, valor: 1_000,
      data: '2026-07-12', dataPagamento: '2026-07-12', categoria: 'QA', status: 'Pago'
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/relatorios/geral?inicio=2026-09-01&fim=2026-09-30',
      headers
    });
    assert.equal(response.statusCode, 200);
    const report = response.json<ManagerialReport>();

    assert.deepEqual(report.period, {
      startDate: '2026-09-01', endDate: '2026-09-30',
      previousStartDate: '2026-08-02', previousEndDate: '2026-08-31',
      label: '2026-09-01 a 2026-09-30', comparisonLabel: '2026-08-02 a 2026-08-31',
      rules: report.period.rules
    });
    assert.deepEqual(report.financial.kpis, {
      contractedRevenue: 27_000,
      receivedRevenue: 14_000,
      pendingRevenue: 11_000,
      overdueRevenue: 11_000,
      paidExpenses: 3_000,
      cashResult: 11_000,
      estimatedTaxes: 2_700,
      approvedBudgets: 5,
      decidedBudgets: 7,
      conversionRate: 71.4
    });
    assert.deepEqual(report.financial.previous, {
      contractedRevenue: 7_000,
      receivedRevenue: 7_000,
      paidExpenses: 0,
      cashResult: 7_000
    });
    assert.deepEqual(report.financial.monthly, [{ month: '2026-09', receivedRevenue: 14_000, paidExpenses: 3_000, cashResult: 11_000 }]);
    assert.deepEqual(report.financial.expensesByCategory.map(({ category, paidTotal, count }) => ({ category, paidTotal, count })), [
      { category: 'Combustível', paidTotal: 2_500, count: 1 },
      { category: 'Sem categoria', paidTotal: 500, count: 1 }
    ]);
    assert.equal(report.financial.expensesByCategory.reduce((sum, item) => sum + item.paidTotal, 0), report.financial.kpis.paidExpenses);

    assert.deepEqual(report.operational.kpis, {
      totalProjects: 9,
      activeProjects: 5,
      completedProjects: 3,
      cancelledProjects: 1,
      overdueProjects: 1,
      dueSoonProjects: 2,
      activeAreaHa: 15.5,
      projectsWithKnownArea: 3
    });
    assert.equal(report.operational.byStatus.reduce((sum, item) => sum + item.count, 0), 9);
    assert.ok(report.operational.byStatus.some((item) => item.label === 'Não informado' && item.count === 1));
    assert.equal(report.operational.deadlines.length, 3);
    assert.deepEqual([...report.financial.alerts, ...report.operational.alerts].map((alert) => alert.code), [
      'overdue_revenue', 'overdue_projects', 'unknown_area'
    ]);
    assert.equal(report.areaTotal, report.operational.kpis.activeAreaHa);
    assert.equal(report.financeiro?.resultadoCaixa, report.financial.kpis.cashResult);

    const pendingOnlyResponse = await server.inject({
      method: 'GET', url: '/api/relatorios/geral?inicio=2026-06-01&fim=2026-06-30', headers
    });
    const pendingOnly = pendingOnlyResponse.json<ManagerialReport>();
    assert.equal(pendingOnly.financial.kpis.pendingRevenue, 1_234);
    assert.equal(pendingOnly.state.hasSourceData, true);
    assert.equal(pendingOnly.state.hasFilteredData, true);
    assert.ok(pendingOnly.state.filteredRecordCount >= 1);

    const negativeLowConversionResponse = await server.inject({
      method: 'GET', url: '/api/relatorios/geral?inicio=2026-07-01&fim=2026-07-31', headers
    });
    const negativeLowConversion = negativeLowConversionResponse.json<ManagerialReport>();
    assert.equal(negativeLowConversion.financial.kpis.cashResult, -1_000);
    assert.equal(negativeLowConversion.financial.kpis.conversionRate, 0);
    assert.deepEqual(negativeLowConversion.financial.alerts.map((alert) => alert.code), ['negative_cash', 'low_conversion']);

    const invalidUrls = [
      '/api/relatorios/geral?inicio=2026-09-01&inicio=2026-09-02',
      '/api/relatorios/geral?inicio=2026-09-01&extra=1',
      '/api/relatorios/geral?inicio=2026-02-30',
      '/api/relatorios/geral?inicio[]=2026-09-01'
    ];
    for (const url of invalidUrls) {
      const invalid = await server.inject({ method: 'GET', url, headers });
      assert.equal(invalid.statusCode, 400, `${url} deveria retornar 400, recebeu ${invalid.statusCode}`);
      assert.doesNotMatch(invalid.body, /stack|sqlite|select |c:\\/i);
    }

    const volumeRows = Array.from({ length: 1_500 }, (_, index) => ({
      id: crypto.randomUUID(),
      clienteId: clientId,
      descricao: `${prefix}Volume ${String(index + 1).padStart(4, '0')}`,
      valor: 100 + index,
      data: '2024-06-15',
      dataPagamento: '2024-06-15',
      categoria: `Categoria ${String((index % 25) + 1).padStart(2, '0')}`,
      status: 'Pago'
    }));
    for (let index = 0; index < volumeRows.length; index += 50) {
      await db.insert(schema.despesas).values(volumeRows.slice(index, index + 50));
    }
    const heapBefore = process.memoryUsage().heapUsed;
    const volumeStartedAt = performance.now();
    const volumeResponse = await server.inject({
      method: 'GET', url: '/api/relatorios/geral?inicio=2024-01-01&fim=2024-12-31', headers
    });
    const volumeElapsedMs = performance.now() - volumeStartedAt;
    const heapDeltaBytes = Math.max(0, process.memoryUsage().heapUsed - heapBefore);
    assert.equal(volumeResponse.statusCode, 200);
    const volumeReport = volumeResponse.json<ManagerialReport>();
    assert.equal(volumeReport.financial.kpis.paidExpenses, 1_274_250);
    assert.equal(volumeReport.financial.composition?.paidExpenseCount, 1_500);
    assert.equal(volumeReport.financial.expensesByCategory.length, 25);
    assert.equal(volumeReport.financial.expensesByCategory.reduce((sum, item) => sum + item.count, 0), 1_500);
    assert.ok(volumeElapsedMs < 2_500, `Relatório com 1.500 despesas levou ${volumeElapsedMs.toFixed(1)} ms.`);
    assert.ok(heapDeltaBytes < 128 * 1024 * 1024, `Heap cresceu ${(heapDeltaBytes / 1024 / 1024).toFixed(1)} MiB.`);
    t.diagnostic(`volume=1500; latency=${volumeElapsedMs.toFixed(1)}ms; heapDelta=${(heapDeltaBytes / 1024 / 1024).toFixed(1)}MiB`);

    const beforeMutation = report.operational.kpis.totalProjects;
    const createdProject = await server.inject({
      method: 'POST',
      url: '/api/projetos',
      headers,
      payload: {
        nome: `${prefix}Criado após cache`, clienteId: clientId, status: 'Em Andamento', tipo: 'Rural',
        dataInicio: '2026-09-29', areaHa: 1
      }
    });
    assert.equal(createdProject.statusCode, 201);
    const afterMutation = await server.inject({
      method: 'GET',
      url: '/api/relatorios/geral?inicio=2026-09-01&fim=2026-09-30',
      headers
    });
    assert.equal(afterMutation.json<ManagerialReport>().operational.kpis.totalProjects, beforeMutation + 1);

    const beforeTopography = afterMutation.json<ManagerialReport>();
    const calculation = await server.inject({
      method: 'POST',
      url: '/api/dados-operacionais/calculos',
      headers,
      payload: {
        tipo: 'topografico', nome: `${prefix}Sem efeito gerencial`, dataCalculo: '2026-09-17',
        entradas: { x: 1 }, resultado: { area: 123456789 }, unidade: 'm²', metodo: 'QA'
      }
    });
    assert.equal(calculation.statusCode, 201);
    const afterTopographyResponse = await server.inject({
      method: 'GET',
      url: '/api/relatorios/geral?inicio=2026-09-01&fim=2026-09-30',
      headers
    });
    const afterTopography = afterTopographyResponse.json<ManagerialReport>();
    assert.deepEqual(afterTopography.financial.kpis, beforeTopography.financial.kpis);
    assert.deepEqual(afterTopography.operational.kpis, beforeTopography.operational.kpis);
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await Promise.allSettled(dbFiles.map((file) => fs.rm(file, { force: true })));
    await fs.rm(testRoot, { recursive: true, force: true }).catch((error: NodeJS.ErrnoException) => {
      if (!['EBUSY', 'EPERM'].includes(error.code || '')) throw error;
    });
  }
});
