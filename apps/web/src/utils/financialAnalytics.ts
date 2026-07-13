export type OrcamentoFinanceiro = {
  id: string;
  clienteId: string;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
  status: string;
  valorTotal: number;
  dataOrcamento?: string | null;
  dataCompetencia?: string | null;
  dataPagamento?: string | null;
  createdAt?: string | null;
  possuiImposto?: boolean | number | null;
  impostoPorcentagem?: number | null;
  impostoValor?: number | null;
  impostoRetido?: boolean | number | null;
  centroCusto?: string | null;
  descricao?: string | null;
  codigoOrcamento?: string | null;
};

export type ParcelaFinanceira = {
  id: string;
  orcamentoId: string;
  clienteId?: string | null;
  clienteNome?: string | null;
  valor: number;
  dataVencimento: string;
  dataPagamento?: string | null;
  statusPagamento: string;
  orcamentoDescricao?: string | null;
};

export type DespesaFinanceira = {
  id: string;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
  descricao?: string | null;
  valor: number;
  data?: string | null;
  dataCompetencia?: string | null;
  dataPagamento?: string | null;
  categoria?: string | null;
  status: string;
  formaPagamento?: string | null;
  tipoCusto?: string | null;
  centroCusto?: string | null;
  reembolsavel?: boolean | number | null;
  fornecedor?: string | null;
  numeroDocumento?: string | null;
  comprovanteDocumentoId?: string | null;
};

export type ClienteFinanceiro = {
  id: string;
  nome: string;
};

export type ProjetoFinanceiro = {
  id: string;
  nome: string;
  clienteId?: string | null;
  clienteNome?: string | null;
};

export type FinancialFilters = {
  dataInicio?: string;
  dataFim?: string;
  clienteId?: string;
  categoria?: string;
  status?: string;
  tipoCusto?: string;
  centroCusto?: string;
  reembolsavel?: boolean;
};

export type MonthlyFinancialPoint = {
  mes: string;
  label: string;
  receitaContratada: number;
  receitaRecebida: number;
  despesasLancadas: number;
  despesasPagas: number;
  resultadoCaixa: number;
  resultadoCompetencia: number;
};

export type FinancialCategoryBreakdown = {
  categoria: string;
  total: number;
  pago: number;
  aberto: number;
  count: number;
  percentual: number;
};

export type FinancialClientBreakdown = {
  clienteId: string;
  cliente: string;
  receitaContratada: number;
  receitaRecebida: number;
  despesas: number;
  resultado: number;
  margem: number;
};

export type FinancialAnalytics = {
  orcamentos: OrcamentoFinanceiro[];
  parcelas: ParcelaFinanceira[];
  despesas: DespesaFinanceira[];
  monthly: MonthlyFinancialPoint[];
  categorias: FinancialCategoryBreakdown[];
  clientes: FinancialClientBreakdown[];
  kpis: {
    receitaContratada: number;
    receitaRecebida: number;
    receitaPendente: number;
    receitaAtrasada: number;
    receitaPipeline: number;
    impostosEstimados: number;
    receitaLiquidaEstimada: number;
    despesasLancadas: number;
    despesasPagas: number;
    despesasAbertas: number;
    despesasAtrasadas: number;
    custosFixos: number;
    custosVariaveis: number;
    custosReembolsaveis: number;
    custosCartorioTaxas: number;
    custosTributarios: number;
    resultadoCaixa: number;
    resultadoCompetencia: number;
    margemCaixa: number;
    margemCompetencia: number;
    margemContribuicao: number;
    pontoEquilibrio: number;
    ticketMedioContratado: number;
    taxaConversao: number;
    contasReceberCount: number;
    contasPagarCount: number;
    orcamentosSemParcelas: number;
    despesasSemCliente: number;
  };
  alertas: Array<{
    tipo: 'critico' | 'atencao' | 'info';
    titulo: string;
    descricao: string;
  }>;
};

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const normalizeText = (value?: string | null) =>
  (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const formatCurrencyFromCents = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);

