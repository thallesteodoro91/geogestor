import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFinancialAnalytics, getParcelaStatusFiscal } from './financialAnalytics';

test('KPIs usam caixa recebido, saldo principal e ignoram despesas canceladas ou estornadas', () => {
  const analytics = buildFinancialAnalytics({
    now: new Date(2026, 6, 25),
    clientes: [{ id: 'cliente-1', nome: 'Cliente 1' }],
    projetos: [{ id: 'projeto-1', nome: 'Projeto 1', clienteId: 'cliente-1' }],
    orcamentos: [
      {
        id: 'orcamento-1',
        clienteId: 'cliente-1',
        status: 'Aprovado',
        valorTotal: 100_000,
        dataOrcamento: '2026-07-01',
        possuiImposto: true,
        impostoPorcentagem: 10
      },
      { id: 'orcamento-2', clienteId: 'cliente-1', status: 'Rejeitado', valorTotal: 80_000, dataOrcamento: '2026-07-02' },
      { id: 'orcamento-3', clienteId: 'cliente-1', status: 'Expirado', valorTotal: 60_000, dataOrcamento: '2026-07-03' },
      { id: 'orcamento-4', clienteId: 'cliente-1', status: 'Rascunho', valorTotal: 50_000, dataOrcamento: '2026-07-04' }
    ],
    parcelas: [
      {
        id: 'parcela-1',
        orcamentoId: 'orcamento-1',
        clienteId: 'cliente-1',
        valor: 100_000,
        valorPago: 40_000,
        recebidoCaixa: 43_000,
        dataVencimento: '2026-07-30',
        dataPagamento: '2026-07-20',
        statusPagamento: 'Parcial'
      }
    ],
    despesas: [
      {
        id: 'despesa-paga',
        projetoId: 'projeto-1',
        valor: 20_000,
        data: '2026-07-10',
        dataPagamento: '2026-07-10',
        categoria: 'Combustível',
        categoriaCodigo: 'combustivel',
        status: 'Pago'
      },
      {
        id: 'despesa-aberta',
        projetoId: 'projeto-1',
        valor: 10_000,
        data: '2026-07-24',
        categoria: 'Cartório',
        categoriaCodigo: 'cartorio_taxas',
        status: 'Pendente'
      },
      {
        id: 'despesa-cancelada',
        projetoId: 'projeto-1',
        valor: 90_000,
        data: '2026-07-11',
        categoria: 'Outros',
        status: 'Pago',
        canceladaEm: '2026-07-12T12:00:00.000Z'
      }
    ]
  });

  assert.equal(analytics.kpis.receitaContratada, 100_000);
  assert.equal(analytics.kpis.receitaRecebida, 43_000);
  assert.equal(analytics.kpis.receitaPendente, 60_000);
  assert.equal(analytics.kpis.impostosEstimados, 10_000);
  assert.equal(analytics.kpis.despesasLancadas, 30_000);
  assert.equal(analytics.kpis.despesasPagas, 20_000);
  assert.equal(analytics.kpis.resultadoCaixa, 23_000);
  assert.equal(Math.round(analytics.kpis.taxaConversao * 10) / 10, 33.3);
  assert.equal(analytics.clientes[0]?.resultado, 23_000);
});

test('pagamento parcial vencido vira atrasado e registros sem data não entram em período filtrado', () => {
  assert.equal(getParcelaStatusFiscal({
    id: 'parcela',
    orcamentoId: 'orcamento',
    valor: 50_000,
    valorPago: 10_000,
    dataVencimento: '2026-06-30',
    statusPagamento: 'Parcial'
  }, '2026-07-25'), 'Atrasado');

  const analytics = buildFinancialAnalytics({
    now: new Date(2026, 6, 25),
    filters: { dataInicio: '2026-07-01', dataFim: '2026-07-31' },
    orcamentos: [{ id: 'sem-data', clienteId: 'cliente', status: 'Aprovado', valorTotal: 100_000 }],
    parcelas: [],
    despesas: [{ id: 'sem-data', valor: 50_000, status: 'Pendente' }]
  });

  assert.equal(analytics.orcamentos.length, 0);
  assert.equal(analytics.despesas.length, 0);
  assert.equal(analytics.kpis.receitaContratada, 0);
  assert.equal(analytics.kpis.despesasLancadas, 0);
});

test('recebimentos parciais entram no mês real de cada baixa', () => {
  const analytics = buildFinancialAnalytics({
    now: new Date(2026, 7, 15),
    orcamentos: [{ id: 'orcamento-parcial', clienteId: 'cliente', status: 'Aprovado', valorTotal: 100_000, dataOrcamento: '2026-05-01' }],
    parcelas: [{
      id: 'parcela-parcial',
      orcamentoId: 'orcamento-parcial',
      clienteId: 'cliente',
      valor: 100_000,
      valorPago: 100_000,
      recebidoCaixa: 100_000,
      dataVencimento: '2026-08-10',
      dataPagamento: '2026-08-05',
      statusPagamento: 'Pago',
      recebimentos: [
        { valorRecebido: 40_000, dataRecebimento: '2026-06-20' },
        { valorRecebido: 60_000, dataRecebimento: '2026-07-18' }
      ]
    }],
    despesas: []
  });

  assert.equal(analytics.kpis.receitaRecebida, 100_000);
  assert.equal(analytics.monthly.find(item => item.mes === '2026-06')?.receitaRecebida, 40_000);
  assert.equal(analytics.monthly.find(item => item.mes === '2026-07')?.receitaRecebida, 60_000);
  assert.equal(analytics.monthly.find(item => item.mes === '2026-08')?.receitaRecebida, 0);
});
