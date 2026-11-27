import { useState } from 'react';
import type { StrategicPlanningSnapshot } from '@geogestor/contracts';
import { FunnelSimple, X } from '@phosphor-icons/react';
import { FormSelect } from '../../components/Form';
import { cn } from '../../utils/cn';
import { filterNativeSelectClass } from '../../utils/filterStyles';
import { secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { planningStatusOptions, planningPriorityOptions, planningImpactOptions, planningLabels } from './planningMetadata';
import { planningFilterKeys, type PlanningFilterKey, type PlanningFilters, type GovernanceView } from './planningFilters';

type Props = {
  filters: PlanningFilters;
  snapshot: StrategicPlanningSnapshot;
  resultCount: number;
  totalCount: number;
  mode: 'objectives' | 'initiatives' | 'reviews';
  view?: GovernanceView;
  onChange: (key: PlanningFilterKey, value: string) => void;
  onClear: () => void;
};

export function PlanningFilterBar({ filters, snapshot, resultCount, totalCount, mode, view = 'todas', onChange, onClear }: Props) {
  const owners = [...new Set([
    ...(mode === 'objectives' ? snapshot.objetivos : mode === 'initiatives' ? snapshot.iniciativas : view === 'decisoes' ? snapshot.decisoes : view === 'riscos' ? snapshot.riscos : [...snapshot.riscos, ...snapshot.decisoes]).map(item => item.responsavel)
  ])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const active = Object.values(filters).some(Boolean);
  const [expanded, setExpanded] = useState(false);
  const secondaryCount = planningFilterKeys.filter(key => key !== 'busca' && filters[key]).length;
  const statuses = mode === 'objectives' ? planningStatusOptions.objective
    : mode === 'initiatives' ? planningStatusOptions.initiative
    : view === 'revisoes' ? planningStatusOptions.checkin
    : view === 'decisoes' ? planningStatusOptions.decision
    : view === 'riscos' ? planningStatusOptions.risk
    : [...planningStatusOptions.decision.map(([value, text]) => [value, `Decisão: ${text}`]), ...planningStatusOptions.risk.map(([value, text]) => [value, `Risco: ${text}`]), ...planningStatusOptions.checkin.map(([value, text]) => [value, `Revisão: ${text}`])];
  const orderOptions = mode === 'objectives'
    ? [['', 'Ordem do planejamento'], ['prazo', 'Prazo'], ['prioridade', 'Prioridade'], ['progresso', 'Progresso'], ['atualizacao', 'Atualização']]
    : mode === 'initiatives'
      ? [['', 'Prazo do planejamento'], ['prazo', 'Prazo'], ['progresso', 'Progresso'], ['atualizacao', 'Atualização']]
      : view === 'revisoes' ? [['', 'Data da revisão'], ['atualizacao', 'Atualização']] : view === 'riscos' ? [['', 'Impacto'], ['atualizacao', 'Atualização']] : [['', 'Prazo e relevância'], ['prazo', 'Prazo'], ['atualizacao', 'Atualização']];
  const labels: Record<PlanningFilterKey, string> = { responsavel: 'Responsável', status: 'Situação', prioridade: 'Prioridade', prazo: 'Prazo', objetivo: 'Objetivo', risco: 'Impacto do risco', dados: 'Qualidade dos dados', ordem: 'Ordenação', busca: 'Busca' };
  const values: Record<string, string> = { ...planningLabels, ...Object.fromEntries([...statuses, ...orderOptions, ['vencido', 'Vencidos'], ['proximos_30', 'Próximos 30 dias'], ['futuro', 'Depois de 30 dias'], ['desatualizado', 'Desatualizados'], ['indisponivel', 'Indisponíveis']]) };
  const chipValue = (key: PlanningFilterKey) => key === 'risco' ? planningLabels[filters[key]] || filters[key] : key === 'objetivo' ? snapshot.objetivos.find(item => item.id === filters[key])?.titulo || 'Objetivo indisponível' : values[filters[key]] || filters[key];

  return (
    <section className="geo-surface rounded-lg p-4" aria-label="Filtros do planejamento">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" aria-atomic="true" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          <FunnelSimple aria-hidden="true" className="h-4 w-4" />
          {resultCount} de {totalCount} {totalCount === 1 ? 'registro' : 'registros'}
        </p>
        {active ? (
          <button type="button" onClick={onClear} className={secondarySmallActionButtonClass}>
            <X aria-hidden="true" className="h-4 w-4" /> Limpar filtros
          </button>
        ) : null}
      </div>
      {active ? <ul aria-label="Critérios ativos" className="mt-3 flex flex-wrap gap-2">
        {planningFilterKeys.filter(key => filters[key]).map(key => <li key={key} className="min-w-0 max-w-full">
          <button type="button" onClick={() => onChange(key, '')} aria-label={`Remover ${labels[key].toLowerCase()}: ${chipValue(key)}`} className={cn(secondarySmallActionButtonClass, 'max-w-full text-xs')}>
            <span className="min-w-0 break-words">{labels[key]}: {chipValue(key)}</span><X aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          </button>
        </li>)}
      </ul> : null}
      {mode === 'reviews' && view === 'todas' ? <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Busca, situação e objetivo afetam as três listas. Responsável filtra decisões e riscos; prazo filtra decisões; impacto filtra riscos. Sem data de prazo, revisões e riscos mantêm sua ordem por data e impacto.</p> : null}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-[min(100%,18rem)] flex-1 text-xs font-semibold text-zinc-600 sm:max-w-xl dark:text-zinc-300">
          Buscar por título ou descrição
          <input type="search" name="planning-search" maxLength={180} autoComplete="off" value={filters.busca} onChange={event => onChange('busca', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')} />
        </label>
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="planning-secondary-filters" className={cn(secondarySmallActionButtonClass, 'shrink-0')}>
        <FunnelSimple aria-hidden="true" className="h-4 w-4" /> {expanded ? 'Recolher filtros' : 'Mais filtros'}{secondaryCount ? ` (${secondaryCount})` : ''}
      </button>
      </div>
      <div id="planning-secondary-filters" hidden={!expanded}>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mode !== 'reviews' || view !== 'revisoes' ? <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          Responsável
          <FormSelect aria-label="Filtrar por responsável" value={filters.responsavel} onChange={(event) => onChange('responsavel', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
            <option value="">Todos</option>
            {filters.responsavel && !owners.includes(filters.responsavel) ? <option value={filters.responsavel}>{filters.responsavel}</option> : null}
            {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
          </FormSelect>
        </label> : null}
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          Situação
          <FormSelect aria-label="Filtrar por situação" value={filters.status} onChange={(event) => onChange('status', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
            <option value="">Todas</option>
            {statuses.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </FormSelect>
        </label>
        {mode === 'objectives' ? (
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            Prioridade
            <FormSelect aria-label="Filtrar por prioridade" value={filters.prioridade} onChange={(event) => onChange('prioridade', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
              <option value="">Todas</option>{planningPriorityOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </FormSelect>
          </label>
        ) : (
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            Objetivo
            <FormSelect aria-label="Filtrar por objetivo" value={filters.objetivo} onChange={(event) => onChange('objetivo', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
              <option value="">Todos</option>
              {snapshot.objetivos.map((objective) => <option key={objective.id} value={objective.id}>{objective.titulo}</option>)}
            </FormSelect>
          </label>
        )}
        {mode !== 'reviews' || view === 'decisoes' || view === 'todas' ? <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          Prazo
          <FormSelect aria-label="Filtrar por prazo" value={filters.prazo} onChange={(event) => onChange('prazo', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
            <option value="">Todos</option><option value="vencido">Vencidos</option><option value="proximos_30">Próximos 30 dias</option><option value="futuro">Depois de 30 dias</option>
          </FormSelect>
        </label> : null}
        {mode === 'objectives' ? (
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            Qualidade dos dados
            <FormSelect aria-label="Filtrar por qualidade dos dados" value={filters.dados} onChange={(event) => onChange('dados', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
              <option value="">Todos</option><option value="desatualizado">Desatualizados</option><option value="indisponivel">Indisponíveis</option>
            </FormSelect>
          </label>
        ) : null}
        {mode === 'reviews' && (view === 'riscos' || view === 'todas') ? (
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            Impacto do risco
            <FormSelect aria-label="Filtrar por impacto do risco" value={filters.risco} onChange={(event) => onChange('risco', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
              <option value="">Todos</option>{planningImpactOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </FormSelect>
          </label>
        ) : null}
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          Ordenar por
          <FormSelect aria-label="Ordenar registros" value={filters.ordem} onChange={(event) => onChange('ordem', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
            {orderOptions.map(([value, text]) => <option key={value || 'default'} value={value}>{text}</option>)}
          </FormSelect>
        </label>
      </div>
      </div>
    </section>
  );
}