export const formatPercent = (value: number, digits = 1) => `${(Number.isFinite(value) ? value : 0).toFixed(digits)}%`;

export const toLocalDateKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const getMonthKey = (dateValue?: string | null) => {
  if (!dateValue || dateValue.length < 7) return '';
  return dateValue.slice(0, 7);
};

const dateInRange = (dateValue: string | null | undefined, filters: FinancialFilters) => {
  if (!dateValue) return true;
  const key = dateValue.slice(0, 10);
  if (filters.dataInicio && key < filters.dataInicio) return false;
  if (filters.dataFim && key > filters.dataFim) return false;
  return true;
};

const monthRange = (months = 12, now = new Date()) => {
  const points: MonthlyFinancialPoint[] = [];
  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const mes = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    points.push({
      mes,
      label: MONTH_LABELS[date.getMonth()],
      receitaContratada: 0,
      receitaRecebida: 0,
      despesasLancadas: 0,
      despesasPagas: 0,
      resultadoCaixa: 0,
      resultadoCompetencia: 0,
    });
  }
  return points;
};

const isPago = (status?: string | null) => normalizeText(status) === 'pago';
const isAprovado = (status?: string | null) => {
  const normalized = normalizeText(status);
  return normalized === 'aprovado' || normalized === 'pago';
};
const isRejeitado = (status?: string | null) => {
  const normalized = normalizeText(status);
  return normalized === 'rejeitado' || normalized === 'cancelado' || normalized === 'perdido';
};

export const getParcelaStatusFiscal = (parcela: ParcelaFinanceira, todayKey = toLocalDateKey(new Date())) => {
  if (isPago(parcela.statusPagamento)) return 'Pago';
  return parcela.dataVencimento && parcela.dataVencimento.slice(0, 10) < todayKey ? 'Atrasado' : 'Pendente';
};

export const getDespesaStatusFiscal = (despesa: DespesaFinanceira, todayKey = toLocalDateKey(new Date())) => {
  if (isPago(despesa.status)) return 'Pago';
  return despesa.data && despesa.data.slice(0, 10) < todayKey ? 'Atrasado' : 'Pendente';
};

export const inferTipoCusto = (despesa: DespesaFinanceira) => {
  if (despesa.reembolsavel) return 'Reembolsável';
  if (despesa.tipoCusto) {
    const norm = normalizeText(despesa.tipoCusto);
    if (norm === 'variavel de campo') return 'Variável de campo';
    if (norm === 'cartorio e taxas') return 'Cartório e taxas';
    if (norm === 'tributario') return 'Tributário';
    if (norm === 'reembolsavel') return 'Reembolsável';
    return despesa.tipoCusto;
  }
  const categoria = normalizeText(despesa.categoria);
  if (categoria.includes('cart') || categoria.includes('emolumento') || categoria.includes('taxa')) return 'Cartório e taxas';
  if (categoria.includes('imposto') || categoria.includes('tribut')) return 'Tributário';
  if (
    categoria.includes('software') ||
    categoria.includes('licenca') ||
    categoria.includes('salario') ||
    categoria.includes('folha') ||
    categoria.includes('internet') ||
    categoria.includes('aluguel')
  ) {
    return 'Fixo';
  }
  if (
    categoria.includes('combust') ||
    categoria.includes('viagem') ||
    categoria.includes('aliment') ||
    categoria.includes('hosped')
  ) {
    return 'Variável de campo';
  }
  return 'Operacional';
};

const getOrcamentoImposto = (orcamento: OrcamentoFinanceiro) => {
  const explicitValue = Number(orcamento.impostoValor) || 0;
  if (explicitValue > 0) return explicitValue;
  const percent = Number(orcamento.impostoPorcentagem) || 0;
  if (!orcamento.possuiImposto || percent <= 0) return 0;
  return Math.round((Number(orcamento.valorTotal) || 0) * (percent / 100));
};

const getOrcamentoCompetenciaDate = (orcamento: OrcamentoFinanceiro) =>
  orcamento.dataCompetencia || orcamento.dataOrcamento || orcamento.createdAt;

