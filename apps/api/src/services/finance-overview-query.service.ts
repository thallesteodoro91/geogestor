import { sql, type SQL } from 'drizzle-orm';
import { db } from '../db';

export type FinanceOverviewFilters = {
  dataInicio?: string;
  dataFim?: string;
  clienteId?: string;
  categoria?: string;
  tipoCusto?: string;
  centroCusto?: string;
};

type NumericRecord = Record<string, number | string | null>;

type MonthlyRow = {
  mes: string;
  receitaContratada: number;
  receitaRecebida: number;
  despesasLancadas: number;
  despesasPagas: number;
};

type CategoryRow = {
  categoria: string;
  total: number;
  pago: number;
  aberto: number;
  count: number;
};

type ClientRow = {
  clienteId: string;
  cliente: string;
  receitaContratada: number;
  receitaRecebida: number;
  despesas: number;
};

type RecentEntryRow = {
  id: string;
  type: 'receita' | 'despesa';
  title: string;
  context: string;
  date: string;
  status: string;
  amount: number;
  tab: 'faturas' | 'pagar';
};

type OptionRow = { kind: 'cliente' | 'categoria' | 'tipoCusto' | 'centroCusto'; value: string; label: string | null };

function normalizedText(expression: SQL) {
  return sql`lower(trim(
    replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
      coalesce(${expression}, ''),
      'á', 'a'), 'à', 'a'), 'ã', 'a'), 'â', 'a'), 'é', 'e'), 'ê', 'e'),
      'í', 'i'), 'ó', 'o'), 'ô', 'o'), 'ú', 'u'), 'ç', 'c')
  ))`;
}

function datePredicate(expression: SQL, filters: FinanceOverviewFilters) {
  if (filters.dataInicio && filters.dataFim) {
    return sql`substr(${expression}, 1, 10) between ${filters.dataInicio} and ${filters.dataFim}`;
  }
  if (filters.dataInicio) return sql`substr(${expression}, 1, 10) >= ${filters.dataInicio}`;
  if (filters.dataFim) return sql`substr(${expression}, 1, 10) <= ${filters.dataFim}`;
  return sql`1 = 1`;
}

