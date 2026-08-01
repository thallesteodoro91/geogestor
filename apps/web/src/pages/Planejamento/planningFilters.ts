import type {
  StrategicCheckin,
  StrategicDecision,
  StrategicInitiative,
  StrategicKeyResult,
  StrategicObjective,
  StrategicRisk
} from '@geogestor/contracts';

export const planningFilterKeys = ['responsavel', 'status', 'prioridade', 'prazo', 'objetivo', 'risco', 'dados', 'ordem'] as const;
export type PlanningFilterKey = typeof planningFilterKeys[number];
export type PlanningFilters = Record<PlanningFilterKey, string>;

export const emptyPlanningFilters: PlanningFilters = {
  responsavel: '', status: '', prioridade: '', prazo: '', objetivo: '', risco: '', dados: '', ordem: ''
};

export function planningFiltersFromParams(params: URLSearchParams): PlanningFilters {
  return Object.fromEntries(planningFilterKeys.map((key) => [key, params.get(key) || ''])) as PlanningFilters;
}

export function hasPlanningFilters(filters: PlanningFilters) {
  return planningFilterKeys.some((key) => Boolean(filters[key]));
}

function matchesText(value: string | null | undefined, filter: string) {
  return !filter || Boolean(value?.toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')));
}

function matchesDeadline(value: string, filter: string, today: string) {
  if (!filter) return true;
  if (filter === 'vencido') return value < today;
  if (filter === 'proximos_30') {
    const end = new Date(`${today}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 30);
    return value >= today && value <= end.toISOString().slice(0, 10);
  }
  return value > today;
}

const priorityWeight: Record<string, number> = { critica: 4, alta: 3, media: 2, baixa: 1 };

export function filterAndSortObjectives(
  objectives: StrategicObjective[],
  keyResults: StrategicKeyResult[],
  filters: PlanningFilters,
  today: string
) {
  const filtered = objectives.filter((item) => {
    const ownResults = keyResults.filter((result) => result.objetivoId === item.id);
    const dataMatch = !filters.dados
      || (filters.dados === 'desatualizado' && ownResults.some((result) => result.estadoDado === 'desatualizado'))
      || (filters.dados === 'indisponivel' && ownResults.some((result) => result.estadoDado === 'indisponivel'));
    return matchesText(item.responsavel, filters.responsavel)
      && (!filters.status || item.status === filters.status)
      && (!filters.prioridade || item.prioridade === filters.prioridade)
      && matchesDeadline(item.dataLimite, filters.prazo, today)
      && dataMatch;
  });
  return filtered.sort((a, b) => {
    if (filters.ordem === 'prioridade') return (priorityWeight[b.prioridade] || 0) - (priorityWeight[a.prioridade] || 0);
    if (filters.ordem === 'progresso') return (b.progresso ?? -1) - (a.progresso ?? -1);
    if (filters.ordem === 'atualizacao') return b.updatedAt.localeCompare(a.updatedAt);
    if (filters.ordem === 'prazo') return a.dataLimite.localeCompare(b.dataLimite);
    return (a.ordem ?? 0) - (b.ordem ?? 0) || a.dataLimite.localeCompare(b.dataLimite);
  });
}

export function filterAndSortInitiatives(items: StrategicInitiative[], filters: PlanningFilters, today: string) {
  return items.filter((item) => matchesText(item.responsavel, filters.responsavel)
    && (!filters.status || item.status === filters.status)
    && (!filters.objetivo || item.objetivoId === filters.objetivo)
    && matchesDeadline(item.dataLimite, filters.prazo, today))
    .sort((a, b) => {
      if (filters.ordem === 'progresso') return b.progresso - a.progresso;
      if (filters.ordem === 'atualizacao') return b.updatedAt.localeCompare(a.updatedAt);
      return a.dataLimite.localeCompare(b.dataLimite);
    });
}

export function filterDecisions(items: StrategicDecision[], filters: PlanningFilters, today: string) {
  if (filters.risco) return [];
  return items.filter((item) => matchesText(item.responsavel, filters.responsavel)
    && (!filters.status || item.status === filters.status)
    && (!filters.objetivo || item.objetivoId === filters.objetivo)
    && matchesDeadline(item.prazo, filters.prazo, today))
    .sort((a, b) => filters.ordem === 'atualizacao'
      ? b.updatedAt.localeCompare(a.updatedAt)
      : a.prazo.localeCompare(b.prazo));
}

export function filterRisks(items: StrategicRisk[], filters: PlanningFilters) {
  if (filters.prazo) return [];
  return items.filter((item) => matchesText(item.responsavel, filters.responsavel)
    && (!filters.status || item.status === filters.status)
    && (!filters.objetivo || item.objetivoId === filters.objetivo)
    && (!filters.risco || item.impacto === filters.risco))
    .sort((a, b) => filters.ordem === 'atualizacao'
      ? b.updatedAt.localeCompare(a.updatedAt)
      : (priorityWeight[b.impacto] || 0) - (priorityWeight[a.impacto] || 0));
}

export function filterCheckins(items: StrategicCheckin[], filters: PlanningFilters) {
  if (filters.responsavel || filters.prazo || filters.risco) return [];
  return items.filter((item) => (!filters.status || item.status === filters.status)
    && (!filters.objetivo || item.objetivoId === filters.objetivo));
}
