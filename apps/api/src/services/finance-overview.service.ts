import { normalizeBudgetStatus } from '@geogestor/contracts';
import { schema } from '@geogestor/database';

type Budget = typeof schema.orcamentos.$inferSelect & { clienteNome?: string | null; projetoNome?: string | null };
type Installment = typeof schema.parcelas.$inferSelect & {
  clienteId?: string | null;
  clienteNome?: string | null;
  orcamentoDescricao?: string | null;
  recebimentos: Array<{ valorRecebido: number; dataRecebimento: string }>;
};
type Expense = typeof schema.despesas.$inferSelect & { clienteNome?: string | null; projetoNome?: string | null };
type Filters = { dataInicio?: string; dataFim?: string; clienteId?: string; categoria?: string; tipoCusto?: string; centroCusto?: string };

const normalizeText = (value?: string | null) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
const paid = (value?: string | null) => normalizeText(value) === 'pago';
const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function dateInRange(value: string | null | undefined, filters: Filters) {
  if (!value) return !filters.dataInicio && !filters.dataFim;
  const key = value.slice(0, 10);
  return (!filters.dataInicio || key >= filters.dataInicio) && (!filters.dataFim || key <= filters.dataFim);
}

function expenseStatus(expense: Expense, today: string) {
  if (paid(expense.status)) return 'Pago';
  return expense.data.slice(0, 10) < today ? 'Atrasado' : 'Pendente';
}

function installmentStatus(installment: Installment, today: string) {
  if (paid(installment.statusPagamento)) return 'Pago';
  if (installment.valorPago > 0) return installment.dataVencimento.slice(0, 10) < today ? 'Atrasado' : 'Parcialmente pago';
  return installment.dataVencimento.slice(0, 10) < today ? 'Atrasado' : 'Pendente';
}

function inferredCostType(expense: Expense) {
  if (expense.reembolsavel) return 'Reembolsável';
  if (expense.categoriaCodigo === 'cartorio_taxas') return 'Cartório e taxas';
  if (expense.categoriaCodigo === 'tributos') return 'Tributário';
  if (expense.tipoCusto) return expense.tipoCusto;
  const category = normalizeText(expense.categoria);
  if (category.includes('cart') || category.includes('emolumento') || category.includes('taxa')) return 'Cartório e taxas';
  if (category.includes('imposto') || category.includes('tribut')) return 'Tributário';
  if (['software', 'licenca', 'salario', 'folha', 'internet', 'aluguel'].some((term) => category.includes(term))) return 'Fixo';
  if (['combust', 'viagem', 'aliment', 'hosped'].some((term) => category.includes(term))) return 'Variável de campo';
  return 'Operacional';
}

function monthPoints(now = new Date()) {
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    return {
      mes: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: labels[date.getMonth()],
      receitaContratada: 0,
      receitaRecebida: 0,
      despesasLancadas: 0,
      despesasPagas: 0,
      resultadoCaixa: 0,
      resultadoCompetencia: 0
    };
  });
}

