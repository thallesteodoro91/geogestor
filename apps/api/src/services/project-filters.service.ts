import { and, eq, gte, isNull, like, lte, or, sql, type SQL } from 'drizzle-orm';
import { schema } from '@geogestor/database';

export const UNINFORMED_PROJECT_TYPE = 'Não informado';

export type ProjectStatusCategory = 'late' | 'in_progress' | 'completed' | 'other';

export type ProjectFilters = {
  clienteId?: string;
  q?: string;
  status?: string;
  tipo?: string;
  inicio?: string;
  fim?: string;
  situacao?: ProjectStatusCategory;
};

const normalizedStatus = sql<string>`lower(trim(coalesce(${schema.projetos.status}, '')))`;

export const normalizedProjectType = sql<string>`coalesce(nullif(trim(${schema.projetos.tipo}), ''), ${UNINFORMED_PROJECT_TYPE})`;

export function completedProjectCondition() {
  return sql<boolean>`${normalizedStatus} in ('concluído', 'concluido', 'finalizado')`;
}

export function lateProjectCondition(today: string) {
  return sql<boolean>`not (${completedProjectCondition()})
    and ${normalizedStatus} not in ('cancelado', 'arquivado')
    and (${normalizedStatus} = 'atrasado' or (${schema.projetos.dataEntrega} is not null and substr(${schema.projetos.dataEntrega}, 1, 10) < ${today}))`;
}

export function inProgressProjectCondition(today: string) {
  return sql<boolean>`${normalizedStatus} = 'em andamento' and not (${lateProjectCondition(today)})`;
}

export function projectStatusCategoryCondition(category: ProjectStatusCategory | undefined, today: string): SQL | undefined {
  if (category === 'completed') return completedProjectCondition();
  if (category === 'late') return lateProjectCondition(today);
  if (category === 'in_progress') return inProgressProjectCondition(today);
  if (category === 'other') {
    return sql<boolean>`not (${completedProjectCondition()})
      and not (${lateProjectCondition(today)})
      and not (${inProgressProjectCondition(today)})`;
  }
  return undefined;
}

export function projectTypeCondition(type: string | undefined): SQL | undefined {
  if (!type) return undefined;
  if (type === UNINFORMED_PROJECT_TYPE) return sql`nullif(trim(${schema.projetos.tipo}), '') is null`;
  return sql`trim(${schema.projetos.tipo}) = ${type}`;
}

export function buildProjectWhere(filters: ProjectFilters, today = new Date().toISOString().slice(0, 10)) {
  const q = filters.q?.trim();
  return and(
    isNull(schema.projetos.deletedAt),
    filters.clienteId ? eq(schema.projetos.clienteId, filters.clienteId) : undefined,
    filters.status ? eq(schema.projetos.status, filters.status) : undefined,
    projectTypeCondition(filters.tipo),
    filters.inicio ? gte(schema.projetos.dataInicio, filters.inicio) : undefined,
    filters.fim ? lte(schema.projetos.dataInicio, filters.fim) : undefined,
    projectStatusCategoryCondition(filters.situacao, today),
    q ? or(
      like(schema.projetos.nome, `%${q}%`),
      like(schema.clientes.nome, `%${q}%`),
      like(schema.projetos.descricao, `%${q}%`),
      like(schema.projetos.cidade, `%${q}%`),
      like(schema.projetos.municipio, `%${q}%`),
      like(schema.projetos.matricula, `%${q}%`),
      like(schema.projetos.car, `%${q}%`)
    ) : undefined
  );
}

export function projectStatusBucketExpression(today: string) {
  return sql<string>`case
    when ${completedProjectCondition()} then 'completed'
    when ${lateProjectCondition(today)} then 'late'
    when ${inProgressProjectCondition(today)} then 'in_progress'
    else 'other'
  end`;
}
