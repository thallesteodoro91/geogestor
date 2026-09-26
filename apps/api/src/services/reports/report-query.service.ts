import { sql, type SQL } from 'drizzle-orm';
import type { ManagerialReport, ReportAlert, ReportFinancialKpis } from '@geogestor/contracts';
import { db } from '../../db';
import { parseReportPeriod, reportTodayKey, shiftDate, toReportPeriod, type PeriodInput } from './report-period';

type TaggedRow = { kind: string; payload: string };
type JsonRow = Record<string, unknown>;

function inPeriod(expression: SQL, start: string | null, end: string | null) {
  if (start && end) return sql`substr(${expression}, 1, 10) between ${start} and ${end}`;
  if (start) return sql`substr(${expression}, 1, 10) >= ${start}`;
  if (end) return sql`substr(${expression}, 1, 10) <= ${end}`;
  return sql`substr(${expression}, 1, 10) <> ''`;
}

function financialAlerts(kpis: ReportFinancialKpis): ReportAlert[] {
  const alerts: ReportAlert[] = [];
  if (kpis.overdueRevenue > 0) alerts.push({ id: 'overdue-revenue', code: 'overdue_revenue', severity: 'critical', valueCents: kpis.overdueRevenue, href: '/financeiro' });
  if (kpis.cashResult < 0) alerts.push({ id: 'negative-cash', code: 'negative_cash', severity: 'warning', valueCents: kpis.cashResult, href: '/financeiro' });
  if (kpis.decidedBudgets > 0 && (kpis.conversionRate || 0) < 30) alerts.push({ id: 'low-conversion', code: 'low_conversion', severity: 'info', threshold: 30, href: '/orcamentos' });
  return alerts;
}

const number = (row: JsonRow, key: string) => Number(row[key] || 0);
const nullableNumber = (value: unknown) => value === null || value === undefined ? null : Number(value);

const REPORT_CACHE_TTL_MS = 30_000;
const reportCache = new Map<string, { expiresAt: number; promise: Promise<ManagerialReport> }>();

export function invalidateManagerialReportCache() {
  reportCache.clear();
}