export function buildFinanceOverview(input: {
  budgets: Budget[];
  installments: Installment[];
  expenses: Expense[];
  clients: Array<{ id: string; nome: string }>;
  filters: Filters;
}) {
  const today = localDateKey();
  const clientsById = new Map(input.clients.map((item) => [item.id, item.nome]));
  const allBudgetsById = new Map(input.budgets.map((item) => [item.id, item]));
  const budgets = input.budgets.filter((item) =>
    dateInRange(item.dataCompetencia || item.dataOrcamento || item.createdAt, input.filters)
    && (!input.filters.clienteId || item.clienteId === input.filters.clienteId)
    && (!input.filters.centroCusto || normalizeText(item.centroCusto) === normalizeText(input.filters.centroCusto))
  );
  const installments = input.installments.filter((item) =>
    normalizeBudgetStatus(allBudgetsById.get(item.orcamentoId)?.status || '') === 'aprovado'
    && (dateInRange(item.dataPagamento || item.dataVencimento, input.filters)
      || item.recebimentos.some((receipt) => dateInRange(receipt.dataRecebimento, input.filters)))
    && (!input.filters.clienteId || item.clienteId === input.filters.clienteId)
  );
  const expenses = input.expenses.filter((item) =>
    dateInRange(item.dataPagamento || item.dataCompetencia || item.data, input.filters)
    && (!input.filters.clienteId || item.clienteId === input.filters.clienteId)
    && (!input.filters.categoria || item.categoria === input.filters.categoria)
    && (!input.filters.tipoCusto || normalizeText(inferredCostType(item)) === normalizeText(input.filters.tipoCusto))
    && (!input.filters.centroCusto || normalizeText(item.centroCusto) === normalizeText(input.filters.centroCusto))
  );

  const approved = budgets.filter((item) => normalizeBudgetStatus(item.status) === 'aprovado');
  const approvedIds = new Set(approved.map((item) => item.id));
  const installmentsByBudget = new Set(installments.map((item) => item.orcamentoId));
  const approvedWithoutInstallments = approved.filter((item) => !installmentsByBudget.has(item.id));
  const paidWithoutInstallments = approvedWithoutInstallments.filter((item) => paid(item.status));
  const pipeline = budgets.filter((item) => !['aprovado', 'rejeitado', 'expirado', 'substituido'].includes(normalizeBudgetStatus(item.status)));

  const contractedRevenue = approved.reduce((sum, item) => sum + item.valorTotal, 0);
  const receivedForInstallment = (item: Installment) => {
    if (item.recebimentos.length) return item.recebimentos
      .filter((receipt) => dateInRange(receipt.dataRecebimento, input.filters))
      .reduce((sum, receipt) => sum + receipt.valorRecebido, 0);
    return item.valorPago || 0;
  };
  const receiptRevenue = installments.reduce((sum, item) => {
    return sum + receivedForInstallment(item);
  }, 0);
  const receivedRevenue = receiptRevenue + paidWithoutInstallments.reduce((sum, item) => sum + item.valorTotal, 0);
  const pendingRevenue = installments
    .filter((item) => installmentStatus(item, today) !== 'Pago' && installmentStatus(item, today) !== 'Atrasado')
    .reduce((sum, item) => sum + Math.max(0, item.valor - item.valorPago), 0)
    + approvedWithoutInstallments.filter((item) => !paid(item.status)).reduce((sum, item) => sum + item.valorTotal, 0);
  const overdueRevenue = installments.filter((item) => installmentStatus(item, today) === 'Atrasado')
    .reduce((sum, item) => sum + Math.max(0, item.valor - item.valorPago), 0);
  const launchedExpenses = expenses.reduce((sum, item) => sum + item.valor, 0);
  const paidExpenses = expenses.filter((item) => expenseStatus(item, today) === 'Pago').reduce((sum, item) => sum + item.valor, 0);
  const overdueExpenses = expenses.filter((item) => expenseStatus(item, today) === 'Atrasado').reduce((sum, item) => sum + item.valor, 0);
  const fixedCosts = expenses.filter((item) => normalizeText(inferredCostType(item)) === 'fixo').reduce((sum, item) => sum + item.valor, 0);
  const taxCosts = expenses.filter((item) => normalizeText(inferredCostType(item)) === 'tributario').reduce((sum, item) => sum + item.valor, 0);
  const variableCosts = launchedExpenses - fixedCosts - taxCosts;
  const estimatedTaxes = approved.reduce((sum, item) => sum + (item.impostosPrevistos || item.impostoValor || 0), 0);
  const netRevenue = Math.max(0, contractedRevenue - estimatedTaxes);
  const cashResult = receivedRevenue - paidExpenses;
  const contributionValue = netRevenue - variableCosts;
  const competenceResult = contributionValue - fixedCosts;
  const contributionMargin = netRevenue > 0 ? contributionValue / netRevenue * 100 : 0;

  const monthly = monthPoints();
  const months = new Map(monthly.map((item) => [item.mes, item]));
  const addMonth = (date: string | null | undefined, field: 'receitaContratada' | 'receitaRecebida' | 'despesasLancadas' | 'despesasPagas', value: number) => {
    const point = date ? months.get(date.slice(0, 7)) : undefined;
    if (point) point[field] += value;
  };
  approved.forEach((item) => addMonth(item.dataCompetencia || item.dataOrcamento || item.createdAt, 'receitaContratada', item.valorTotal));
  paidWithoutInstallments.forEach((item) => addMonth(item.dataPagamento || item.dataOrcamento || item.createdAt, 'receitaRecebida', item.valorTotal));
  installments.forEach((item) => {
    if (item.recebimentos.length) item.recebimentos
      .filter((receipt) => dateInRange(receipt.dataRecebimento, input.filters))
      .forEach((receipt) => addMonth(receipt.dataRecebimento, 'receitaRecebida', receipt.valorRecebido));
    else if (item.valorPago > 0) addMonth(item.dataPagamento || item.dataVencimento, 'receitaRecebida', item.valorPago);
  });
  expenses.forEach((item) => {
    addMonth(item.dataCompetencia || item.data, 'despesasLancadas', item.valor);
    if (expenseStatus(item, today) === 'Pago') addMonth(item.dataPagamento || item.data, 'despesasPagas', item.valor);
  });
  monthly.forEach((item) => {
    item.resultadoCaixa = item.receitaRecebida - item.despesasPagas;
    item.resultadoCompetencia = item.receitaContratada - item.despesasLancadas;
  });

  const categoryMap = new Map<string, { categoria: string; total: number; pago: number; aberto: number; count: number; percentual: number }>();
  expenses.forEach((item) => {
    const category = item.categoria || 'Sem categoria';
    const current = categoryMap.get(category) || { categoria: category, total: 0, pago: 0, aberto: 0, count: 0, percentual: 0 };
    current.total += item.valor;
    current.count += 1;
    if (expenseStatus(item, today) === 'Pago') current.pago += item.valor;
    else current.aberto += item.valor;
    categoryMap.set(category, current);
  });
  const categories = [...categoryMap.values()].map((item) => ({ ...item, percentual: launchedExpenses ? item.total / launchedExpenses * 100 : 0 })).sort((a, b) => b.total - a.total);

  const clientMap = new Map<string, { clienteId: string; cliente: string; receitaContratada: number; receitaRecebida: number; despesas: number; resultado: number; margem: number }>();
  const ensureClient = (id?: string | null, fallback?: string | null) => {
    const key = id || 'sem-cliente';
    const value = clientMap.get(key) || { clienteId: key, cliente: fallback || (id ? clientsById.get(id) : null) || 'Sem cliente vinculado', receitaContratada: 0, receitaRecebida: 0, despesas: 0, resultado: 0, margem: 0 };
    clientMap.set(key, value);
    return value;
  };
  approved.forEach((item) => { ensureClient(item.clienteId, item.clienteNome).receitaContratada += item.valorTotal; });
  installments.forEach((item) => { ensureClient(item.clienteId, item.clienteNome).receitaRecebida += receivedForInstallment(item); });
  paidWithoutInstallments.forEach((item) => { ensureClient(item.clienteId, item.clienteNome).receitaRecebida += item.valorTotal; });
  expenses.filter((item) => expenseStatus(item, today) === 'Pago').forEach((item) => { ensureClient(item.clienteId, item.clienteNome).despesas += item.valor; });
  const clientProfitability = [...clientMap.values()].map((item) => ({ ...item, resultado: item.receitaRecebida - item.despesas, margem: item.receitaRecebida ? (item.receitaRecebida - item.despesas) / item.receitaRecebida * 100 : 0 })).sort((a, b) => b.resultado - a.resultado);

  const missingClientExpenses = expenses.filter((item) => !item.clienteId).length;
  const alerts: Array<{ tipo: 'critico' | 'atencao' | 'info'; titulo: string; descricao: string }> = [];
  if (overdueRevenue > 0) alerts.push({ tipo: 'critico', titulo: 'Recebimentos atrasados', descricao: `${currency(overdueRevenue)} em parcelas vencidas e ainda não recebidas.` });
  if (overdueExpenses > 0) alerts.push({ tipo: 'critico', titulo: 'Contas vencidas', descricao: `${currency(overdueExpenses)} em despesas vencidas ou sem baixa.` });
  if (approvedWithoutInstallments.length) alerts.push({ tipo: 'atencao', titulo: 'Orçamentos aprovados sem parcelas', descricao: `${approvedWithoutInstallments.length} orçamento(s) aprovado(s) não possuem cronograma de recebimento.` });
  if (missingClientExpenses) alerts.push({ tipo: 'info', titulo: 'Despesas sem cliente/projeto', descricao: `${missingClientExpenses} lançamento(s) ficaram como administrativo/geral. Isso reduz precisão de lucro por cliente.` });
  if (contractedRevenue > 0 && launchedExpenses === 0) alerts.push({ tipo: 'atencao', titulo: 'Resultado sem custos lançados', descricao: 'Há receita contratada, mas nenhuma despesa no período. O lucro pode estar artificialmente alto.' });

  const recentEntries = [
    ...installments.map((item) => ({ id: `receita-${item.id}`, type: 'receita' as const, title: item.orcamentoDescricao || 'Parcela a receber', context: item.clienteNome || 'Cliente não informado', date: (item.dataPagamento || item.dataVencimento).slice(0, 10), status: installmentStatus(item, today), amount: item.valor, tab: 'faturas' as const })),
    ...expenses.map((item) => ({ id: `despesa-${item.id}`, type: 'despesa' as const, title: item.descricao || item.categoria || 'Despesa', context: [item.clienteNome, item.projetoNome || item.fornecedor].filter(Boolean).join(' · ') || 'Administrativo / geral', date: (item.dataPagamento || item.dataCompetencia || item.data).slice(0, 10), status: expenseStatus(item, today), amount: item.valor, tab: 'pagar' as const }))
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 6);

  const openInstallments = installments.filter((item) => installmentStatus(item, today) !== 'Pago');
  return {
    analytics: {
      monthly,
      categorias: categories,
      clientes: clientProfitability,
      kpis: {
        receitaContratada: contractedRevenue, receitaRecebida: receivedRevenue, receitaPendente: pendingRevenue,
        receitaAtrasada: overdueRevenue, receitaPipeline: pipeline.reduce((sum, item) => sum + item.valorTotal, 0),
        impostosEstimados: estimatedTaxes, receitaLiquidaEstimada: netRevenue, despesasLancadas: launchedExpenses,
        despesasPagas: paidExpenses, despesasAbertas: launchedExpenses - paidExpenses, despesasAtrasadas: overdueExpenses,
        custosFixos: fixedCosts, custosVariaveis: variableCosts,
        custosReembolsaveis: expenses.filter((item) => item.reembolsavel).reduce((sum, item) => sum + item.valor, 0),
        custosCartorioTaxas: expenses.filter((item) => normalizeText(inferredCostType(item)) === 'cartorio e taxas').reduce((sum, item) => sum + item.valor, 0),
        custosTributarios: taxCosts, resultadoCaixa: cashResult, resultadoCompetencia: competenceResult,
        margemCaixa: receivedRevenue ? cashResult / receivedRevenue * 100 : 0,
        margemCompetencia: contractedRevenue ? competenceResult / contractedRevenue * 100 : 0,
        margemContribuicao: contributionMargin, pontoEquilibrio: contributionMargin > 0 ? fixedCosts / (contributionMargin / 100) : 0,
        ticketMedioContratado: approved.length ? contractedRevenue / approved.length : 0,
        taxaConversao: budgets.length ? approved.length / budgets.length * 100 : 0,
        contasReceberCount: openInstallments.length,
        contasPagarCount: expenses.filter((item) => expenseStatus(item, today) !== 'Pago').length,
        orcamentosSemParcelas: approvedWithoutInstallments.length,
        despesasSemCliente: missingClientExpenses
      },
      alertas: alerts
    },
    recentEntries,
    meta: {
      launchCount: installments.length + expenses.length,
      expenseCount: expenses.length,
      hasSourceData: input.budgets.length > 0 || input.installments.length > 0 || input.expenses.length > 0,
      hasFilteredData: installments.length + expenses.length > 0,
      nextDueDate: openInstallments.filter((item) => item.dataVencimento >= today).sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))[0]?.dataVencimento.slice(0, 10) || '',
      openAccountCount: openInstallments.length + expenses.filter((item) => expenseStatus(item, today) !== 'Pago').length
    }
  };
}
