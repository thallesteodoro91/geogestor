import {
  ManagerialReport,
  ReportAlert,
  ReportFinancialComparison,
  ReportFinancialKpis,
  normalizeBudgetStatus
} from '@geogestor/contracts';
import { schema } from '@geogestor/database';
import {
  DAY_MS,
  ReportPeriodValidationError,
  dateKey,
  isInPeriod,
  parseReportPeriod,
  shiftDate,
  toReportPeriod,
  type ParsedPeriod,
  type PeriodInput
} from './reports/report-period';
import { loadReportRows } from './reports/report-repository';

export { ReportPeriodValidationError, parseReportPeriod } from './reports/report-period';

type FinancialEvent = {
  date: string;
  amount: number;
};


function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function sum(events: FinancialEvent[]) {
  return events.reduce((total, event) => total + event.amount, 0);
}

function groupCount(values: string[]) {
  const grouped = new Map<string, number>();
  values.forEach((value) => {
    const label = value.trim() || 'Não informado';
    grouped.set(label, (grouped.get(label) || 0) + 1);
  });
  return [...grouped.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
}

function isPaidStatus(value?: string | null) {
  return normalizeText(value) === 'pago';
}

function projectState(value?: string | null): 'active' | 'completed' | 'cancelled' {
  const normalized = normalizeText(value);
  if (['concluido', 'finalizado', 'entregue'].includes(normalized)) return 'completed';
  if (['cancelado', 'cancelada'].includes(normalized)) return 'cancelled';
  return 'active';
}

function buildMonthly(received: FinancialEvent[], expenses: FinancialEvent[]) {
  const monthly = new Map<string, { receivedRevenue: number; paidExpenses: number }>();
  received.forEach((event) => {
    const month = event.date.slice(0, 7);
    const current = monthly.get(month) || { receivedRevenue: 0, paidExpenses: 0 };
    current.receivedRevenue += event.amount;
    monthly.set(month, current);
  });
  expenses.forEach((event) => {
    const month = event.date.slice(0, 7);
    const current = monthly.get(month) || { receivedRevenue: 0, paidExpenses: 0 };
    current.paidExpenses += event.amount;
    monthly.set(month, current);
  });
  return [...monthly.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, values]) => ({
      month,
      ...values,
      cashResult: values.receivedRevenue - values.paidExpenses
    }));
}

function financialAlerts(kpis: ReportFinancialKpis): ReportAlert[] {
  const alerts: ReportAlert[] = [];
  if (kpis.overdueRevenue > 0) {
    alerts.push({
      id: 'overdue-revenue',
      code: 'overdue_revenue',
      severity: 'critical',
      valueCents: kpis.overdueRevenue,
      href: '/financeiro'
    });
  }
  if (kpis.cashResult < 0) {
    alerts.push({
      id: 'negative-cash',
      code: 'negative_cash',
      severity: 'warning',
      valueCents: kpis.cashResult,
      href: '/financeiro'
    });
  }
  if (kpis.decidedBudgets > 0 && (kpis.conversionRate || 0) < 30) {
    alerts.push({
      id: 'low-conversion',
      code: 'low_conversion',
      severity: 'info',
      threshold: 30,
      href: '/orcamentos'
    });
  }
  return alerts;
}

