import { sql } from 'drizzle-orm';
import { schema } from '@geogestor/database';
import { db } from '../db';
import {
  buildProjectWhere,
  normalizedProjectType,
  projectStatusBucketExpression,
  type ProjectFilters
} from './project-filters.service';

export type ProjectOverview = {
  total: number;
  completed: number;
  inProgress: number;
  late: number;
  other: number;
  productivityRate: number | null;
  avgCompletionDays: number | null;
  avgApprovedBudgetCents: number | null;
  typeStats: Array<{ type: string; count: number }>;
  statusStats: Array<{ status: string; count: number }>;
  topProjects: Array<{ name: string; Receita: number; Custo: number; Lucro: number; tipo: string }>;
};

type TaggedRow = { kind: string; payload: string };
type CacheEntry = { expiresAt: number; promise: Promise<ProjectOverview> };
const cache = new Map<string, CacheEntry>();

export function invalidateProjectOverviewCache() {
  cache.clear();
}

async function queryProjectOverview(filters: ProjectFilters): Promise<ProjectOverview> {
  const today = new Date().toISOString().slice(0, 10);
  const whereClause = buildProjectWhere(filters, today);
  const statusBucket = projectStatusBucketExpression(today);
  const rows = await db.all(sql`
    with filtered_projects as materialized (
      select
        ${schema.projetos.id} as id,
        ${schema.projetos.nome} as nome,
        ${schema.projetos.dataInicio} as data_inicio,
        ${schema.projetos.dataEntrega} as data_entrega,
        coalesce(nullif(trim(${schema.projetos.status}), ''), 'Não informado') as project_status,
        ${normalizedProjectType} as project_type,
        ${statusBucket} as status_bucket
      from ${schema.projetos}
      left join ${schema.clientes} on ${schema.projetos.clienteId} = ${schema.clientes.id}
      where ${whereClause}
    ),
    project_revenue as materialized (
      select o.projeto_id, coalesce(sum(o.valor_total), 0) as revenue
      from orcamentos o
      join filtered_projects p on p.id = o.projeto_id
      where o.deleted_at is null
        and lower(trim(coalesce(o.status, ''))) in ('aprovado', 'pago')
      group by o.projeto_id
    ),
    project_cost as materialized (
      select d.projeto_id, coalesce(sum(d.valor), 0) as cost
      from despesas d
      join filtered_projects p on p.id = d.projeto_id
      where d.deleted_at is null and d.cancelada_em is null and d.estornada_em is null
      group by d.projeto_id
    ),
    project_finance as materialized (
      select p.id, p.nome, p.project_type,
        coalesce(r.revenue, 0) as revenue,
        coalesce(c.cost, 0) as cost
      from filtered_projects p
      left join project_revenue r on r.projeto_id = p.id
      left join project_cost c on c.projeto_id = p.id
    )
    select 'summary' as kind, json_object(
      'total', count(*),
      'completed', coalesce(sum(case when status_bucket = 'completed' then 1 else 0 end), 0),
      'inProgress', coalesce(sum(case when status_bucket = 'in_progress' then 1 else 0 end), 0),
      'late', coalesce(sum(case when status_bucket = 'late' then 1 else 0 end), 0),
      'other', coalesce(sum(case when status_bucket = 'other' then 1 else 0 end), 0),
      'avgCompletionDays', round(avg(case
        when status_bucket = 'completed' and data_inicio is not null and data_entrega is not null
        then abs(julianday(substr(data_entrega, 1, 10)) - julianday(substr(data_inicio, 1, 10))) end)),
      'avgApprovedBudgetCents', (select round(avg(o.valor_total))
        from orcamentos o join filtered_projects p on p.id = o.projeto_id
        where o.deleted_at is null and lower(trim(coalesce(o.status, ''))) in ('aprovado', 'pago'))
    ) as payload
    from filtered_projects
    union all
    select 'type', json_object('type', project_type, 'count', count(*))
    from filtered_projects group by project_type
    union all
    select 'status', json_object('status', project_status, 'count', count(*))
    from filtered_projects group by project_status
    union all
    select 'top', json_object(
      'name', nome,
      'Receita', revenue / 100.0,
      'Custo', cost / 100.0,
      'Lucro', (revenue - cost) / 100.0,
      'tipo', project_type
    )
    from (
      select * from project_finance
      where revenue <> 0 or cost <> 0
      order by revenue desc, id
      limit 5
    ) ranked_projects
  `) as TaggedRow[];

  const parsed = rows.map((row) => ({ kind: row.kind, value: JSON.parse(row.payload) as Record<string, unknown> }));
  const rawSummary = parsed.find((row) => row.kind === 'summary')?.value ?? {};
  const total = Number(rawSummary.total || 0);
  const completed = Number(rawSummary.completed || 0);
  const inProgress = Number(rawSummary.inProgress || 0);
  const late = Number(rawSummary.late || 0);
  const other = Number(rawSummary.other || 0);
  const nullableNumber = (value: unknown) => value === null || value === undefined ? null : Number(value);

  return {
    total,
    completed,
    inProgress,
    late,
    other,
    productivityRate: total > 0 ? Math.round(completed / total * 100) : null,
    avgCompletionDays: nullableNumber(rawSummary.avgCompletionDays),
    avgApprovedBudgetCents: nullableNumber(rawSummary.avgApprovedBudgetCents),
    typeStats: parsed.filter((row) => row.kind === 'type').map((row) => ({
      type: String(row.value.type), count: Number(row.value.count)
    })).sort((left, right) => left.type.localeCompare(right.type, 'pt-BR')),
    statusStats: parsed.filter((row) => row.kind === 'status').map((row) => ({
      status: String(row.value.status), count: Number(row.value.count)
    })).sort((left, right) => left.status.localeCompare(right.status, 'pt-BR')),
    topProjects: parsed.filter((row) => row.kind === 'top').map((row) => ({
      name: String(row.value.name),
      Receita: Number(row.value.Receita),
      Custo: Number(row.value.Custo),
      Lucro: Number(row.value.Lucro),
      tipo: String(row.value.tipo)
    }))
  };
}

export function getProjectOverview(filters: ProjectFilters = {}) {
  const key = JSON.stringify(filters);
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) return existing.promise;
  const promise = queryProjectOverview(filters).catch((error) => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
    throw error;
  });
  cache.set(key, { expiresAt: now + 30_000, promise });
  return promise;
}