function baseCtes(filters: FinanceOverviewFilters, today: string) {
  const normalizedCostFilter = filters.tipoCusto ? filters.tipoCusto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : null;
  const normalizedCenterFilter = filters.centroCusto ? filters.centroCusto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : null;
  const budgetDate = sql`coalesce(o.data_competencia, o.data_orcamento, o.created_at)`;
  const expenseDate = sql`coalesce(d.data_pagamento, d.data_competencia, d.data)`;
  const installmentDate = sql`coalesce(p.data_pagamento, p.data_vencimento)`;
  const receiptDate = sql`r.data_recebimento`;
  const budgetCenter = normalizedText(sql`o.centro_custo`);
  const inferredCostType = sql`case
    when d.reembolsavel = 1 then 'reembolsavel'
    when d.categoria_codigo = 'cartorio_taxas' then 'cartorio e taxas'
    when d.categoria_codigo = 'tributos' then 'tributario'
    when d.tipo_custo is not null and trim(d.tipo_custo) <> '' then d.raw_cost_type_normalized
    when d.category_normalized like '%cart%' or d.category_normalized like '%emolumento%' or d.category_normalized like '%taxa%' then 'cartorio e taxas'
    when d.category_normalized like '%imposto%' or d.category_normalized like '%tribut%' then 'tributario'
    when d.category_normalized like '%software%' or d.category_normalized like '%licenca%' or d.category_normalized like '%salario%'
      or d.category_normalized like '%folha%' or d.category_normalized like '%internet%' or d.category_normalized like '%aluguel%' then 'fixo'
    when d.category_normalized like '%combust%' or d.category_normalized like '%viagem%' or d.category_normalized like '%aliment%'
      or d.category_normalized like '%hosped%' then 'variavel de campo'
    else 'operacional'
  end`;

  return sql`
    with
    active_receipts as materialized (
      select r.*,
        case when ${datePredicate(receiptDate, filters)} then 1 else 0 end as in_period
      from recebimentos r
      where r.deleted_at is null and r.estornado_em is null
    ),
    receipt_totals as materialized (
      select parcela_id,
        count(*) as receipt_count,
        sum(case when in_period = 1 then 1 else 0 end) as period_count,
        coalesce(sum(case when in_period = 1 then valor_recebido else 0 end), 0) as period_received
      from active_receipts
      group by parcela_id
    ),
    filtered_budgets as materialized (
      select o.*,
        case
          when lower(trim(o.status)) in ('aprovado', 'pago') then 'aprovado'
          when lower(trim(o.status)) in ('rejeitado') then 'rejeitado'
          when lower(trim(o.status)) in ('expirado') then 'expirado'
          when lower(trim(o.status)) in ('substituído', 'substituido') then 'substituido'
          when lower(trim(o.status)) in ('cancelado') then 'cancelado'
          when lower(trim(o.status)) in ('emitido') then 'emitido'
          when lower(trim(o.status)) in ('enviado') then 'enviado'
          when lower(trim(o.status)) in ('em negociação', 'em negociacao', 'em_negociacao') then 'em_negociacao'
          else 'rascunho'
        end as normalized_status
      from orcamentos o
      where o.deleted_at is null
        and ${datePredicate(budgetDate, filters)}
        and (${filters.clienteId || null} is null or o.cliente_id = ${filters.clienteId || null})
        and (${normalizedCenterFilter} is null or ${budgetCenter} = ${normalizedCenterFilter})
    ),
    approved_budgets as materialized (
      select * from filtered_budgets where normalized_status = 'aprovado'
    ),
    eligible_installments as materialized (
      select p.*, o.cliente_id, o.descricao as orcamento_descricao, c.nome as cliente_nome,
        case when coalesce(rt.receipt_count, 0) > 0 then coalesce(rt.period_received, 0) else coalesce(p.valor_pago, 0) end as received_value,
        case
          when ${normalizedText(sql`p.status_pagamento`)} = 'pago' then 'Pago'
          when p.valor_pago > 0 and substr(p.data_vencimento, 1, 10) < ${today} then 'Atrasado'
          when p.valor_pago > 0 then 'Parcialmente pago'
          when substr(p.data_vencimento, 1, 10) < ${today} then 'Atrasado'
          else 'Pendente'
        end as computed_status
      from parcelas p
      join orcamentos o on o.id = p.orcamento_id and o.deleted_at is null
      left join clientes c on c.id = o.cliente_id and c.deleted_at is null
      left join receipt_totals rt on rt.parcela_id = p.id
      where p.deleted_at is null and p.cancelada_em is null
        and lower(trim(o.status)) in ('aprovado', 'pago')
        and (${filters.clienteId || null} is null or o.cliente_id = ${filters.clienteId || null})
        and (${datePredicate(installmentDate, filters)} or coalesce(rt.period_count, 0) > 0)
    ),
    approved_without_installments as materialized (
      select ab.*
      from approved_budgets ab
      where not exists (select 1 from eligible_installments ei where ei.orcamento_id = ab.id)
    ),
    expense_base as materialized (
      select d.*, coalesce(d.cliente_id, p.cliente_id) as effective_cliente_id,
        c.nome as cliente_nome, p.nome as projeto_nome,
        ${normalizedText(sql`d.categoria`)} as category_normalized,
        ${normalizedText(sql`d.tipo_custo`)} as raw_cost_type_normalized,
        ${normalizedText(sql`d.centro_custo`)} as center_normalized
      from despesas d
      left join projetos p on p.id = d.projeto_id and p.deleted_at is null
      left join clientes c on c.id = coalesce(d.cliente_id, p.cliente_id) and c.deleted_at is null
      where d.deleted_at is null and d.cancelada_em is null and d.estornada_em is null
        and ${datePredicate(expenseDate, filters)}
    ),
    expense_source as materialized (
      select d.*,
        ${inferredCostType} as inferred_cost_type,
        case when lower(trim(coalesce(d.status, ''))) = 'pago' then 'Pago'
          when substr(d.data, 1, 10) < ${today} then 'Atrasado'
          else 'Pendente' end as computed_status
      from expense_base d
    ),
    filtered_expenses as materialized (
      select * from expense_source d
      where (${filters.clienteId || null} is null or d.effective_cliente_id = ${filters.clienteId || null})
        and (${filters.categoria || null} is null or d.categoria = ${filters.categoria || null})
        and (${normalizedCostFilter} is null or d.inferred_cost_type = ${normalizedCostFilter})
        and (${normalizedCenterFilter} is null or d.center_normalized = ${normalizedCenterFilter})
    )`;
}

