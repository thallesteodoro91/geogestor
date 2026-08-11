import type { StrategicPlanningSnapshot } from '@geogestor/contracts';
import { FunnelSimple, X } from '@phosphor-icons/react';
import { FormSelect } from '../../components/Form';
import { cn } from '../../utils/cn';
import { filterNativeSelectClass } from '../../utils/filterStyles';
import { secondarySmallActionButtonClass } from '../../utils/actionStyles';
import type { PlanningFilterKey, PlanningFilters } from './planningFilters';

type Props = {
  filters: PlanningFilters;
  snapshot: StrategicPlanningSnapshot;
  resultCount: number;
  totalCount: number;
  mode: 'objectives' | 'initiatives' | 'reviews';
  onChange: (key: PlanningFilterKey, value: string) => void;
  onClear: () => void;
};

export function PlanningFilterBar({ filters, snapshot, resultCount, totalCount, mode, onChange, onClear }: Props) {
  const owners = [...new Set([
    ...snapshot.objetivos.map((item) => item.responsavel),
    ...snapshot.iniciativas.map((item) => item.responsavel),
    ...snapshot.riscos.map((item) => item.responsavel),
    ...snapshot.decisoes.map((item) => item.responsavel)
  ])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const active = Object.values(filters).some(Boolean);
  const statuses = mode === 'objectives'
    ? [['nao_iniciado', 'Não iniciado'], ['em_andamento', 'Em andamento'], ['em_risco', 'Em risco'], ['concluido', 'Concluído'], ['cancelado', 'Cancelado']]
    : mode === 'initiatives'
      ? [['planejada', 'Planejada'], ['em_andamento', 'Em andamento'], ['bloqueada', 'Bloqueada'], ['concluida', 'Concluída'], ['cancelada', 'Cancelada']]
      : [['pendente', 'Decisão pendente'], ['em_andamento', 'Decisão em andamento'], ['concluida', 'Decisão concluída'], ['cancelada', 'Decisão cancelada'], ['aberto', 'Risco aberto'], ['mitigando', 'Risco em mitigação'], ['resolvido', 'Risco resolvido'], ['no_rumo', 'Revisão no rumo'], ['atencao', 'Revisão em atenção'], ['critico', 'Revisão crítica']];
  const orderOptions = mode === 'objectives'
    ? [['', 'Ordem do planejamento'], ['prazo', 'Prazo'], ['prioridade', 'Prioridade'], ['progresso', 'Progresso'], ['atualizacao', 'Atualização']]
    : mode === 'initiatives'
      ? [['', 'Prazo do planejamento'], ['prazo', 'Prazo'], ['progresso', 'Progresso'], ['atualizacao', 'Atualização']]
      : [['', 'Prazo e relevância'], ['prazo', 'Prazo'], ['atualizacao', 'Atualização']];

  return (
    <section className="geo-surface rounded-lg p-4" aria-label="Filtros do planejamento">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          <FunnelSimple aria-hidden="true" className="h-4 w-4" />
          {resultCount} de {totalCount} {totalCount === 1 ? 'registro' : 'registros'}
        </p>
        {active ? (
          <button type="button" onClick={onClear} className={secondarySmallActionButtonClass}>
            <X aria-hidden="true" className="h-4 w-4" /> Limpar filtros
          </button>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          Responsável
          <FormSelect aria-label="Filtrar por responsável" value={filters.responsavel} onChange={(event) => onChange('responsavel', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
            <option value="">Todos</option>
            {owners.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
          </FormSelect>
        </label>
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
              <option value="">Todas</option><option value="critica">Crítica</option><option value="alta">Alta</option><option value="media">Média</option><option value="baixa">Baixa</option>
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
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          Prazo
          <FormSelect aria-label="Filtrar por prazo" value={filters.prazo} onChange={(event) => onChange('prazo', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
            <option value="">Todos</option><option value="vencido">Vencidos</option><option value="proximos_30">Próximos 30 dias</option><option value="futuro">Depois de 30 dias</option>
          </FormSelect>
        </label>
        {mode === 'objectives' ? (
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            Qualidade dos dados
            <FormSelect aria-label="Filtrar por qualidade dos dados" value={filters.dados} onChange={(event) => onChange('dados', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
              <option value="">Todos</option><option value="desatualizado">Desatualizados</option><option value="indisponivel">Indisponíveis</option>
            </FormSelect>
          </label>
        ) : null}
        {mode === 'reviews' ? (
          <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            Impacto do risco
            <FormSelect aria-label="Filtrar por impacto do risco" value={filters.risco} onChange={(event) => onChange('risco', event.target.value)} className={cn(filterNativeSelectClass, 'mt-1.5 w-full')}>
              <option value="">Todos</option><option value="critico">Crítico</option><option value="alto">Alto</option><option value="medio">Médio</option><option value="baixo">Baixo</option>
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
    </section>
  );
}
