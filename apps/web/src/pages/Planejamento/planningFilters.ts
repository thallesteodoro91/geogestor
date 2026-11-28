import type {
  StrategicCheckin,
  StrategicDecision,
  StrategicInitiative,
  StrategicKeyResult,
  StrategicObjective,
  StrategicRisk
} from '@geogestor/contracts';
import { planningStatusOptions } from './planningMetadata';
import { strategicRiskObjectiveId } from '@geogestor/contracts/src/strategic-planning';

export const planningFilterKeys = ['responsavel', 'status', 'prioridade', 'prazo', 'objetivo', 'risco', 'dados', 'ordem', 'busca'] as const;
export type PlanningTab = 'visao' | 'objetivos' | 'iniciativas' | 'revisoes';
export type PlanningFilterKey = typeof planningFilterKeys[number];
export type PlanningFilters = Record<PlanningFilterKey, string>;
export type GovernanceView = 'revisoes' | 'decisoes' | 'riscos' | 'todas';
export function governanceView(params: URLSearchParams): GovernanceView {
  const view = params.get('revisoes.lista');
  if (view === 'revisoes' || view === 'decisoes' || view === 'riscos' || view === 'todas') return view;
  const focus = params.get('foco');
  if (focus && /^(risk|decision|checkin)-/.test(focus)) return governanceViewForRecord(focus);
  // Existing bookmarks keep their combined view and their original criteria.
  return planningFilterKeys.some(key => params.has(`revisoes.${key}`)) ? 'todas' : 'revisoes';
}
export function governanceViewForRecord(record: string): GovernanceView {
  return record.startsWith('risk-') ? 'riscos' : record.startsWith('decision-') ? 'decisoes' : 'revisoes';
}
export function normalizeGovernanceFilters(filters: PlanningFilters, view: GovernanceView): PlanningFilters {
  if (view === 'todas') return filters;
  const kind = view === 'revisoes' ? 'checkin' : view === 'decisoes' ? 'decision' : 'risk';
  return { ...filters,
    status: planningStatusOptions[kind].some(([value]) => value === filters.status) ? filters.status : '',
    responsavel: view === 'revisoes' ? '' : filters.responsavel,
    prazo: view === 'decisoes' ? filters.prazo : '',
    risco: view === 'riscos' ? filters.risco : '',
    ordem: view !== 'decisoes' && filters.ordem === 'prazo' ? '' : filters.ordem
  };
}

// Every navigation path clears the same filter/page scope, without touching another tab.
export function clearPlanningScope(params: URLSearchParams, tab: PlanningTab, filters = true): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const name of [...next.keys()]) {
    if (name.startsWith(`${tab}.pagina`) || (filters && planningFilterKeys.some(key => name === `${tab}.${key}`))) next.delete(name);
  }
  next.delete('foco');
  return next;
}
export function changeGovernanceView(params: URLSearchParams, view: GovernanceView): URLSearchParams {
  const next = clearPlanningScope(params, 'revisoes', false);
  next.set('revisoes.lista', view);
  const filters = normalizeGovernanceFilters(planningFiltersFromParams(next, 'revisoes'), view);
  for (const key of planningFilterKeys) {
    if (filters[key]) next.set(`revisoes.${key}`, filters[key]);
    else next.delete(`revisoes.${key}`);
  }
  return next;
}

export const emptyPlanningFilters: PlanningFilters = {
  responsavel: '', status: '', prioridade: '', prazo: '', objetivo: '', risco: '', dados: '', ordem: '', busca: ''
};

const tabKeys: Record<PlanningTab, readonly PlanningFilterKey[]> = {
  visao: [],
  objetivos: ['responsavel', 'status', 'prioridade', 'prazo', 'dados', 'ordem', 'busca'],
  iniciativas: ['responsavel', 'status', 'prazo', 'objetivo', 'ordem', 'busca'],
  revisoes: ['responsavel', 'status', 'prazo', 'objetivo', 'risco', 'ordem', 'busca']
};
export const planningStatuses = {
  objetivos: planningStatusOptions.objective.map(([value]) => value),
  iniciativas: planningStatusOptions.initiative.map(([value]) => value),
  revisoes: [...planningStatusOptions.decision, ...planningStatusOptions.risk, ...planningStatusOptions.checkin].map(([value]) => value)
} as const;