function numberValue(row: NumericRecord, key: string) {
  return Number(row[key] || 0);
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function loadFinanceOverviewFromSql(filters: FinanceOverviewFilters) {
  const today = localDateKey();
  const ctes = baseCtes(filters, today);

  const taggedRows = await db.all(sql`${ctes}
    select 'summary' as kind, json_object(
      'budget_count', (select count(*) from filtered_budgets),
      'approved_count', (select count(*) from approved_budgets),
      'contracted_revenue', (select coalesce(sum(valor_total), 0) from approved_budgets),
      'estimated_taxes', (select coalesce(sum(coalesce(impostos_previstos, imposto_valor, 0)), 0) from approved_budgets),
      'pipeline_revenue', (select coalesce(sum(valor_total), 0) from filtered_budgets where normalized_status not in ('aprovado', 'rejeitado', 'expirado', 'substituido')),
      'approved_without_installments', (select count(*) from approved_without_installments),
      'direct_received', (select coalesce(sum(valor_total), 0) from approved_without_installments where lower(trim(status)) = 'pago'),
      'direct_pending', (select coalesce(sum(valor_total), 0) from approved_without_installments where lower(trim(status)) <> 'pago'),
      'installment_count', (select count(*) from eligible_installments),
      'installment_received', (select coalesce(sum(received_value), 0) from eligible_installments),
      'pending_revenue', (select coalesce(sum(max(0, valor - valor_pago)), 0) from eligible_installments where computed_status not in ('Pago', 'Atrasado')),
      'overdue_revenue', (select coalesce(sum(max(0, valor - valor_pago)), 0) from eligible_installments where computed_status = 'Atrasado'),
      'open_installments', (select count(*) from eligible_installments where computed_status <> 'Pago'),
      'next_due_date', (select coalesce(min(substr(data_vencimento, 1, 10)), '') from eligible_installments where computed_status <> 'Pago' and substr(data_vencimento, 1, 10) >= ${today}),
      'expense_count', (select count(*) from filtered_expenses),
      'launched_expenses', (select coalesce(sum(valor), 0) from filtered_expenses),
      'paid_expenses', (select coalesce(sum(valor), 0) from filtered_expenses where computed_status = 'Pago'),
      'overdue_expenses', (select coalesce(sum(valor), 0) from filtered_expenses where computed_status = 'Atrasado'),
      'fixed_costs', (select coalesce(sum(valor), 0) from filtered_expenses where inferred_cost_type = 'fixo'),
      'tax_costs', (select coalesce(sum(valor), 0) from filtered_expenses where inferred_cost_type = 'tributario'),
      'reimbursable_costs', (select coalesce(sum(valor), 0) from filtered_expenses where reembolsavel = 1),
      'registry_costs', (select coalesce(sum(valor), 0) from filtered_expenses where inferred_cost_type = 'cartorio e taxas'),
      'open_expenses', (select count(*) from filtered_expenses where computed_status <> 'Pago'),
      'missing_client_expenses', (select count(*) from filtered_expenses where effective_cliente_id is null)
    ) as payload
    union all
    select 'monthly', json_object(
      'mes', mes,
      'receitaContratada', coalesce(sum(receita_contratada), 0),
      'receitaRecebida', coalesce(sum(receita_recebida), 0),
      'despesasLancadas', coalesce(sum(despesas_lancadas), 0),
      'despesasPagas', coalesce(sum(despesas_pagas), 0)
    )
    from (
      select substr(coalesce(data_competencia, data_orcamento, created_at), 1, 7) as mes, valor_total as receita_contratada, 0 as receita_recebida, 0 as despesas_lancadas, 0 as despesas_pagas from approved_budgets
      union all
      select substr(coalesce(data_pagamento, data_orcamento, created_at), 1, 7), 0, valor_total, 0, 0 from approved_without_installments where lower(trim(status)) = 'pago'
      union all
      select substr(ar.data_recebimento, 1, 7), 0, ar.valor_recebido, 0, 0 from active_receipts ar join eligible_installments ei on ei.id = ar.parcela_id where ar.in_period = 1
      union all
      select substr(coalesce(ei.data_pagamento, ei.data_vencimento), 1, 7), 0, ei.valor_pago, 0, 0 from eligible_installments ei left join receipt_totals rt on rt.parcela_id = ei.id where coalesce(rt.receipt_count, 0) = 0 and ei.valor_pago > 0
      union all
      select substr(coalesce(data_competencia, data), 1, 7), 0, 0, valor, 0 from filtered_expenses
      union all
      select substr(coalesce(data_pagamento, data), 1, 7), 0, 0, 0, valor from filtered_expenses where computed_status = 'Pago'
    ) events
    where mes is not null and mes <> ''
    group by mes
    union all
    select 'category', json_object(
      'categoria', coalesce(categoria, 'Sem categoria'),
      'total', coalesce(sum(valor), 0),
      'pago', coalesce(sum(case when computed_status = 'Pago' then valor else 0 end), 0),
      'aberto', coalesce(sum(case when computed_status <> 'Pago' then valor else 0 end), 0),
      'count', count(*)
    )
    from filtered_expenses
    group by coalesce(categoria, 'Sem categoria')
    union all
    select 'client', json_object(
      'clienteId', components.cliente_id,
      'cliente', coalesce(c.nome, max(components.fallback_name), 'Sem cliente vinculado'),
      'receitaContratada', coalesce(sum(components.receita_contratada), 0),
      'receitaRecebida', coalesce(sum(components.receita_recebida), 0),
      'despesas', coalesce(sum(components.despesas), 0)
    )
    from (
      select cliente_id, null as fallback_name, valor_total as receita_contratada, 0 as receita_recebida, 0 as despesas from approved_budgets
      union all
      select cliente_id, cliente_nome, 0, received_value, 0 from eligible_installments
      union all
      select cliente_id, null, 0, valor_total, 0 from approved_without_installments where lower(trim(status)) = 'pago'
      union all
      select coalesce(effective_cliente_id, 'sem-cliente'), cliente_nome, 0, 0, valor from filtered_expenses where computed_status = 'Pago'
    ) components
    left join clientes c on c.id = components.cliente_id and c.deleted_at is null
    group by components.cliente_id
    union all
    select 'recent', json_object('id', id, 'type', type, 'title', title, 'context', context, 'date', date, 'status', status, 'amount', amount, 'tab', tab)
    from (
      select * from (
        select 'receita-' || ei.id as id, 'receita' as type, coalesce(ei.orcamento_descricao, 'Parcela a receber') as title,
          coalesce(ei.cliente_nome, 'Cliente não informado') as context, substr(coalesce(ei.data_pagamento, ei.data_vencimento), 1, 10) as date,
          ei.computed_status as status, ei.valor as amount, 'faturas' as tab
        from eligible_installments ei
        union all
        select 'despesa-' || fe.id, 'despesa', coalesce(fe.descricao, fe.categoria, 'Despesa'),
          case when fe.cliente_nome is not null and coalesce(fe.projeto_nome, fe.fornecedor) is not null then fe.cliente_nome || ' · ' || coalesce(fe.projeto_nome, fe.fornecedor)
            when fe.cliente_nome is not null then fe.cliente_nome
            when coalesce(fe.projeto_nome, fe.fornecedor) is not null then coalesce(fe.projeto_nome, fe.fornecedor)
            else 'Administrativo / geral' end,
          substr(coalesce(fe.data_pagamento, fe.data_competencia, fe.data), 1, 10), fe.computed_status, fe.valor, 'pagar'
        from filtered_expenses fe
      ) all_entries order by date desc, id desc limit 6
    ) recent_entries
    union all
    select 'option', json_object('kind', kind, 'value', value, 'label', label)
    from (
      select 'cliente' as kind, c.id as value, c.nome as label from clientes c where c.deleted_at is null and c.id in (
        select cliente_id from filtered_budgets union select cliente_id from eligible_installments union select effective_cliente_id from filtered_expenses where effective_cliente_id is not null
      )
      union select 'categoria', categoria, categoria from filtered_expenses where categoria is not null and trim(categoria) <> ''
      union select 'tipoCusto', tipo_custo, tipo_custo from filtered_expenses where tipo_custo is not null and trim(tipo_custo) <> ''
      union select 'centroCusto', centro_custo, centro_custo from filtered_expenses where centro_custo is not null and trim(centro_custo) <> ''
      union select 'centroCusto', centro_custo, centro_custo from filtered_budgets where centro_custo is not null and trim(centro_custo) <> ''
    ) options
  `) as Array<{ kind: string; payload: string }>;
  const parsedRows = taggedRows.map((row) => ({ kind: row.kind, value: JSON.parse(row.payload) as Record<string, unknown> }));
  const summaryRows = parsedRows.filter((row) => row.kind === 'summary').map((row) => row.value);
  const monthlyRows = parsedRows.filter((row) => row.kind === 'monthly').map((row) => row.value);
  const categoryRows = parsedRows.filter((row) => row.kind === 'category').map((row) => row.value);
  const clientRows = parsedRows.filter((row) => row.kind === 'client').map((row) => row.value);
  const recentRows = parsedRows.filter((row) => row.kind === 'recent').map((row) => row.value);
  const optionRows = parsedRows.filter((row) => row.kind === 'option').map((row) => row.value);

  const summary = (summaryRows[0] || {}) as NumericRecord;
  const contractedRevenue = numberValue(summary, 'contracted_revenue');
  const receivedRevenue = numberValue(summary, 'installment_received') + numberValue(summary, 'direct_received');
  const launchedExpenses = numberValue(summary, 'launched_expenses');
  const paidExpenses = numberValue(summary, 'paid_expenses');
  const fixedCosts = numberValue(summary, 'fixed_costs');
  const taxCosts = numberValue(summary, 'tax_costs');
  const variableCosts = launchedExpenses - fixedCosts - taxCosts;
  const estimatedTaxes = numberValue(summary, 'estimated_taxes');
  const netRevenue = Math.max(0, contractedRevenue - estimatedTaxes);
  const cashResult = receivedRevenue - paidExpenses;
  const contributionValue = netRevenue - variableCosts;
  const competenceResult = contributionValue - fixedCosts;
  const contributionMargin = netRevenue > 0 ? contributionValue / netRevenue * 100 : 0;
  const approvedCount = numberValue(summary, 'approved_count');
  const budgetCount = numberValue(summary, 'budget_count');
  const installmentCount = numberValue(summary, 'installment_count');
  const expenseCount = numberValue(summary, 'expense_count');
  const openInstallments = numberValue(summary, 'open_installments');
  const openExpenses = numberValue(summary, 'open_expenses');
  const approvedWithoutInstallments = numberValue(summary, 'approved_without_installments');
  const missingClientExpenses = numberValue(summary, 'missing_client_expenses');
  const overdueRevenue = numberValue(summary, 'overdue_revenue');
  const overdueExpenses = numberValue(summary, 'overdue_expenses');

  const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
  const alerts: Array<{ tipo: 'critico' | 'atencao' | 'info'; titulo: string; descricao: string }> = [];
  if (overdueRevenue > 0) alerts.push({ tipo: 'critico', titulo: 'Recebimentos atrasados', descricao: `${currency(overdueRevenue)} em parcelas vencidas e ainda não recebidas.` });
  if (overdueExpenses > 0) alerts.push({ tipo: 'critico', titulo: 'Contas vencidas', descricao: `${currency(overdueExpenses)} em despesas vencidas ou sem baixa.` });
  if (approvedWithoutInstallments > 0) alerts.push({ tipo: 'atencao', titulo: 'Orçamentos aprovados sem parcelas', descricao: `${approvedWithoutInstallments} orçamento(s) aprovado(s) não possuem cronograma de recebimento.` });
  if (missingClientExpenses > 0) alerts.push({ tipo: 'info', titulo: 'Despesas sem cliente/projeto', descricao: `${missingClientExpenses} lançamento(s) ficaram como administrativo/geral. Isso reduz precisão de lucro por cliente.` });
  if (contractedRevenue > 0 && launchedExpenses === 0) alerts.push({ tipo: 'atencao', titulo: 'Resultado sem custos lançados', descricao: 'Há receita contratada, mas nenhuma despesa no período. O lucro pode estar artificialmente alto.' });

  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const groupedMonths = new Map((monthlyRows as unknown as MonthlyRow[]).map((row) => [row.mes, row]));
  const now = new Date();
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    const mes = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const row = groupedMonths.get(mes);
    const receitaContratada = Number(row?.receitaContratada || (row as unknown as Record<string, unknown>)?.receita_contratada || 0);
    const receitaRecebida = Number(row?.receitaRecebida || (row as unknown as Record<string, unknown>)?.receita_recebida || 0);
    const despesasLancadas = Number(row?.despesasLancadas || (row as unknown as Record<string, unknown>)?.despesas_lancadas || 0);
    const despesasPagas = Number(row?.despesasPagas || (row as unknown as Record<string, unknown>)?.despesas_pagas || 0);
    return {
      mes,
      label: labels[date.getMonth()],
      receitaContratada,
      receitaRecebida,
      despesasLancadas,
      despesasPagas,
      resultadoCaixa: receitaRecebida - despesasPagas,
      resultadoCompetencia: receitaContratada - despesasLancadas
    };
  });

  const categories = (categoryRows as unknown as Array<CategoryRow & Record<string, unknown>>).map((row) => ({
    categoria: row.categoria,
    total: Number(row.total),
    pago: Number(row.pago),
    aberto: Number(row.aberto),
    count: Number(row.count),
    percentual: launchedExpenses ? Number(row.total) / launchedExpenses * 100 : 0
  }));
  const clients = (clientRows as unknown as Array<ClientRow & Record<string, unknown>>).map((row) => {
    const receitaRecebida = Number(row.receitaRecebida || row.receita_recebida || 0);
    const despesas = Number(row.despesas || 0);
    const resultado = receitaRecebida - despesas;
    return {
      clienteId: String(row.clienteId || row.cliente_id),
      cliente: String(row.cliente),
      receitaContratada: Number(row.receitaContratada || row.receita_contratada || 0),
      receitaRecebida,
      despesas,
      resultado,
      margem: receitaRecebida ? resultado / receitaRecebida * 100 : 0
    };
  }).sort((left, right) => right.resultado - left.resultado);
  const options = optionRows as unknown as OptionRow[];

  return {
    analytics: {
      monthly,
      categorias: categories,
      clientes: clients,
      kpis: {
        receitaContratada: contractedRevenue,
        receitaRecebida: receivedRevenue,
        receitaPendente: numberValue(summary, 'pending_revenue') + numberValue(summary, 'direct_pending'),
        receitaAtrasada: overdueRevenue,
        receitaPipeline: numberValue(summary, 'pipeline_revenue'),
        impostosEstimados: estimatedTaxes,
        receitaLiquidaEstimada: netRevenue,
        despesasLancadas: launchedExpenses,
        despesasPagas: paidExpenses,
        despesasAbertas: launchedExpenses - paidExpenses,
        despesasAtrasadas: overdueExpenses,
        custosFixos: fixedCosts,
        custosVariaveis: variableCosts,
        custosReembolsaveis: numberValue(summary, 'reimbursable_costs'),
        custosCartorioTaxas: numberValue(summary, 'registry_costs'),
        custosTributarios: taxCosts,
        resultadoCaixa: cashResult,
        resultadoCompetencia: competenceResult,
        margemCaixa: receivedRevenue ? cashResult / receivedRevenue * 100 : 0,
        margemCompetencia: contractedRevenue ? competenceResult / contractedRevenue * 100 : 0,
        margemContribuicao: contributionMargin,
        pontoEquilibrio: contributionMargin > 0 ? fixedCosts / (contributionMargin / 100) : 0,
        ticketMedioContratado: approvedCount ? contractedRevenue / approvedCount : 0,
        taxaConversao: budgetCount ? approvedCount / budgetCount * 100 : 0,
        contasReceberCount: openInstallments,
        contasPagarCount: openExpenses,
        orcamentosSemParcelas: approvedWithoutInstallments,
        despesasSemCliente: missingClientExpenses
      },
      alertas: alerts
    },
    recentEntries: recentRows as unknown as RecentEntryRow[],
    meta: {
      launchCount: installmentCount + expenseCount,
      expenseCount,
      hasSourceData: budgetCount > 0 || installmentCount > 0 || expenseCount > 0,
      hasFilteredData: installmentCount + expenseCount > 0,
      nextDueDate: String(summary.next_due_date || ''),
      openAccountCount: openInstallments + openExpenses
    },
    options: {
      clientes: options.filter((item) => item.kind === 'cliente').map((item) => ({ id: item.value, nome: item.label || item.value })),
      categorias: options.filter((item) => item.kind === 'categoria').map((item) => item.value),
      tiposCusto: options.filter((item) => item.kind === 'tipoCusto').map((item) => item.value),
      centrosCusto: options.filter((item) => item.kind === 'centroCusto').map((item) => item.value)
    }
  };
}
