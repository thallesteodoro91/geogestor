import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testRoot = path.resolve(process.cwd(), 'scratch', `financial-removal-scenarios-${process.pid}`);
const dbPath = path.join(testRoot, 'financial-removal-scenarios.integration.test.db');
const dbFiles = [dbPath, `${dbPath}-shm`, `${dbPath}-wal`];
const authHeaders = { 'content-type': 'application/json', 'x-api-token': 'test-token' };

process.env.GEOGESTOR_DB_PATH = dbPath;
process.env.GEOGESTOR_API_TOKEN = 'test-token';

async function removeTestDatabase() {
  await Promise.allSettled(dbFiles.map((file) => fs.rm(file, { force: true })));
}

function localDateKey(day = 15) {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

test('exclusões, estornos e cancelamentos recalculam KPIs sem apagar o histórico financeiro', async () => {
  await fs.mkdir(testRoot, { recursive: true });
  await removeTestDatabase();

  const [{ server }, { db, dbReady }, { runRuntimeMigrations }, { schema }] = await Promise.all([
    import('./server'),
    import('./db'),
    import('./services/runtime-migrations.service'),
    import('@geogestor/database')
  ]);

  const request = (input: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    payload?: Record<string, unknown>;
  }) => server.inject({
    ...input,
    headers: input.payload === undefined ? { 'x-api-token': 'test-token' } : authHeaders
  });

  try {
    await dbReady;
    await runRuntimeMigrations();

    const clientId = crypto.randomUUID();
    const emptyProjectId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const draftBudgetId = crypto.randomUUID();
    const approvedBudgetId = crypto.randomUUID();
    const installmentId = crypto.randomUUID();
    const currentDate = localDateKey();
    const currentMonth = currentDate.slice(0, 7);

    await db.insert(schema.clientes).values({ id: clientId, nome: 'Cliente das simulações financeiras' });
    await db.insert(schema.projetos).values([
      { id: emptyProjectId, clienteId: clientId, nome: 'Projeto sem orçamento', status: 'Planejado' },
      { id: projectId, clienteId: clientId, nome: 'Projeto com movimentação', status: 'Em Andamento' }
    ]);

    const emptyContextResponse = await request({
      method: 'GET',
      url: `/api/projetos/${emptyProjectId}/contexto-financeiro`
    });
    assert.equal(emptyContextResponse.statusCode, 200, emptyContextResponse.body);
    const emptyContext = emptyContextResponse.json<{
      valorOrcado: number;
      valorContratado: number;
      valorExecutadoInformado: number | null;
      valorRecebido: number;
      saldoAberto: number;
    }>();
    assert.deepEqual({
      valorOrcado: emptyContext.valorOrcado,
      valorContratado: emptyContext.valorContratado,
      valorExecutadoInformado: emptyContext.valorExecutadoInformado,
      valorRecebido: emptyContext.valorRecebido,
      saldoAberto: emptyContext.saldoAberto
    }, {
      valorOrcado: 0,
      valorContratado: 0,
      valorExecutadoInformado: null,
      valorRecebido: 0,
      saldoAberto: 0
    });

    const zeroExpenseResponse = await request({
      method: 'POST',
      url: '/api/financeiro/despesas',
      payload: {
        clienteId: clientId,
        projetoId: projectId,
        descricao: 'Despesa zerada inválida',
        valor: 0,
        data: currentDate,
        categoria: 'Outros'
      }
    });
    assert.equal(zeroExpenseResponse.statusCode, 400, zeroExpenseResponse.body);

    await db.insert(schema.orcamentos).values([
      {
        id: draftBudgetId,
        clienteId: clientId,
        projetoId: projectId,
        descricao: 'Rascunho removível',
        valorTotal: 12_345,
        status: 'rascunho'
      },
      {
        id: approvedBudgetId,
        clienteId: clientId,
        projetoId: projectId,
        descricao: 'Contrato com centavos residuais',
        valorTotal: 10_001,
        status: 'aprovado',
        dataEmissao: currentDate
      }
    ]);
    await db.insert(schema.parcelas).values({
      id: installmentId,
      orcamentoId: approvedBudgetId,
      valor: 10_001,
      valorPago: 0,
      dataVencimento: currentDate,
      statusPagamento: 'Pendente'
    });

    const kpisBeforeDraftDeletion = await request({ method: 'GET', url: '/api/orcamentos/kpis' });
    assert.equal(kpisBeforeDraftDeletion.statusCode, 200, kpisBeforeDraftDeletion.body);
    assert.equal(kpisBeforeDraftDeletion.json<{ total: number }>().total, 2);

    const deleteDraftResponse = await request({
      method: 'DELETE',
      url: `/api/orcamentos/${draftBudgetId}`
    });
    assert.equal(deleteDraftResponse.statusCode, 204, deleteDraftResponse.body);
    const kpisAfterDraftDeletion = await request({ method: 'GET', url: '/api/orcamentos/kpis' });
    const kpisAfterDeletion = kpisAfterDraftDeletion.json<{
      total: number;
      totalApprovedCents: number;
      accountsReceivableCents: number;
      receivedCents: number;
    }>();
    assert.deepEqual({
      total: kpisAfterDeletion.total,
      totalApprovedCents: kpisAfterDeletion.totalApprovedCents,
      accountsReceivableCents: kpisAfterDeletion.accountsReceivableCents,
      receivedCents: kpisAfterDeletion.receivedCents
    }, {
      total: 1,
      totalApprovedCents: 10_001,
      accountsReceivableCents: 10_001,
      receivedCents: 0
    });

    const firstReceiptResponse = await request({
      method: 'POST',
      url: `/api/financeiro/parcelas/${installmentId}/recebimentos`,
      payload: {
        valorPrincipal: 3_333,
        juros: 2,
        desconto: 1,
        dataRecebimento: currentDate
      }
    });
    assert.equal(firstReceiptResponse.statusCode, 201, firstReceiptResponse.body);
    const firstReceipt = firstReceiptResponse.json<{
      recebimento: { id: string; valorRecebido: number };
      parcela: { statusPagamento: string };
    }>();
    assert.equal(firstReceipt.recebimento.valorRecebido, 3_334);
    assert.equal(firstReceipt.parcela.statusPagamento, 'Parcialmente pago');

    const secondReceiptResponse = await request({
      method: 'POST',
      url: `/api/financeiro/parcelas/${installmentId}/recebimentos`,
      payload: {
        valorPrincipal: 6_668,
        dataRecebimento: currentDate
      }
    });
    assert.equal(secondReceiptResponse.statusCode, 201, secondReceiptResponse.body);
    const secondSettlement = secondReceiptResponse.json<{
      parcela: { valorPago: number; statusPagamento: string };
    }>().parcela;
    assert.equal(secondSettlement.valorPago, 10_001);
    assert.equal(secondSettlement.statusPagamento, 'Pago');

    const overpaymentResponse = await request({
      method: 'POST',
      url: `/api/financeiro/parcelas/${installmentId}/recebimentos`,
      payload: { valorPrincipal: 1, dataRecebimento: currentDate }
    });
    assert.equal(overpaymentResponse.statusCode, 409, overpaymentResponse.body);

    const paidKpisResponse = await request({ method: 'GET', url: '/api/orcamentos/kpis' });
    const paidKpis = paidKpisResponse.json<{ accountsReceivableCents: number; receivedCents: number }>();
    assert.deepEqual({
      accountsReceivableCents: paidKpis.accountsReceivableCents,
      receivedCents: paidKpis.receivedCents
    }, { accountsReceivableCents: 0, receivedCents: 10_002 });

    const reversalResponse = await request({
      method: 'POST',
      url: `/api/financeiro/recebimentos/${firstReceipt.recebimento.id}/estorno`,
      payload: { motivo: 'Estorno simulado para validar os indicadores', dataEstorno: currentDate }
    });
    assert.equal(reversalResponse.statusCode, 200, reversalResponse.body);
    const reversedSettlement = reversalResponse.json<{
      parcela: { valorPago: number; statusPagamento: string };
    }>().parcela;
    assert.equal(reversedSettlement.valorPago, 6_668);
    assert.equal(reversedSettlement.statusPagamento, 'Parcialmente pago');

    const reversedKpisResponse = await request({ method: 'GET', url: '/api/orcamentos/kpis' });
    const reversedKpis = reversedKpisResponse.json<{
      accountsReceivableCents: number;
      receivedCents: number;
    }>();
    assert.deepEqual({
      accountsReceivableCents: reversedKpis.accountsReceivableCents,
      receivedCents: reversedKpis.receivedCents
    }, { accountsReceivableCents: 3_333, receivedCents: 6_668 });

    const pendingExpenseResponse = await request({
      method: 'POST',
      url: '/api/financeiro/despesas',
      payload: {
        clienteId: clientId,
        projetoId: projectId,
        descricao: 'Despesa pendente removível',
        valor: 1_234,
        data: currentDate,
        categoria: 'Documentos',
        status: 'Pendente'
      }
    });
    assert.equal(pendingExpenseResponse.statusCode, 200, pendingExpenseResponse.body);
    const pendingSummaryResponse = await request({ method: 'GET', url: '/api/financeiro/resumo-gerencial' });
    assert.equal(pendingSummaryResponse.json<{ kpis: { contasAPagar: number } }>().kpis.contasAPagar, 1_234);

    const deletePendingExpenseResponse = await request({
      method: 'DELETE',
      url: `/api/financeiro/despesas/${pendingExpenseResponse.json<{ id: string }>().id}`
    });
    assert.equal(deletePendingExpenseResponse.statusCode, 204, deletePendingExpenseResponse.body);
    const summaryAfterExpenseDeletion = await request({ method: 'GET', url: '/api/financeiro/resumo-gerencial' });
    assert.equal(summaryAfterExpenseDeletion.json<{ kpis: { contasAPagar: number } }>().kpis.contasAPagar, 0);

    const paidExpenseResponse = await request({
      method: 'POST',
      url: '/api/financeiro/despesas',
      payload: {
        clienteId: clientId,
        projetoId: projectId,
        descricao: 'Despesa paga com centavos',
        valor: 2_001,
        data: currentDate,
        dataPagamento: currentDate,
        categoria: 'Viagem e transporte',
        status: 'Pago'
      }
    });
    assert.equal(paidExpenseResponse.statusCode, 200, paidExpenseResponse.body);

    const paidExpenseSummaryResponse = await request({ method: 'GET', url: '/api/financeiro/resumo-gerencial' });
    assert.equal(paidExpenseSummaryResponse.json<{ kpis: { despesasPagas: number } }>().kpis.despesasPagas, 2_001);
    const monthlyBeforeExpenseReversal = await request({ method: 'GET', url: '/api/financeiro/resumo-mensal' });
    assert.equal(
      monthlyBeforeExpenseReversal.json<Array<{ mes: string; despesas: number }>>()
        .find((entry) => entry.mes === currentMonth)?.despesas,
      2_001
    );

    const paidExpenseId = paidExpenseResponse.json<{ id: string }>().id;
    const deletePaidExpenseResponse = await request({
      method: 'DELETE',
      url: `/api/financeiro/despesas/${paidExpenseId}`
    });
    assert.equal(deletePaidExpenseResponse.statusCode, 409, deletePaidExpenseResponse.body);
    const expenseReversalResponse = await request({
      method: 'POST',
      url: `/api/financeiro/despesas/${paidExpenseId}/estorno`,
      payload: { motivo: 'Estorno simulado da despesa paga', dataEstorno: currentDate }
    });
    assert.equal(expenseReversalResponse.statusCode, 200, expenseReversalResponse.body);

    const summaryAfterExpenseReversal = await request({ method: 'GET', url: '/api/financeiro/resumo-gerencial' });
    assert.equal(summaryAfterExpenseReversal.json<{ kpis: { despesasPagas: number } }>().kpis.despesasPagas, 0);
    const monthlyAfterExpenseReversal = await request({ method: 'GET', url: '/api/financeiro/resumo-mensal' });
    assert.equal(
      monthlyAfterExpenseReversal.json<Array<{ mes: string; despesas: number }>>()
        .find((entry) => entry.mes === currentMonth)?.despesas,
      0
    );

    const cancelProjectResponse = await request({
      method: 'PATCH',
      url: `/api/projetos/${projectId}`,
      payload: { status: 'Cancelado' }
    });
    assert.equal(cancelProjectResponse.statusCode, 200, cancelProjectResponse.body);
    const cancelInstallmentsResponse = await request({
      method: 'POST',
      url: `/api/projetos/${projectId}/decisao-financeira`,
      payload: {
        tipo: 'cancelar_parcelas_futuras',
        motivo: 'Cancelamento simulado do saldo futuro do contrato'
      }
    });
    assert.equal(cancelInstallmentsResponse.statusCode, 201, cancelInstallmentsResponse.body);

    const finalKpisResponse = await request({ method: 'GET', url: '/api/orcamentos/kpis' });
    const finalKpis = finalKpisResponse.json<{ accountsReceivableCents: number; receivedCents: number }>();
    assert.deepEqual({
      accountsReceivableCents: finalKpis.accountsReceivableCents,
      receivedCents: finalKpis.receivedCents
    }, { accountsReceivableCents: 0, receivedCents: 6_668 });

    const finalProjectContextResponse = await request({
      method: 'GET',
      url: `/api/projetos/${projectId}/contexto-financeiro`
    });
    assert.equal(finalProjectContextResponse.statusCode, 200, finalProjectContextResponse.body);
    const finalProjectContext = finalProjectContextResponse.json<{
      saldoAberto: number;
      parcelas: Array<{ canceladaEm: string | null }>;
    }>();
    assert.equal(finalProjectContext.saldoAberto, 0);
    assert.ok(finalProjectContext.parcelas.some((installment) => Boolean(installment.canceladaEm)));
  } finally {
    await server.close();
    const client = (db as unknown as { $client: { close: () => void } }).$client;
    client.close();
    await removeTestDatabase();
  }
});