const getOrcamentoCaixaDate = (orcamento: OrcamentoFinanceiro) =>
  orcamento.dataPagamento || orcamento.dataOrcamento || orcamento.createdAt;

const getDespesaCompetenciaDate = (despesa: DespesaFinanceira) =>
  despesa.dataCompetencia || despesa.data;

const getClienteIdFromDespesa = (despesa: DespesaFinanceira, projetoById: Map<string, ProjetoFinanceiro>) =>
  despesa.clienteId || (despesa.projetoId ? projetoById.get(despesa.projetoId)?.clienteId : undefined) || null;

const getClienteName = (
  clienteId: string | null | undefined,
  clienteById: Map<string, ClienteFinanceiro>,
  fallback?: string | null
) => fallback || (clienteId ? clienteById.get(clienteId)?.nome : undefined) || 'Sem cliente vinculado';

const addToMonth = (monthly: Map<string, MonthlyFinancialPoint>, monthKey: string, field: keyof MonthlyFinancialPoint, value: number) => {
  const point = monthly.get(monthKey);
  if (!point || typeof point[field] !== 'number') return;
  (point[field] as number) += value;
};

export function buildFinancialAnalytics(params: {
  orcamentos: OrcamentoFinanceiro[];
  parcelas: ParcelaFinanceira[];
  despesas: DespesaFinanceira[];
  clientes?: ClienteFinanceiro[];
  projetos?: ProjetoFinanceiro[];
  filters?: FinancialFilters;
  now?: Date;
}): FinancialAnalytics {
  const filters = params.filters || {};
  const todayKey = toLocalDateKey(params.now || new Date());
  const clienteById = new Map((params.clientes || []).map((cliente) => [cliente.id, cliente]));
  const projetoById = new Map((params.projetos || []).map((projeto) => [projeto.id, projeto]));

  const orcamentos = params.orcamentos.filter((orcamento) => {
    const dateValue = getOrcamentoCompetenciaDate(orcamento);
    if (!dateInRange(dateValue, filters)) return false;
    if (filters.clienteId && orcamento.clienteId !== filters.clienteId) return false;
    if (filters.status && filters.status !== 'Todos' && orcamento.status !== filters.status) return false;
    if (filters.centroCusto && filters.centroCusto !== 'Todos' && normalizeText(orcamento.centroCusto) !== normalizeText(filters.centroCusto)) return false;
    return true;
  });

  const parcelas = params.parcelas.filter((parcela) => {
    const dateValue = parcela.dataPagamento || parcela.dataVencimento;
    if (!dateInRange(dateValue, filters)) return false;
    if (filters.clienteId && parcela.clienteId !== filters.clienteId) return false;
    if (filters.status && filters.status !== 'Todos' && getParcelaStatusFiscal(parcela, todayKey) !== filters.status) return false;
    return true;
  });

  const despesas = params.despesas.filter((despesa) => {
    if (!dateInRange(despesa.dataPagamento || getDespesaCompetenciaDate(despesa), filters)) return false;
    if (filters.clienteId && getClienteIdFromDespesa(despesa, projetoById) !== filters.clienteId) return false;
    if (filters.categoria && filters.categoria !== 'Todas' && despesa.categoria !== filters.categoria) return false;
    if (filters.status && filters.status !== 'Todos' && getDespesaStatusFiscal(despesa, todayKey) !== filters.status) return false;
    if (filters.tipoCusto && filters.tipoCusto !== 'Todos' && normalizeText(inferTipoCusto(despesa)) !== normalizeText(filters.tipoCusto)) return false;
    if (filters.centroCusto && filters.centroCusto !== 'Todos' && normalizeText(despesa.centroCusto) !== normalizeText(filters.centroCusto)) return false;
    if (filters.reembolsavel !== undefined && Boolean(despesa.reembolsavel) !== filters.reembolsavel) return false;
    return true;
  });

  const parcelasByOrcamento = new Map<string, ParcelaFinanceira[]>();
  parcelas.forEach((parcela) => {
    const current = parcelasByOrcamento.get(parcela.orcamentoId) || [];
    current.push(parcela);
    parcelasByOrcamento.set(parcela.orcamentoId, current);
  });

  const orcamentosAprovados = orcamentos.filter((orcamento) => isAprovado(orcamento.status));
  const orcamentosPagosSemParcelas = orcamentos.filter((orcamento) => isPago(orcamento.status) && !parcelasByOrcamento.has(orcamento.id));
  const orcamentosAprovadosSemParcelas = orcamentos.filter((orcamento) => isAprovado(orcamento.status) && !parcelasByOrcamento.has(orcamento.id));
  const orcamentosPipeline = orcamentos.filter((orcamento) => !isAprovado(orcamento.status) && !isRejeitado(orcamento.status));

  const receitaContratada = orcamentosAprovados.reduce((sum, item) => sum + (Number(item.valorTotal) || 0), 0);
  const receitaPipeline = orcamentosPipeline.reduce((sum, item) => sum + (Number(item.valorTotal) || 0), 0);
  const receitaRecebidaParcelas = parcelas
    .filter((parcela) => getParcelaStatusFiscal(parcela, todayKey) === 'Pago')
    .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const receitaRecebidaOrcamentos = orcamentosPagosSemParcelas.reduce((sum, item) => sum + (Number(item.valorTotal) || 0), 0);
  const receitaRecebida = receitaRecebidaParcelas + receitaRecebidaOrcamentos;
  const receitaPendenteParcelas = parcelas
    .filter((parcela) => getParcelaStatusFiscal(parcela, todayKey) === 'Pendente')
    .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const receitaAtrasada = parcelas
    .filter((parcela) => getParcelaStatusFiscal(parcela, todayKey) === 'Atrasado')
    .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const receitaPendenteSemParcelas = orcamentosAprovadosSemParcelas
    .filter((orcamento) => !isPago(orcamento.status))
    .reduce((sum, item) => sum + (Number(item.valorTotal) || 0), 0);
  const receitaPendente = receitaPendenteParcelas + receitaPendenteSemParcelas;

  const despesasLancadas = despesas.reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const despesasPagas = despesas
    .filter((despesa) => getDespesaStatusFiscal(despesa, todayKey) === 'Pago')
    .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const despesasAtrasadas = despesas
    .filter((despesa) => getDespesaStatusFiscal(despesa, todayKey) === 'Atrasado')
    .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const despesasAbertas = despesasLancadas - despesasPagas;

  const custosFixos = despesas
    .filter((despesa) => normalizeText(inferTipoCusto(despesa)) === 'fixo')
    .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const custosReembolsaveis = despesas
    .filter((despesa) => Boolean(despesa.reembolsavel) || normalizeText(inferTipoCusto(despesa)) === 'reembolsavel')
    .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const custosCartorioTaxas = despesas
    .filter((despesa) => normalizeText(inferTipoCusto(despesa)) === 'cartorio e taxas')
    .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
  const custosTributarios = despesas
    .filter((despesa) => normalizeText(inferTipoCusto(despesa)) === 'tributario')
    .reduce((sum, item) => sum + (Number(item.valor) || 0), 0);
    
  // Custos Variáveis são todas as despesas exceto as fixas e tributárias
  const custosVariaveis = despesasLancadas - custosFixos - custosTributarios;

  // Os impostos estimados via orçamento servem de base, mas se o usuário já lançou despesas tributárias maiores, usamos elas
  const impostosEstimados = orcamentosAprovados.reduce((sum, orcamento) => sum + getOrcamentoImposto(orcamento), 0);
  const impostosTotais = Math.max(impostosEstimados, custosTributarios);

  const receitaLiquidaEstimada = Math.max(0, receitaContratada - impostosTotais);
  const margemContribuicaoValor = receitaLiquidaEstimada - custosVariaveis;
  
  const resultadoCaixa = receitaRecebida - despesasPagas;
  
  // O Resultado de Competência (Lucro Operacional / EBITDA) é a Margem de Contribuição menos Custos Fixos
  const resultadoCompetencia = margemContribuicaoValor - custosFixos;
  
  const margemCaixa = receitaRecebida > 0 ? (resultadoCaixa / receitaRecebida) * 100 : 0;
  const margemCompetencia = receitaContratada > 0 ? (resultadoCompetencia / receitaContratada) * 100 : 0;
  const margemContribuicao = receitaLiquidaEstimada > 0 ? (margemContribuicaoValor / receitaLiquidaEstimada) * 100 : 0;
  const pontoEquilibrio = margemContribuicao > 0 ? custosFixos / (margemContribuicao / 100) : 0;
  
  const ticketMedioContratado = orcamentosAprovados.length > 0 ? receitaContratada / orcamentosAprovados.length : 0;
  const taxaConversao = orcamentos.length > 0 ? (orcamentosAprovados.length / orcamentos.length) * 100 : 0;

  const monthlyArray = monthRange(12, params.now || new Date());
  const monthlyMap = new Map(monthlyArray.map((item) => [item.mes, item]));

  orcamentosAprovados.forEach((orcamento) => {
    addToMonth(monthlyMap, getMonthKey(getOrcamentoCompetenciaDate(orcamento)), 'receitaContratada', orcamento.valorTotal || 0);
  });

  orcamentosPagosSemParcelas.forEach((orcamento) => {
    addToMonth(monthlyMap, getMonthKey(getOrcamentoCaixaDate(orcamento)), 'receitaRecebida', orcamento.valorTotal || 0);
  });

  parcelas
    .filter((parcela) => getParcelaStatusFiscal(parcela, todayKey) === 'Pago')
    .forEach((parcela) => {
      addToMonth(monthlyMap, getMonthKey(parcela.dataPagamento || parcela.dataVencimento), 'receitaRecebida', parcela.valor || 0);
    });

  despesas.forEach((despesa) => {
    addToMonth(monthlyMap, getMonthKey(getDespesaCompetenciaDate(despesa)), 'despesasLancadas', despesa.valor || 0);
    if (getDespesaStatusFiscal(despesa, todayKey) === 'Pago') {
      addToMonth(monthlyMap, getMonthKey(despesa.dataPagamento || despesa.data), 'despesasPagas', despesa.valor || 0);
    }
  });

  monthlyArray.forEach((item) => {
    item.resultadoCaixa = item.receitaRecebida - item.despesasPagas;
    item.resultadoCompetencia = item.receitaContratada - item.despesasLancadas;
  });

  const categoryTotals = new Map<string, FinancialCategoryBreakdown>();
  despesas.forEach((despesa) => {
    const categoria = despesa.categoria || 'Sem categoria';
    const status = getDespesaStatusFiscal(despesa, todayKey);
    const current = categoryTotals.get(categoria) || {
      categoria,
      total: 0,
      pago: 0,
      aberto: 0,
      count: 0,
      percentual: 0,
    };
    current.total += despesa.valor || 0;
    current.count += 1;
    if (status === 'Pago') current.pago += despesa.valor || 0;
    else current.aberto += despesa.valor || 0;
    categoryTotals.set(categoria, current);
  });

  const categorias = Array.from(categoryTotals.values())
    .map((item) => ({
      ...item,
      percentual: despesasLancadas > 0 ? (item.total / despesasLancadas) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const clientTotals = new Map<string, FinancialClientBreakdown>();
  const ensureClient = (clienteId: string | null | undefined, fallback?: string | null) => {
    const id = clienteId || 'sem-cliente';
    const current = clientTotals.get(id) || {
      clienteId: id,
      cliente: getClienteName(clienteId, clienteById, fallback),
      receitaContratada: 0,
      receitaRecebida: 0,
      despesas: 0,
      resultado: 0,
      margem: 0,
    };
    clientTotals.set(id, current);
    return current;
  };

  orcamentosAprovados.forEach((orcamento) => {
    const current = ensureClient(orcamento.clienteId, orcamento.clienteNome);
    current.receitaContratada += orcamento.valorTotal || 0;
  });

  parcelas
    .filter((parcela) => getParcelaStatusFiscal(parcela, todayKey) === 'Pago')
    .forEach((parcela) => {
      const current = ensureClient(parcela.clienteId, parcela.clienteNome);
      current.receitaRecebida += parcela.valor || 0;
    });

  orcamentosPagosSemParcelas.forEach((orcamento) => {
    const current = ensureClient(orcamento.clienteId, orcamento.clienteNome);
    current.receitaRecebida += orcamento.valorTotal || 0;
  });

  despesas.forEach((despesa) => {
    const clienteId = getClienteIdFromDespesa(despesa, projetoById);
    const current = ensureClient(clienteId);
    current.despesas += despesa.valor || 0;
  });

  const clientes = Array.from(clientTotals.values())
    .map((item) => ({
      ...item,
      resultado: item.receitaRecebida - item.despesas,
      margem: item.receitaRecebida > 0 ? ((item.receitaRecebida - item.despesas) / item.receitaRecebida) * 100 : 0,
    }))
    .sort((a, b) => b.resultado - a.resultado);

  const contasReceberCount = parcelas.filter((parcela) => getParcelaStatusFiscal(parcela, todayKey) !== 'Pago').length;
  const contasPagarCount = despesas.filter((despesa) => getDespesaStatusFiscal(despesa, todayKey) !== 'Pago').length;
  const despesasSemCliente = despesas.filter((despesa) => !getClienteIdFromDespesa(despesa, projetoById)).length;

  const alertas: FinancialAnalytics['alertas'] = [];
  if (receitaAtrasada > 0) {
    alertas.push({
      tipo: 'critico',
      titulo: 'Recebimentos atrasados',
      descricao: `${formatCurrencyFromCents(receitaAtrasada)} em parcelas vencidas e ainda nao recebidas.`,
    });
  }
  if (despesasAtrasadas > 0) {
    alertas.push({
      tipo: 'critico',
      titulo: 'Contas vencidas',
      descricao: `${formatCurrencyFromCents(despesasAtrasadas)} em despesas vencidas ou sem baixa.`,
    });
  }
  if (orcamentosAprovadosSemParcelas.length > 0) {
    alertas.push({
      tipo: 'atencao',
      titulo: 'Orcamentos aprovados sem parcelas',
      descricao: `${orcamentosAprovadosSemParcelas.length} orcamento(s) aprovado(s) nao possuem cronograma de recebimento.`,
    });
  }
  if (despesasSemCliente > 0) {
    alertas.push({
      tipo: 'info',
      titulo: 'Despesas sem cliente/projeto',
      descricao: `${despesasSemCliente} lancamento(s) ficaram como administrativo/geral. Isso reduz precisao de lucro por cliente.`,
    });
  }
  if (receitaContratada > 0 && despesasLancadas === 0) {
    alertas.push({
      tipo: 'atencao',
      titulo: 'Resultado sem custos lancados',
      descricao: 'Ha receita contratada, mas nenhuma despesa no periodo. O lucro pode estar artificialmente alto.',
    });
  }

  return {
    orcamentos,
    parcelas,
    despesas,
    monthly: monthlyArray,
    categorias,
    clientes,
    kpis: {
      receitaContratada,
      receitaRecebida,
      receitaPendente,
      receitaAtrasada,
      receitaPipeline,
      impostosEstimados,
      receitaLiquidaEstimada,
      despesasLancadas,
      despesasPagas,
      despesasAbertas,
      despesasAtrasadas,
      custosFixos,
      custosVariaveis,
      custosReembolsaveis,
      custosCartorioTaxas,
      custosTributarios,
      resultadoCaixa,
      resultadoCompetencia,
      margemCaixa,
      margemCompetencia,
      margemContribuicao,
      pontoEquilibrio,
      ticketMedioContratado,
      taxaConversao,
      contasReceberCount,
      contasPagarCount,
      orcamentosSemParcelas: orcamentosAprovadosSemParcelas.length,
      despesasSemCliente,
    },
    alertas,
  };
}