export function normalizePlanningFilters(filters: PlanningFilters, tab: PlanningTab): PlanningFilters {
  const next = { ...emptyPlanningFilters };
  for (const key of tabKeys[tab]) next[key] = key === 'busca' ? (filters[key] || '').slice(0, 180) : filters[key]?.trim() || '';
  if (tab === 'visao') return next;
  if (!(planningStatuses[tab] as readonly string[]).includes(next.status)) next.status = '';
  const order = tab === 'objetivos' ? ['prazo', 'prioridade', 'progresso', 'atualizacao'] : tab === 'iniciativas' ? ['prazo', 'progresso', 'atualizacao'] : ['prazo', 'atualizacao'];
  if (!order.includes(next.ordem)) next.ordem = '';
  if (!['baixa', 'media', 'alta', 'critica'].includes(next.prioridade)) next.prioridade = '';
  if (!['baixo', 'medio', 'alto', 'critico'].includes(next.risco)) next.risco = '';
  if (!['vencido', 'proximos_30', 'futuro'].includes(next.prazo)) next.prazo = '';
  if (!['desatualizado', 'indisponivel'].includes(next.dados)) next.dados = '';
  if (next.objetivo && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(next.objetivo)) next.objetivo = '';
  return next;
}

export function planningFiltersFromParams(params: URLSearchParams, tab?: PlanningTab): PlanningFilters {
  const filters = Object.fromEntries(planningFilterKeys.map((key) => [key, params.get(tab ? `${tab}.${key}` : key) || ''])) as PlanningFilters;
  return tab ? normalizePlanningFilters(filters, tab) : filters;
}

// Legacy bookmarks are migrated once into the current tab. Other tabs retain their own URL state.
export function normalizePlanningParams(params: URLSearchParams, tab: PlanningTab): URLSearchParams {
  const next = new URLSearchParams(params);
  const legacy = normalizePlanningFilters(planningFiltersFromParams(params), tab);
  for (const key of planningFilterKeys) {
    if (legacy[key] && !next.has(`${tab}.${key}`)) next.set(`${tab}.${key}`, legacy[key]);
    next.delete(key);
  }
  next.set('revisoes.lista', governanceView(next));
  for (const area of Object.keys(tabKeys) as PlanningTab[]) {
    const filters = area === 'revisoes' ? normalizeGovernanceFilters(planningFiltersFromParams(next, area), governanceView(next)) : planningFiltersFromParams(next, area);
    for (const key of planningFilterKeys) {
      if (filters[key]) next.set(`${area}.${key}`, filters[key]);
      else next.delete(`${area}.${key}`);
    }
  }
  next.set('aba', tab);
  return next;
}

export function changePlanningTab(params: URLSearchParams, from: PlanningTab, to: PlanningTab): URLSearchParams {
  const next = normalizePlanningParams(params, from);
  next.set('aba', to);
  next.delete('foco');
  return next;
}

export function changePlanningCycle(params: URLSearchParams, cycleId: string): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const name of [...next.keys()]) if (Object.keys(tabKeys).some(tab => name.startsWith(`${tab}.`))) next.delete(name);
  for (const key of planningFilterKeys) {
    next.delete(key);
  }
  next.delete('foco');
  next.set('ciclo', cycleId);
  return next;
}

export function hasPlanningFilters(filters: PlanningFilters) {
  return planningFilterKeys.some((key) => key !== 'ordem' && Boolean(filters[key]));
}

function matchesText(value: string | null | undefined, filter: string) {
  const text = filter?.trim();
  return !text || Boolean(value?.toLocaleLowerCase('pt-BR').includes(text.toLocaleLowerCase('pt-BR')));
}

function matchesDeadline(value: string, filter: string, today: string) {
  if (!filter) return true;
  if (filter === 'vencido') return value < today;
  if (filter === 'proximos_30') {
    const end = new Date(`${today}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 30);
    return value >= today && value <= end.toISOString().slice(0, 10);
  }
  if (filter === 'futuro') {
    const end = new Date(`${today}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 30);
    return value > end.toISOString().slice(0, 10);
  }
  return true;
}

