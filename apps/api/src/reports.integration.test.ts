import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import type { ManagerialReport } from '@geogestor/contracts';

const testRoot = path.resolve(process.cwd(), 'scratch', `reports-${process.pid}`);
const dbPath = path.join(testRoot, `reports.${process.pid}.test.db`);
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

test('relatório gerencial respeita período e semântica financeira canônica', async () => {
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
    const januaryBudgetId = crypto.randomUUID();
    const previousBudgetId = crypto.randomUUID();
    const recurringBudgetId = crypto.randomUUID();
    const cancelledBudgetId = crypto.randomUUID();
    const januaryInstallmentId = crypto.randomUUID();
    const cancelledInstallmentId = crypto.randomUUID();
    const deletedAt = '2026-01-20T12:00:00.000Z';

    await db.insert(schema.clientes).values({ id: clientId, nome: 'Cliente Relatórios' });
    await db.insert(schema.orcamentos).values([
      {
        id: januaryBudgetId,
        clienteId: clientId,
        valorTotal: 100_000,
        status: 'aprovado',
        dataCompetencia: '2026-01-10',
        impostosPrevistos: 8_000
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        valorTotal: 55_000,
        status: 'rejeitado',
        dataCompetencia: '2026-01-12'
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        valorTotal: 90_000,
        status: 'substituido',
        dataCompetencia: '2026-01-13'
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        valorTotal: 80_000,
        status: 'aprovado',
        dataCompetencia: '2026-01-14',
        deletedAt
      },
      {
        id: previousBudgetId,
        clienteId: clientId,
        valorTotal: 30_000,
        status: 'aprovado',
        dataCompetencia: '2025-12-10',
        dataPagamento: '2025-12-15'
      },
      {
        id: recurringBudgetId,
        clienteId: clientId,
        valorTotal: 40_000,
        status: 'aprovado',
        dataCompetencia: '2025-01-10'
      },
      {
        id: cancelledBudgetId,
        clienteId: clientId,
        valorTotal: 25_000,
        status: 'cancelado',
        dataCompetencia: '2026-01-11'
      }
    ]);
    await db.insert(schema.parcelas).values([
      {
        id: januaryInstallmentId,
        orcamentoId: januaryBudgetId,
        valor: 100_000,
        valorPago: 20_000,
        dataCompetencia: '2026-01-10',
        dataVencimento: '2026-01-20',
        statusPagamento: 'Pendente'
      },
      {
        id: crypto.randomUUID(),
        orcamentoId: januaryBudgetId,
        valor: 999_000,
        dataVencimento: '2026-01-21',
        statusPagamento: 'Pendente',
        canceladaEm: '2026-01-15T12:00:00.000Z'
      },
      {
        id: crypto.randomUUID(),
        orcamentoId: recurringBudgetId,
        valor: 40_000,
        dataCompetencia: '2026-01-15',
        dataVencimento: '2026-01-20',
        statusPagamento: 'Pendente'
      },
      {
        id: cancelledInstallmentId,
        orcamentoId: cancelledBudgetId,
        valor: 25_000,
        valorPago: 7_000,
        dataCompetencia: '2026-01-11',
        dataVencimento: '2026-01-19',
        statusPagamento: 'Pendente'
      }
    ]);
    await db.insert(schema.recebimentos).values([
      {
        id: crypto.randomUUID(),
        parcelaId: januaryInstallmentId,
        valorPrincipal: 20_000,
        valorRecebido: 20_000,
        dataRecebimento: '2026-01-15'
      },
      {
        id: crypto.randomUUID(),
        parcelaId: januaryInstallmentId,
        valorPrincipal: 70_000,
        valorRecebido: 70_000,
        dataRecebimento: '2026-01-16',
        estornadoEm: '2026-01-17T12:00:00.000Z'
      },
      {
        id: crypto.randomUUID(),
        parcelaId: cancelledInstallmentId,
        valorPrincipal: 7_000,
        valorRecebido: 7_000,
        dataRecebimento: '2026-01-14'
      }
    ]);
    await db.insert(schema.despesas).values([
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        descricao: 'Combustível pago',
        valor: 5_000,
        data: '2026-01-10',
        dataPagamento: '2026-01-18',
        categoria: 'Combustível',
        status: 'Pago'
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        descricao: 'Despesa pendente',
        valor: 9_000,
        data: '2026-01-11',
        categoria: 'Equipamentos',
        status: 'Pendente'
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        descricao: 'Despesa cancelada',
        valor: 200_000,
        data: '2026-01-12',
        dataPagamento: '2026-01-12',
        categoria: 'Outros',
        status: 'Pago',
        canceladaEm: '2026-01-12T12:00:00.000Z'
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        descricao: 'Despesa anterior',
        valor: 10_000,
        data: '2025-12-10',
        dataPagamento: '2025-12-15',
        categoria: 'Cartório',
        status: 'Pago'
      }
    ]);
    await db.insert(schema.projetos).values([
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        nome: 'Levantamento ativo',
        status: 'Em Andamento',
        tipo: 'Rural',
        municipio: 'Florianópolis',
        areaHa: 12.5,
        dataInicio: '2026-01-05',
        dataEntrega: '2026-01-25'
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        nome: 'Projeto concluído',
        status: 'Concluído',
        tipo: 'Urbano',
        municipio: 'São José',
        areaHa: 5,
        dataInicio: '2026-01-08',
        dataEntrega: '2026-01-28'
      },
      {
        id: crypto.randomUUID(),
        clienteId: clientId,
        nome: 'Projeto excluído',
        status: 'Em Andamento',
        areaHa: 900,
        dataInicio: '2026-01-09',
        deletedAt
      }
    ]);

    // Volume representativo fora do recorte: comprova que a consulta periódica
    // não precisa materializar o histórico inteiro para calcular janeiro/2026.
    const volumeRows = Array.from({ length: 1_500 }, (_, index) => ({
      id: crypto.randomUUID(),
      clienteId: clientId,
      descricao: `Despesa histórica ${index} com texto suficientemente longo para exercitar conteúdo realista`,
      valor: 100 + index,
      data: `2024-${String(index % 12 + 1).padStart(2, '0')}-15`,
      dataPagamento: `2024-${String(index % 12 + 1).padStart(2, '0')}-20`,
      categoria: `Categoria histórica ${index % 25}`,
      status: 'Pago'
    }));
    for (let index = 0; index < volumeRows.length; index += 100) {
      await db.insert(schema.despesas).values(volumeRows.slice(index, index + 100));
    }

    const reportStartedAt = performance.now();
    const response = await server.inject({
      method: 'GET',
      url: '/api/relatorios/geral?inicio=2026-01-01&fim=2026-01-31',
      headers: { 'x-api-token': 'test-token' }
    });
    const reportDurationMs = performance.now() - reportStartedAt;

    assert.equal(response.statusCode, 200);
    assert.ok(reportDurationMs < 2_500, `relatório levou ${Math.round(reportDurationMs)} ms com 1.500 registros históricos`);
    const report = response.json<ManagerialReport>();
    assert.ok(report.state.sourceRecordCount > 1_500);
    assert.equal(report.period.previousStartDate, '2025-12-01');
    assert.equal(report.period.previousEndDate, '2025-12-31');
    assert.equal(report.financial.kpis.contractedRevenue, 100_000);
    assert.equal(report.financial.kpis.receivedRevenue, 27_000);
    assert.equal(report.financial.kpis.pendingRevenue, 120_000);
    assert.equal(report.financial.kpis.overdueRevenue, 120_000);
    assert.equal(report.financial.kpis.paidExpenses, 5_000);
    assert.equal(report.financial.kpis.cashResult, 22_000);
    assert.equal(report.financial.kpis.estimatedTaxes, 8_000);
    assert.equal(report.financial.kpis.conversionRate, 50);
    assert.deepEqual(report.financial.previous, {
      contractedRevenue: 30_000,
      receivedRevenue: 30_000,
      paidExpenses: 10_000,
      cashResult: 20_000
    });
    assert.equal(report.operational.kpis.totalProjects, 2);
    assert.equal(report.operational.kpis.activeProjects, 1);
    assert.equal(report.operational.kpis.completedProjects, 1);
    assert.equal(report.operational.kpis.activeAreaHa, 12.5);
    assert.equal(report.financeiro?.resultadoCaixa, 22_000);

    const invalid = await server.inject({
      method: 'GET',
      url: '/api/relatorios/geral?inicio=2026-02-01&fim=2026-01-01',
      headers: { 'x-api-token': 'test-token' }
    });
    assert.equal(invalid.statusCode, 400);
    assert.match(invalid.json<{ error: string }>().error, /data inicial/i);

    const partial = await server.inject({
      method: 'GET',
      url: '/api/relatorios/geral?fim=2025-12-31',
      headers: { 'x-api-token': 'test-token' }
    });
    assert.equal(partial.statusCode, 200);
    assert.equal(partial.json<ManagerialReport>().financial.kpis.receivedRevenue, 30_000);
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await Promise.allSettled(dbFiles.map((file) => fs.rm(file, { force: true })));
  }
});