function calculateFinancial(
  period: Pick<ParsedPeriod, 'startDate' | 'endDate'>,
  budgets: typeof schema.orcamentos.$inferSelect[],
  installments: typeof schema.parcelas.$inferSelect[],
  receipts: typeof schema.recebimentos.$inferSelect[],
  expenses: typeof schema.despesas.$inferSelect[]
) {
  const approvedBudgets = budgets.filter((budget) => normalizeBudgetStatus(budget.status) === 'aprovado');
  const approvedIds = new Set(approvedBudgets.map((budget) => budget.id));
  // Um orçamento substituído deixa de compor contratação e saldo futuro, mas
  // recebimentos já realizados continuam sendo fatos de caixa válidos.
  const cashBudgetIds = new Set(
    budgets.map((budget) => budget.id)
  );
  const relevantInstallments = installments.filter((installment) => approvedIds.has(installment.orcamentoId));
  const cashInstallments = installments.filter((installment) => cashBudgetIds.has(installment.orcamentoId));
  const installmentById = new Map(cashInstallments.map((installment) => [installment.id, installment]));
  const installmentsByBudget = new Set(relevantInstallments.map((installment) => installment.orcamentoId));

  const contractedEvents = approvedBudgets
    .map((budget) => ({
      date: dateKey(budget.dataCompetencia || budget.dataEmissao || budget.dataOrcamento || budget.createdAt),
      amount: budget.valorTotal
    }))
    .filter((event) => isInPeriod(event.date, period));

  const receiptEvents = receipts
    .filter((receipt) => installmentById.has(receipt.parcelaId))
    .map((receipt) => ({ date: dateKey(receipt.dataRecebimento), amount: receipt.valorRecebido }))
    .filter((event) => isInPeriod(event.date, period));

  const installmentsWithReceipt = new Set(receipts.map((receipt) => receipt.parcelaId));
  const legacyInstallmentEvents = cashInstallments
    .filter((installment) => isPaidStatus(installment.statusPagamento) && !installmentsWithReceipt.has(installment.id))
    .map((installment) => ({
      date: dateKey(installment.dataPagamento || installment.dataVencimento),
      amount: installment.valorPago || installment.valor
    }))
    .filter((event) => isInPeriod(event.date, period));

  const directBudgetEvents = approvedBudgets
    .filter((budget) => Boolean(budget.dataPagamento) && !installmentsByBudget.has(budget.id))
    .map((budget) => ({ date: dateKey(budget.dataPagamento), amount: budget.valorTotal }))
    .filter((event) => isInPeriod(event.date, period));
  const receivedEvents = [...receiptEvents, ...legacyInstallmentEvents, ...directBudgetEvents];

  const pendingInstallments = relevantInstallments.filter((installment) => !isPaidStatus(installment.statusPagamento));
  const pendingEvents = pendingInstallments
    .map((installment) => ({
      date: dateKey(installment.dataCompetencia || installment.dataVencimento),
      amount: Math.max(0, installment.valor - installment.valorPago),
      dueDate: dateKey(installment.dataVencimento)
    }))
    .filter((event) => isInPeriod(event.date, period));
  const directPendingEvents = approvedBudgets
    .filter((budget) => !budget.dataPagamento && !installmentsByBudget.has(budget.id))
    .map((budget) => ({
      date: dateKey(budget.dataCompetencia || budget.dataEmissao || budget.dataOrcamento || budget.createdAt),
      amount: budget.valorTotal,
      dueDate: dateKey(budget.dataCompetencia || budget.validadeAte)
    }))
    .filter((event) => isInPeriod(event.date, period));

  const today = new Date().toISOString().slice(0, 10);
  const overdueRevenue = [...pendingEvents, ...directPendingEvents]
    .filter((event) => Boolean(event.dueDate) && event.dueDate < today)
    .reduce((total, event) => total + event.amount, 0);

  const paidExpenseRows = expenses
    .filter((expense) => isPaidStatus(expense.status))
    .map((expense) => ({
      row: expense,
      date: dateKey(expense.dataPagamento || expense.dataCompetencia || expense.data),
      amount: expense.valor
    }))
    .filter((event) => isInPeriod(event.date, period));
  const expenseEvents = paidExpenseRows.map(({ date, amount }) => ({ date, amount }));

  const decided = budgets.filter((budget) =>
    ['aprovado', 'rejeitado', 'expirado'].includes(normalizeBudgetStatus(budget.status))
    && isInPeriod(budget.dataCompetencia || budget.dataEmissao || budget.dataOrcamento || budget.createdAt, period)
  );
  const approvedCount = decided.filter((budget) => normalizeBudgetStatus(budget.status) === 'aprovado').length;
  const estimatedTaxes = approvedBudgets
    .filter((budget) => isInPeriod(
      budget.dataCompetencia || budget.dataEmissao || budget.dataOrcamento || budget.createdAt,
      period
    ))
    .reduce((total, budget) => total + (budget.impostosPrevistos ?? budget.impostoValor ?? 0), 0);

  const receivedRevenue = sum(receivedEvents);
  const paidExpenses = sum(expenseEvents);
  const kpis: ReportFinancialKpis = {
    contractedRevenue: sum(contractedEvents),
    receivedRevenue,
    pendingRevenue: [...pendingEvents, ...directPendingEvents].reduce((total, event) => total + event.amount, 0),
    overdueRevenue,
    paidExpenses,
    cashResult: receivedRevenue - paidExpenses,
    estimatedTaxes,
    approvedBudgets: approvedCount,
    decidedBudgets: decided.length,
    conversionRate: decided.length ? Number(((approvedCount / decided.length) * 100).toFixed(1)) : null
  };

  const categories = new Map<string, { paidTotal: number; launchedTotal: number; count: number }>();
  expenses
    .filter((expense) => isInPeriod(expense.dataCompetencia || expense.data, period))
    .forEach((expense) => {
      const category = expense.categoria?.trim() || 'Sem categoria';
      const current = categories.get(category) || { paidTotal: 0, launchedTotal: 0, count: 0 };
      current.launchedTotal += expense.valor;
      current.count += 1;
      if (isPaidStatus(expense.status)) current.paidTotal += expense.valor;
      categories.set(category, current);
    });

  return {
    kpis,
    receivedEvents,
    expenseEvents,
    monthly: buildMonthly(receivedEvents, expenseEvents),
    expensesByCategory: [...categories.entries()]
      .map(([category, values]) => ({ category, ...values }))
      .sort((a, b) => b.paidTotal - a.paidTotal || a.category.localeCompare(b.category, 'pt-BR'))
  };
}