const priorityWeight: Record<string, number> = { critica: 4, alta: 3, media: 2, baixa: 1 };
export const riskImpactWeight: Record<string, number> = { critico: 4, alto: 3, medio: 2, baixo: 1 };

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
    return matchesText(`${item.titulo} ${item.descricao || ''}`, filters.busca)
      && matchesText(item.responsavel, filters.responsavel)
      && (!filters.status || item.status === filters.status)
      && (!filters.prioridade || item.prioridade === filters.prioridade)
      && matchesDeadline(item.dataLimite, filters.prazo, today)
      && dataMatch;
  });
  return filtered.sort((a, b) => {
    if (filters.ordem === 'prioridade') return (priorityWeight[b.prioridade] || 0) - (priorityWeight[a.prioridade] || 0) || a.id.localeCompare(b.id);
    if (filters.ordem === 'progresso') return (b.progresso ?? -1) - (a.progresso ?? -1) || a.id.localeCompare(b.id);
    if (filters.ordem === 'atualizacao') return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
    if (filters.ordem === 'prazo') return a.dataLimite.localeCompare(b.dataLimite) || a.id.localeCompare(b.id);
    return (a.ordem ?? 0) - (b.ordem ?? 0) || a.dataLimite.localeCompare(b.dataLimite) || a.id.localeCompare(b.id);
  });
}

export function filterAndSortInitiatives(items: StrategicInitiative[], filters: PlanningFilters, today: string) {
  return items.filter((item) => matchesText(`${item.titulo} ${item.descricao || ''}`, filters.busca)
    && matchesText(item.responsavel, filters.responsavel)
    && (!filters.status || item.status === filters.status)
    && (!filters.objetivo || item.objetivoId === filters.objetivo)
    && matchesDeadline(item.dataLimite, filters.prazo, today))
    .sort((a, b) => {
      if (filters.ordem === 'progresso') return b.progresso - a.progresso || a.id.localeCompare(b.id);
      if (filters.ordem === 'atualizacao') return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
      return a.dataLimite.localeCompare(b.dataLimite) || a.id.localeCompare(b.id);
    });
}

export function filterDecisions(items: StrategicDecision[], filters: PlanningFilters, today: string) {
  return items.filter((item) => matchesText(item.descricao, filters.busca)
    && matchesText(item.responsavel, filters.responsavel)
    && (!filters.status || item.status === filters.status)
    && (!filters.objetivo || item.objetivoId === filters.objetivo)
    && matchesDeadline(item.prazo, filters.prazo, today))
    .sort((a, b) => filters.ordem === 'atualizacao'
      ? b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)
      : a.prazo.localeCompare(b.prazo) || a.id.localeCompare(b.id));
}

export function filterRisks(items: StrategicRisk[], filters: PlanningFilters, initiatives: ReadonlyArray<Pick<StrategicInitiative, 'id' | 'objetivoId'>> = []) {
  return items.filter((item) => matchesText(item.descricao, filters.busca)
    && matchesText(item.responsavel, filters.responsavel)
    && (!filters.status || item.status === filters.status)
    && (!filters.objetivo || strategicRiskObjectiveId(item, initiatives) === filters.objetivo)
    && (!filters.risco || item.impacto === filters.risco))
    .sort((a, b) => filters.ordem === 'atualizacao'
      ? b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)
      : (riskImpactWeight[b.impacto] || 0) - (riskImpactWeight[a.impacto] || 0) || a.id.localeCompare(b.id));
}

export function filterCheckins(items: StrategicCheckin[], filters: PlanningFilters) {
  return items.filter((item) => matchesText(item.narrativa, filters.busca)
    && (!filters.status || item.status === filters.status)
    && (!filters.objetivo || item.objetivoId === filters.objetivo))
    .sort((a, b) => filters.ordem === 'atualizacao' ? b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id) : b.data.localeCompare(a.data) || a.id.localeCompare(b.id));
}