async function queryManagerialReport(input: PeriodInput): Promise<ManagerialReport> {
  const period = parseReportPeriod(input);
  const today = reportTodayKey();
  const nextThirtyDays = shiftDate(today, 30);
  const budgetDate = sql`coalesce(data_competencia, data_emissao, data_orcamento, created_at)`;
  const expenseCashDate = sql`coalesce(data_pagamento, data_competencia, data)`;
  const projectDate = sql`coalesce(data_inicio, created_at)`;
  const normalizedProjectStatus = sql`lower(trim(replace(replace(coalesce(status, ''), 'í', 'i'), 'Í', 'i')))`;
  const currentBudget = inPeriod(budgetDate, period.startDate, period.endDate);
  const currentPendingEvent = inPeriod(sql`event_date`, period.startDate, period.endDate);
  const currentExpenseCash = inPeriod(expenseCashDate, period.startDate, period.endDate);
  const currentProject = inPeriod(projectDate, period.startDate, period.endDate);
  const previousBudget = period.previousStartDate && period.previousEndDate
    ? inPeriod(budgetDate, period.previousStartDate, period.previousEndDate) : sql`0 = 1`;
  const previousExpenseCash = period.previousStartDate && period.previousEndDate
    ? inPeriod(expenseCashDate, period.previousStartDate, period.previousEndDate) : sql`0 = 1`;
  const previousProject = period.previousStartDate && period.previousEndDate
    ? inPeriod(projectDate, period.previousStartDate, period.previousEndDate) : sql`0 = 1`;

  const rows = await db.all(sql`
    with
    active_budgets as materialized (
      select *, lower(trim(coalesce(status, ''))) as normalized_status from orcamentos where deleted_at is null
    ),
    approved_budgets as materialized (
      select * from active_budgets where normalized_status in ('aprovado', 'pago')
    ),
    active_installments as materialized (
      select * from parcelas where deleted_at is null and cancelada_em is null
    ),
    active_receipts as materialized (
      select * from recebimentos where deleted_at is null and estornado_em is null
    ),
    active_expenses as materialized (
      select *, lower(trim(coalesce(status, ''))) as normalized_status
      from despesas where deleted_at is null and cancelada_em is null and estornada_em is null
    ),
    active_projects as materialized (
      select *, ${normalizedProjectStatus} as normalized_status,
        case
          when ${normalizedProjectStatus} in ('concluido', 'finalizado', 'entregue') then 'Concluído'
          when ${normalizedProjectStatus} in ('cancelado', 'cancelada') then 'Cancelado'
          else coalesce(nullif(trim(status), ''), 'Não informado')
        end as project_status,
        coalesce(nullif(trim(tipo), ''), 'Não informado') as project_type,
        coalesce(nullif(trim(municipio), ''), nullif(trim(cidade), ''), 'Não informado') as project_municipality
      from projetos where deleted_at is null
    ),
    installment_receipt_count as materialized (
      select parcela_id, count(*) as receipt_count from active_receipts group by parcela_id
    ),
    receipt_events as materialized (
      select r.data_recebimento as event_date, r.valor_recebido as amount, r.id
      from active_receipts r
      join active_installments p on p.id = r.parcela_id
      join active_budgets o on o.id = p.orcamento_id
    ),
    legacy_receipt_events as materialized (
      select coalesce(p.data_pagamento, p.data_vencimento) as event_date,
        case when p.valor_pago > 0 then p.valor_pago else p.valor end as amount, p.id
      from active_installments p
      join active_budgets o on o.id = p.orcamento_id
      left join installment_receipt_count rc on rc.parcela_id = p.id
      where lower(trim(coalesce(p.status_pagamento, ''))) = 'pago' and coalesce(rc.receipt_count, 0) = 0
    ),
    direct_receipt_events as materialized (
      select o.data_pagamento as event_date, o.valor_total as amount, o.id
      from approved_budgets o
      where o.data_pagamento is not null
        and not exists (select 1 from active_installments p where p.orcamento_id = o.id)
    ),
    all_receipt_events as materialized (
      select * from receipt_events union all select * from legacy_receipt_events union all select * from direct_receipt_events
    ),
    pending_events as materialized (
      select coalesce(p.data_competencia, p.data_vencimento) as event_date, p.data_vencimento as due_date,
        max(0, p.valor - p.valor_pago) as amount, p.id
      from active_installments p join approved_budgets o on o.id = p.orcamento_id
      where lower(trim(coalesce(p.status_pagamento, ''))) <> 'pago'
      union all
      select coalesce(o.data_competencia, o.data_emissao, o.data_orcamento, o.created_at),
        coalesce(o.data_competencia, o.validade_ate), o.valor_total, o.id
      from approved_budgets o
      where o.data_pagamento is null
        and not exists (select 1 from active_installments p where p.orcamento_id = o.id)
    ),
    current_received as materialized (
      select * from all_receipt_events where ${inPeriod(sql`event_date`, period.startDate, period.endDate)}
    ),
    previous_received as materialized (
      select * from all_receipt_events where ${period.previousStartDate && period.previousEndDate
        ? inPeriod(sql`event_date`, period.previousStartDate, period.previousEndDate) : sql`0 = 1`}
    ),
    current_paid_expenses as materialized (
      select * from active_expenses where normalized_status = 'pago' and ${currentExpenseCash}
    ),
    previous_paid_expenses as materialized (
      select * from active_expenses where normalized_status = 'pago' and ${previousExpenseCash}
    ),
    current_projects as materialized (select * from active_projects where ${currentProject}),
    previous_projects as materialized (select * from active_projects where ${previousProject})
    select 'summary' as kind, json_object(
      'sourceRecordCount',
        (select count(*) from active_budgets) + (select count(*) from active_installments)
        + (select count(*) from active_receipts) + (select count(*) from active_expenses) + (select count(*) from active_projects),
      'currentBudgetCount', (select count(*) from active_budgets where ${currentBudget}),
      'currentPendingCount', (select count(*) from pending_events where ${currentPendingEvent}),
      'contractedRevenue', (select coalesce(sum(valor_total), 0) from approved_budgets where ${currentBudget}),
      'receivedRevenue', (select coalesce(sum(amount), 0) from current_received),
      'pendingRevenue', (select coalesce(sum(amount), 0) from pending_events where ${currentPendingEvent}),
      'overdueRevenue', (select coalesce(sum(amount), 0) from pending_events where ${currentPendingEvent} and due_date is not null and substr(due_date, 1, 10) < ${today}),
      'paidExpenses', (select coalesce(sum(valor), 0) from current_paid_expenses),
      'estimatedTaxes', (select coalesce(sum(coalesce(impostos_previstos, imposto_valor, 0)), 0) from approved_budgets where ${currentBudget}),
      'approvedBudgets', (select count(*) from approved_budgets where ${currentBudget}),
      'decidedBudgets', (select count(*) from active_budgets where normalized_status in ('aprovado', 'pago', 'rejeitado', 'expirado') and ${currentBudget}),
      'receivedCount', (select count(*) from current_received),
      'paidExpenseCount', (select count(*) from current_paid_expenses),
      'previousContractedRevenue', (select coalesce(sum(valor_total), 0) from approved_budgets where ${previousBudget}),
      'previousReceivedRevenue', (select coalesce(sum(amount), 0) from previous_received),
      'previousPaidExpenses', (select coalesce(sum(valor), 0) from previous_paid_expenses),
      'totalProjects', (select count(*) from current_projects),
      'activeProjects', (select count(*) from current_projects where normalized_status not in ('concluído', 'concluido', 'finalizado', 'entregue', 'cancelado', 'cancelada')),
      'completedProjects', (select count(*) from current_projects where normalized_status in ('concluído', 'concluido', 'finalizado', 'entregue')),
      'cancelledProjects', (select count(*) from current_projects where normalized_status in ('cancelado', 'cancelada')),
      'overdueProjects', (select count(*) from current_projects where normalized_status not in ('concluído', 'concluido', 'finalizado', 'entregue', 'cancelado', 'cancelada') and data_entrega is not null and substr(data_entrega, 1, 10) < ${today}),
      'dueSoonProjects', (select count(*) from current_projects where normalized_status not in ('concluído', 'concluido', 'finalizado', 'entregue', 'cancelado', 'cancelada') and data_entrega is not null and substr(data_entrega, 1, 10) between ${today} and ${nextThirtyDays}),
      'activeAreaHa', (select sum(area_ha) from current_projects where normalized_status not in ('concluído', 'concluido', 'finalizado', 'entregue', 'cancelado', 'cancelada') and area_ha is not null),
      'projectsWithKnownArea', (select count(*) from current_projects where normalized_status not in ('concluído', 'concluido', 'finalizado', 'entregue', 'cancelado', 'cancelada') and area_ha is not null),
      'previousCompletedProjects', (select count(*) from previous_projects where normalized_status in ('concluído', 'concluido', 'finalizado', 'entregue'))
    ) as payload
    union all
    select 'monthly', json_object('month', month, 'receivedRevenue', sum(received), 'paidExpenses', sum(expense), 'cashResult', sum(received) - sum(expense))
    from (
      select substr(event_date, 1, 7) as month, amount as received, 0 as expense from current_received
      union all select substr(coalesce(data_pagamento, data_competencia, data), 1, 7), 0, valor from current_paid_expenses
    ) monthly_events group by month
    union all
    select 'expenseCategory', json_object(
      'category', coalesce(nullif(trim(categoria), ''), 'Sem categoria'),
      'paidTotal', sum(valor),
      'launchedTotal', sum(valor), 'count', count(*)
    ) from current_paid_expenses
    group by coalesce(nullif(trim(categoria), ''), 'Sem categoria')
    union all
    select 'projectStatus', json_object('label', project_status, 'count', count(*)) from current_projects group by project_status
    union all
    select 'projectType', json_object('label', project_type, 'count', count(*)) from current_projects group by project_type
    union all
    select 'projectMunicipality', json_object('label', project_municipality, 'count', count(*)) from current_projects group by project_municipality
    union all
    select 'deadline', json_object('id', id, 'name', nome, 'status', status, 'dueDate', substr(data_entrega, 1, 10),
      'daysUntilDue', cast(julianday(substr(data_entrega, 1, 10)) - julianday(${today}) as integer))
    from current_projects
    where normalized_status not in ('concluído', 'concluido', 'finalizado', 'entregue', 'cancelado', 'cancelada')
      and data_entrega is not null and substr(data_entrega, 1, 10) <= ${nextThirtyDays}
    union all
    select 'budgetStatus', json_object('status', status, 'count', count(*), 'total', coalesce(sum(valor_total), 0))
    from active_budgets where ${currentBudget} group by status
  `) as TaggedRow[];

  const parsed = rows.map((row) => ({ kind: row.kind, value: JSON.parse(row.payload) as JsonRow }));
  const summary = parsed.find((row) => row.kind === 'summary')?.value ?? {};
  const contractedRevenue = number(summary, 'contractedRevenue');
  const receivedRevenue = number(summary, 'receivedRevenue');
  const pendingRevenue = number(summary, 'pendingRevenue');
  const overdueRevenue = number(summary, 'overdueRevenue');
  const paidExpenses = number(summary, 'paidExpenses');
  const approvedBudgets = number(summary, 'approvedBudgets');
  const decidedBudgets = number(summary, 'decidedBudgets');
  const kpis: ReportFinancialKpis = {
    contractedRevenue, receivedRevenue, pendingRevenue, overdueRevenue, paidExpenses,
    cashResult: receivedRevenue - paidExpenses,
    estimatedTaxes: number(summary, 'estimatedTaxes'), approvedBudgets, decidedBudgets,
    conversionRate: decidedBudgets ? Number((approvedBudgets / decidedBudgets * 100).toFixed(1)) : null
  };
  const totalProjects = number(summary, 'totalProjects');
  const activeProjects = number(summary, 'activeProjects');
  const completedProjects = number(summary, 'completedProjects');
  const cancelledProjects = number(summary, 'cancelledProjects');
  const overdueProjects = number(summary, 'overdueProjects');
  const dueSoonProjects = number(summary, 'dueSoonProjects');
  const projectsWithKnownArea = number(summary, 'projectsWithKnownArea');
  const activeAreaHa = nullableNumber(summary.activeAreaHa);
  const sourceRecordCount = number(summary, 'sourceRecordCount');
  const receivedEventCount = number(summary, 'receivedCount');
  const paidExpenseCount = number(summary, 'paidExpenseCount');
  const contractedBudgetCount = number(summary, 'approvedBudgets');
  const pendingItemCount = number(summary, 'currentPendingCount');
  const filteredRecordCount = totalProjects
    + number(summary, 'currentBudgetCount')
    + pendingItemCount
    + receivedEventCount
    + paidExpenseCount;
  const byKind = (kind: string) => parsed.filter((row) => row.kind === kind).map((row) => row.value);
  const breakdown = (kind: string) => byKind(kind).map((row) => ({ label: String(row.label), count: number(row, 'count') }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'pt-BR'));
  const monthly = byKind('monthly').map((row) => ({
    month: String(row.month), receivedRevenue: number(row, 'receivedRevenue'), paidExpenses: number(row, 'paidExpenses'), cashResult: number(row, 'cashResult')
  })).sort((left, right) => left.month.localeCompare(right.month));
  const expensesByCategory = byKind('expenseCategory').map((row) => ({
    category: String(row.category), paidTotal: number(row, 'paidTotal'), launchedTotal: number(row, 'launchedTotal'), count: number(row, 'count')
  })).sort((left, right) => right.paidTotal - left.paidTotal || left.category.localeCompare(right.category, 'pt-BR'));
  const deadlines = byKind('deadline').map((row) => ({
    id: String(row.id), name: String(row.name), status: String(row.status), dueDate: String(row.dueDate), daysUntilDue: number(row, 'daysUntilDue')
  })).sort((left, right) => left.dueDate.localeCompare(right.dueDate)
    || left.name.localeCompare(right.name, 'pt-BR')
    || left.id.localeCompare(right.id));
  const byStatus = breakdown('projectStatus');
  const byType = breakdown('projectType');
  const byMunicipality = breakdown('projectMunicipality');
  const operationalAlerts: ReportAlert[] = [];
  if (overdueProjects > 0) operationalAlerts.push({ id: 'overdue-projects', code: 'overdue_projects', severity: 'critical', count: overdueProjects, href: '/projetos' });
  if (activeProjects > projectsWithKnownArea) operationalAlerts.push({ id: 'unknown-area', code: 'unknown_area', severity: 'info', count: activeProjects - projectsWithKnownArea, href: '/projetos' });
  const previous = period.previousStartDate && period.previousEndDate ? {
    contractedRevenue: number(summary, 'previousContractedRevenue'),
    receivedRevenue: number(summary, 'previousReceivedRevenue'),
    paidExpenses: number(summary, 'previousPaidExpenses'),
    cashResult: number(summary, 'previousReceivedRevenue') - number(summary, 'previousPaidExpenses')
  } : null;
  const orcamentosStats = byKind('budgetStatus').map((row) => ({ status: String(row.status), count: number(row, 'count'), total: number(row, 'total') }));

  return {
    generatedAt: new Date().toISOString(), period: toReportPeriod(period),
    state: { hasSourceData: sourceRecordCount > 0, hasFilteredData: filteredRecordCount > 0, sourceRecordCount, filteredRecordCount },
    financial: {
      kpis,
      composition: { contractedBudgetCount, receivedEventCount, pendingItemCount, paidExpenseCount },
      previous,
      monthly,
      expensesByCategory,
      alerts: financialAlerts(kpis)
    },
    operational: {
      kpis: { totalProjects, activeProjects, completedProjects, cancelledProjects, overdueProjects, dueSoonProjects, activeAreaHa, projectsWithKnownArea },
      previousCompletedProjects: period.previousStartDate && period.previousEndDate ? number(summary, 'previousCompletedProjects') : null,
      byStatus, byType, byMunicipality, deadlines, alerts: operationalAlerts
    },
    projetosPorStatus: byStatus.map((item) => ({ status: item.label, count: item.count })),
    projetosPorTipo: byType.map((item) => ({ tipo: item.label, count: item.count })),
    areaTotal: activeAreaHa || 0,
    orcamentosStats,
    parcelasStats: [{ statusPagamento: 'Pago', total: receivedRevenue }, { statusPagamento: 'Pendente', total: pendingRevenue }],
    despesasPorCategoria: expensesByCategory.map((item) => ({ categoria: item.category, total: item.launchedTotal })),
    financeiro: { receitaContratada: contractedRevenue, receitaRecebida: receivedRevenue, receitaPendente: pendingRevenue, despesasPagas: paidExpenses, impostosPrevistos: kpis.estimatedTaxes, resultadoCaixa: kpis.cashResult },
    historicoMensal: {
      receitasMensais: monthly.map((item) => ({ mes: item.month, total: item.receivedRevenue })),
      despesasMensais: monthly.map((item) => ({ mes: item.month, total: item.paidExpenses }))
    }
  };
}

export function generateManagerialReportFromSql(input: PeriodInput): Promise<ManagerialReport> {
  const key = JSON.stringify({ inicio: input.inicio?.trim() || '', fim: input.fim?.trim() || '' });
  const now = Date.now();
  const cached = reportCache.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise = queryManagerialReport(input).catch((error) => {
    if (reportCache.get(key)?.promise === promise) reportCache.delete(key);
    throw error;
  });
  reportCache.set(key, { expiresAt: now + REPORT_CACHE_TTL_MS, promise });
  return promise;
}