export async function generateManagerialReport(input: PeriodInput): Promise<ManagerialReport> {
  const period = parseReportPeriod(input);
  const {
    budgets,
    installments,
    receipts,
    expenses,
    projects,
    sourceRecordCount
  } = await loadReportRows(period);
  const currentFinancial = calculateFinancial(period, budgets, installments, receipts, expenses);
  const previousFinancial = period.previousStartDate && period.previousEndDate
    ? calculateFinancial(
      { startDate: period.previousStartDate, endDate: period.previousEndDate },
      budgets,
      installments,
      receipts,
      expenses
    )
    : null;

  const filteredProjects = projects.filter((project) =>
    isInPeriod(project.dataInicio || project.createdAt, period)
  );
  const projectRows = filteredProjects.map((project) => ({ project, state: projectState(project.status) }));
  const activeProjects = projectRows.filter((row) => row.state === 'active');
  const today = new Date().toISOString().slice(0, 10);
  const nextThirtyDays = shiftDate(today, 30);
  const deadlines = activeProjects
    .filter(({ project }) => Boolean(dateKey(project.dataEntrega)))
    .map(({ project }) => {
      const dueDate = dateKey(project.dataEntrega);
      const due = new Date(`${dueDate}T12:00:00.000Z`).getTime();
      const now = new Date(`${today}T12:00:00.000Z`).getTime();
      return {
        id: project.id,
        name: project.nome,
        status: project.status,
        dueDate,
        daysUntilDue: Math.round((due - now) / DAY_MS)
      };
    })
    .filter((deadline) => deadline.dueDate <= nextThirtyDays)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const knownAreas = activeProjects.filter(({ project }) => project.areaHa !== null);
  const operationalKpis = {
    totalProjects: projectRows.length,
    activeProjects: activeProjects.length,
    completedProjects: projectRows.filter((row) => row.state === 'completed').length,
    cancelledProjects: projectRows.filter((row) => row.state === 'cancelled').length,
    overdueProjects: deadlines.filter((deadline) => deadline.daysUntilDue < 0).length,
    dueSoonProjects: deadlines.filter((deadline) => deadline.daysUntilDue >= 0).length,
    activeAreaHa: knownAreas.length
      ? knownAreas.reduce((total, { project }) => total + (project.areaHa || 0), 0)
      : null,
    projectsWithKnownArea: knownAreas.length
  };

  const previousCompletedProjects = period.previousStartDate && period.previousEndDate
    ? projects.filter((project) =>
      isInPeriod(project.dataInicio || project.createdAt, {
        startDate: period.previousStartDate,
        endDate: period.previousEndDate
      }) && projectState(project.status) === 'completed'
    ).length
    : null;
  const operationalAlerts: ReportAlert[] = [];
  if (operationalKpis.overdueProjects > 0) {
    operationalAlerts.push({
      id: 'overdue-projects',
      code: 'overdue_projects',
      severity: 'critical',
      count: operationalKpis.overdueProjects,
      href: '/projetos'
    });
  }
  if (operationalKpis.activeProjects > 0 && operationalKpis.projectsWithKnownArea < operationalKpis.activeProjects) {
    operationalAlerts.push({
      id: 'unknown-area',
      code: 'unknown_area',
      severity: 'info',
      count: operationalKpis.activeProjects - operationalKpis.projectsWithKnownArea,
      href: '/projetos'
    });
  }

  const filteredRecordCount = filteredProjects.length
    + currentFinancial.kpis.decidedBudgets
    + currentFinancial.receivedEvents.length
    + currentFinancial.expenseEvents.length;
  const previousKpis: ReportFinancialComparison | null = previousFinancial
    ? {
      contractedRevenue: previousFinancial.kpis.contractedRevenue,
      receivedRevenue: previousFinancial.kpis.receivedRevenue,
      paidExpenses: previousFinancial.kpis.paidExpenses,
      cashResult: previousFinancial.kpis.cashResult
    }
    : null;

  const byStatus = groupCount(filteredProjects.map((project) => project.status));
  const byType = groupCount(filteredProjects.map((project) => project.tipo || 'Não informado'));
  const byMunicipality = groupCount(filteredProjects.map((project) => project.municipio || project.cidade || 'Não informado'));
  const filteredBudgets = budgets.filter((budget) => isInPeriod(
    budget.dataCompetencia || budget.dataEmissao || budget.dataOrcamento || budget.createdAt,
    period
  ));
  const result: ManagerialReport = {
    generatedAt: new Date().toISOString(),
    period: toReportPeriod(period),
    state: {
      hasSourceData: sourceRecordCount > 0,
      hasFilteredData: filteredRecordCount > 0,
      sourceRecordCount,
      filteredRecordCount
    },
    financial: {
      kpis: currentFinancial.kpis,
      previous: previousKpis,
      monthly: currentFinancial.monthly,
      expensesByCategory: currentFinancial.expensesByCategory,
      alerts: financialAlerts(currentFinancial.kpis)
    },
    operational: {
      kpis: operationalKpis,
      previousCompletedProjects,
      byStatus,
      byType,
      byMunicipality,
      deadlines,
      alerts: operationalAlerts
    },
    projetosPorStatus: byStatus.map((item) => ({ status: item.label, count: item.count })),
    projetosPorTipo: byType.map((item) => ({ tipo: item.label, count: item.count })),
    areaTotal: operationalKpis.activeAreaHa || 0,
    orcamentosStats: groupCount(
      filteredBudgets.map((budget) => budget.status)
    ).map((item) => ({
      status: item.label,
      count: item.count,
      total: filteredBudgets
        .filter((budget) => budget.status === item.label)
        .reduce((total, budget) => total + budget.valorTotal, 0)
    })),
    parcelasStats: [
      { statusPagamento: 'Pago', total: currentFinancial.kpis.receivedRevenue },
      { statusPagamento: 'Pendente', total: currentFinancial.kpis.pendingRevenue }
    ],
    despesasPorCategoria: currentFinancial.expensesByCategory.map((item) => ({
      categoria: item.category,
      total: item.launchedTotal
    })),
    financeiro: {
      receitaContratada: currentFinancial.kpis.contractedRevenue,
      receitaRecebida: currentFinancial.kpis.receivedRevenue,
      receitaPendente: currentFinancial.kpis.pendingRevenue,
      despesasPagas: currentFinancial.kpis.paidExpenses,
      impostosPrevistos: currentFinancial.kpis.estimatedTaxes,
      resultadoCaixa: currentFinancial.kpis.cashResult
    },
    historicoMensal: {
      receitasMensais: currentFinancial.monthly.map((item) => ({ mes: item.month, total: item.receivedRevenue })),
      despesasMensais: currentFinancial.monthly.map((item) => ({ mes: item.month, total: item.paidExpenses }))
    }
  };
  return result;
}
