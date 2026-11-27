import { PlanningCycleGoalsWidget, PlanningGoalWidget, PlanningObjectiveWidget } from './Planejamento/PlanningAuraWidgets';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import './Planejamento/planning.css';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowSquareOut,
  CalendarCheck,
  CheckCircle,
  Compass,
  Database,
  Flag,
  FunnelSimple,
  Lightbulb,
  ListChecks,
  PencilSimple,
  Plus,
  RocketLaunch,
  ShieldWarning,
  Target,
  Trash,
  WarningCircle
} from '@phosphor-icons/react';
import type {
  StrategicCheckin,
  StrategicCycle,
  StrategicDecision,
  StrategicInitiative,
  StrategicKeyResult,
  StrategicObjective,
  StrategicPlanningSnapshot,
  StrategicRisk
} from '@geogestor/contracts';
import { appLinks } from '@geogestor/contracts';
import { apiClient, acceptReviewedRecordVersion } from '../services/apiClient';
import { Layout } from '../components/Layout';
import { PageHeader } from '../components/PageHeader';
import { WidgetSection } from '../components/WidgetSection';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormSelect } from '../components/Form';
import {
  headerPrimaryActionButtonClass,
  headerPrimaryActionIconClass,
  primarySmallActionButtonClass,
  secondarySmallActionButtonClass
} from '../utils/actionStyles';
import {
  localNavigationBarClass,
  localNavigationButtonClass,
  localNavigationIconClass,
  localNavigationItemsClass
} from '../utils/localNavigationStyles';
import { filterNativeSelectClass } from '../utils/filterStyles';
import { cn } from '../utils/cn';
import { saoPauloDateKey } from '../utils/localDate';
import {
  StrategicPlanningFormModal,
  type PlanningDialog,
  type StrategicOptions
} from './Planejamento/StrategicPlanningFormModal';
import { PlanningFilterBar } from './Planejamento/PlanningFilterBar';
import { PlanningCollection } from './Planejamento/PlanningCollection';
import { formatPlanningDate as formatDate, formatPlanningMeasure, planningEntities, planningLabels as statusLabels } from './Planejamento/planningMetadata';
import { planningAlertGroups, planningTimelineDescription, latestPlanningUpdate, planningDeletionDescription } from './Planejamento/planningPresentation';
import {
  filterAndSortInitiatives,
  filterAndSortObjectives,
  filterCheckins,
  filterDecisions,
  filterRisks,
  clearPlanningScope,
  changeGovernanceView,
  governanceView,
  governanceViewForRecord,
  planningFiltersFromParams,
  normalizePlanningParams,
  changePlanningTab,
  changePlanningCycle,
  hasPlanningFilters,
  type PlanningFilterKey,
  type PlanningFilters
} from './Planejamento/planningFilters';

type TabKey = 'visao' | 'objetivos' | 'iniciativas' | 'revisoes';
type EntityKind = PlanningDialog['kind'];
type DeleteTarget = { kind: EntityKind; id: string; title: string } | null;

const TAB_ITEMS: Array<{
  id: TabKey;
  label: string;
  icon: typeof Compass;
  tone: 'system' | 'field' | 'finance' | 'warning';
}> = [
  { id: 'visao', label: 'Visão estratégica', icon: Compass, tone: 'system' },
  { id: 'objetivos', label: 'Objetivos e metas', icon: Target, tone: 'field' },
  { id: 'iniciativas', label: 'Iniciativas', icon: RocketLaunch, tone: 'finance' },
  { id: 'revisoes', label: 'Revisões e riscos', icon: ShieldWarning, tone: 'warning' }
];

const statusTone: Record<string, string> = {
  ativo: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
  concluido: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
  concluida: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
  no_rumo: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
  em_risco: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100',
  atencao: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100',
  bloqueada: 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200',
  critico: 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200'
};

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatDateTime(value?: string | null) {
  if (!value) return 'Sem atualização';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

function label(value: string) {
  return statusLabels[value] || value.replaceAll('_', ' ');
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={cn(
      'inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
      statusTone[value] || 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
    )}>
      {label(value)}
    </span>
  );
}

function EntityActions({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel
}: {
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        aria-label={editLabel}
        title={editLabel}
        className="geo-focus-ring inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-indigo-200/80 bg-indigo-50 text-indigo-700 transition-[background-color,color,transform] duration-150 hover:bg-indigo-100 active:scale-[0.97] dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-200 dark:hover:bg-indigo-400/20"
      >
        <PencilSimple aria-hidden="true" className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={deleteLabel}
        title={deleteLabel}
        className="geo-focus-ring inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-red-200/80 bg-red-50 text-red-700 transition-[background-color,color,transform] duration-150 hover:bg-red-100 active:scale-[0.97] dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/20"
      >
        <Trash aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProgressBar({ value, labelText }: { value: number | null | undefined; labelText: string }) {
  const safe = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-zinc-600 dark:text-zinc-300">{labelText}</span>
        <span className="font-semibold tabular-nums text-zinc-950 dark:text-white">{value == null ? '—' : `${numberFormatter.format(value)}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" role="progressbar" aria-label={labelText} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value == null ? undefined : Math.round(safe)}>
        <div
          className={cn('h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none', safe < 50 ? 'bg-amber-500' : 'bg-brand-primary-600')}
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  meta,
  icon: Icon,
  tone = 'system'
}: {
  title: string;
  value: string;
  description: string;
  meta: string;
  icon: typeof Compass;
  tone?: 'system' | 'warning' | 'danger' | 'success';
}) {
  const toneClasses = {
    system: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200',
    warning: 'bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-100',
    danger: 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-200',
    success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200'
  };
  return (
    <article className="geo-surface min-w-0 rounded-lg p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-5 text-zinc-700 dark:text-zinc-200">{title}</h3>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-zinc-950 dark:text-white">{value}</p>
        </div>
        <span aria-hidden="true" className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', toneClasses[tone])}>
          <Icon className="h-5 w-5" weight="duotone" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
      <details className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400"><summary className="geo-focus-ring w-fit cursor-pointer rounded font-semibold">Fonte e referência</summary><p className="mt-2">{meta}</p></details>
    </article>
  );
}

function EmptyPlanning({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="geo-surface rounded-lg px-6 py-12 text-center sm:px-10" aria-labelledby="planning-empty-title">
      <span aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-brand-primary-200 bg-brand-primary-50 text-brand-primary-700 dark:border-brand-primary-400/20 dark:bg-brand-primary-400/10 dark:text-brand-primary-200">
        <Compass className="h-7 w-7" weight="duotone" />
      </span>
      <h2 id="planning-empty-title" className="mt-6 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
        Transforme a direção da empresa em objetivos mensuráveis
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400 sm:text-base">
        Crie um ciclo estratégico, defina os resultados esperados e conecte indicadores do Financeiro, CRM e Projetos.
      </p>
      <button type="button" onClick={onCreate} className={cn(primarySmallActionButtonClass, 'mx-auto mt-6')}>
        <Plus aria-hidden="true" className="h-4 w-4" />
        Criar primeiro planejamento
      </button>
      <ol className="mx-auto mt-10 grid max-w-4xl gap-4 border-t border-zinc-200 pt-8 text-left sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800">
        {[
          ['1. Defina', 'O ciclo e os pilares.'],
          ['2. Cadastre', 'Objetivos e metas.'],
          ['3. Vincule', 'Iniciativas e fontes.'],
          ['4. Revise', 'Decisões e riscos.']
        ].map(([step, text]) => (
          <li key={step} className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/60">
            <p className="font-semibold text-zinc-950 dark:text-white">{step}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="geo-surface rounded-lg border-dashed p-8 text-center" role="status">
      <FunnelSimple aria-hidden="true" className="mx-auto h-8 w-8 text-zinc-500" weight="duotone" />
      <h3 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">Nenhum registro corresponde aos filtros</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Ajuste os critérios ou limpe os filtros para voltar à visão completa.</p>
      <button type="button" onClick={onClear} className={cn(secondarySmallActionButtonClass, 'mx-auto mt-5')}>Limpar filtros</button>
    </div>
  );
}

function narrativeFor(snapshot: StrategicPlanningSnapshot, alerts: number) {
  if (alerts) return `${alerts} ${alerts === 1 ? 'contexto exige' : 'contextos exigem'} atenção antes da próxima revisão.`;
  if (!snapshot.objetivos.length) return 'O ciclo foi criado, mas ainda precisa de objetivos para se tornar mensurável.';
  if (snapshot.resumo.progressoGeral === null) return 'Os objetivos estão definidos, mas ainda não há resultados-chave suficientes para avaliar o progresso.';
  const attention = snapshot.resumo.objetivosEmRisco + snapshot.resumo.iniciativasAtrasadas + snapshot.resumo.decisoesPendentes;
  if (attention > 0) return `${attention} ${attention === 1 ? 'ponto exige' : 'pontos exigem'} atenção antes da próxima revisão.`;
  if (snapshot.resumo.dadosDesatualizados > 0) return 'O plano não apresenta desvios críticos, mas possui indicadores que precisam ser atualizados.';
  return 'O plano está avançando sem desvios críticos registrados neste momento.';
}

export function Planejamento() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('aba') as TabKey | null;
  const activeTab: TabKey = TAB_ITEMS.some((item) => item.id === requestedTab) ? requestedTab! : 'visao';
  const requestedCycleId = searchParams.get('ciclo');
  const normalizedParams = useMemo(() => normalizePlanningParams(searchParams, activeTab), [searchParams, activeTab]);
  const filters = useMemo(() => planningFiltersFromParams(normalizedParams, activeTab), [normalizedParams, activeTab]);
  const [dialog, setDialog] = useState<PlanningDialog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [announcement, setAnnouncement] = useState('');
  const [actionError, setActionError] = useState('');
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const lastRecordFocus = useRef('');

  useEffect(() => {
    if (normalizedParams.toString() !== searchParams.toString()) setSearchParams(normalizedParams, { replace: true });
  }, [normalizedParams, searchParams, setSearchParams]);

  const cyclesQuery = useQuery<StrategicCycle[]>({
    queryKey: ['strategic-cycles'],
    queryFn: () => apiClient.get('/api/planejamento/ciclos')
  });
  const cycles = cyclesQuery.data || [];
  const selectedCycle = cycles.find((cycle) => cycle.id === requestedCycleId)
    || cycles.find((cycle) => cycle.status === 'ativo')
    || cycles[0]
    || null;
  const cycleId = selectedCycle?.id || null;

  useEffect(() => {
    if (!cycleId || requestedCycleId === cycleId) return;
    const next = requestedCycleId ? changePlanningCycle(searchParams, cycleId) : new URLSearchParams(searchParams);
    next.set('ciclo', cycleId);
    next.set('aba', activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, cycleId, requestedCycleId, searchParams, setSearchParams]);

  const snapshotQuery = useQuery<StrategicPlanningSnapshot>({
    queryKey: ['strategic-snapshot', cycleId],
    queryFn: () => apiClient.get(`/api/planejamento/ciclos/${cycleId}`),
    enabled: Boolean(cycleId)
  });
  const optionsQuery = useQuery<StrategicOptions>({
    queryKey: ['strategic-options'],
    queryFn: () => apiClient.get('/api/planejamento/opcoes'),
    enabled: Boolean(cycleId)
  });

  // The snapshot contains several entity types; its GET cannot establish per-resource baselines.
  // Capture exactly the version shown when the editor/confirmation opens, never during refetch.
  const openDialog = (next: PlanningDialog) => {
    lastRecordFocus.current = '';
    if (next.initial) acceptReviewedRecordVersion(`/api/planejamento/${planningEntities[next.kind].endpoint}/${next.initial.id}`, next.initial.updatedAt);
    setActionError('');
    setDialog(next);
  };
  const requestDelete = (target: Exclude<DeleteTarget, null>) => {
    const data = snapshotQuery.data;
    if (!data) return;
    const records = {
      cycle: [data.ciclo], pillar: data.pilares, objective: data.objetivos, keyResult: data.resultadosChave,
      initiative: data.iniciativas, checkin: data.checkins, risk: data.riscos, decision: data.decisoes
    };
    const current = records[target.kind].find(item => item.id === target.id);
    if (!current) return;
    acceptReviewedRecordVersion(`/api/planejamento/${planningEntities[target.kind].endpoint}/${current.id}`, current.updatedAt);
    setActionError('');
    setDeleteTarget(target);
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['strategic-cycles'] }),
      queryClient.invalidateQueries({ queryKey: ['strategic-snapshot'] }),
      queryClient.invalidateQueries({ queryKey: ['strategic-options'] })
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ currentDialog, payload }: { currentDialog: PlanningDialog; payload: Record<string, unknown>; followWithDecision?: boolean }) => {
      const endpoint = planningEntities[currentDialog.kind].endpoint;
      if (currentDialog.initial?.id) {
        return apiClient.patch(`/api/planejamento/${endpoint}/${currentDialog.initial.id}`, payload);
      }
      return apiClient.post(`/api/planejamento/${endpoint}`, payload);
    },
    onSuccess: async (saved, { currentDialog, followWithDecision }) => {
      const message = currentDialog.initial?.id ? 'Alterações salvas.' : 'Registro estratégico criado.';
      if (currentDialog.kind === 'cycle' && !currentDialog.initial?.id && saved && typeof saved === 'object' && 'id' in saved && typeof saved.id === 'string') {
        queryClient.setQueryData<StrategicCycle[]>(['strategic-cycles'], current => [...(current || []), saved as StrategicCycle]);
        const next = changePlanningCycle(searchParams, saved.id);
        next.set('aba', 'visao');
        setSearchParams(next);
      } else if (currentDialog.kind !== 'cycle' && saved && typeof saved === 'object' && 'id' in saved && typeof saved.id === 'string') {
        const tab = ['pillar', 'objective', 'keyResult'].includes(currentDialog.kind) ? 'objetivos' : currentDialog.kind === 'initiative' ? 'iniciativas' : 'revisoes';
        const next = clearPlanningScope(changePlanningTab(searchParams, activeTab, tab), tab);
        if (tab === 'revisoes') next.set('revisoes.lista', governanceViewForRecord(`${currentDialog.kind}-${saved.id}`));
        next.set('foco', `${currentDialog.kind}-${saved.id}`);
        setSearchParams(next, { replace: true });
      }
      if (currentDialog.kind === 'checkin' && followWithDecision && saved && typeof saved === 'object' && 'id' in saved && typeof saved.id === 'string') {
        openDialog({ kind: 'decision', checkinId: saved.id, parentId: 'objetivoId' in saved && typeof saved.objetivoId === 'string' ? saved.objetivoId : undefined });
      } else setDialog(null);
      setAnnouncement(message);
      setActionError('');
      toast.success(message);
      await refresh();
    },
    onError: (error: Error) => {
      setActionError(error.message);
      toast.error(error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (target: Exclude<DeleteTarget, null>) => {
      await apiClient.delete(`/api/planejamento/${planningEntities[target.kind].endpoint}/${target.id}`);
    },
    onSuccess: async () => {
      setDeleteTarget(null);
      setAnnouncement('Registro estratégico excluído.');
      setActionError('');
      toast.success('Registro estratégico excluído.');
      await refresh();
    },
    onError: (error: Error) => {
      setActionError(error.message);
      toast.error(error.message);
    }
  });

  const setTab = (tab: TabKey) => {
    const next = changePlanningTab(searchParams, activeTab, tab);
    if (cycleId) next.set('ciclo', cycleId);
    setSearchParams(next);
  };

  const setFilter = (key: PlanningFilterKey, value: string) => {
    const next = clearPlanningScope(normalizedParams, activeTab, false);
    if (value) next.set(`${activeTab}.${key}`, value);
    else next.delete(`${activeTab}.${key}`);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => setSearchParams(clearPlanningScope(normalizedParams, activeTab), { replace: true });

  const handleTabKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const focusedId = (event.target as HTMLElement).closest('[role="tab"]')?.id;
    const currentIndex = TAB_ITEMS.findIndex((item) => focusedId ? `planning-tab-${item.id}` === focusedId : item.id === activeTab);
    let nextIndex: number;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TAB_ITEMS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + TAB_ITEMS.length) % TAB_ITEMS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TAB_ITEMS.length - 1;
    else return;
    event.preventDefault();
    setTab(TAB_ITEMS[nextIndex].id);
    // Tabs stay mounted; immediate focus also makes rapid key sequences independent of router rendering.
    tabListRef.current?.querySelector<HTMLButtonElement>(`#planning-tab-${TAB_ITEMS[nextIndex].id}`)?.focus();
  };

  const openPrimaryAction = () => {
    if (!selectedCycle) {
      openDialog({ kind: 'cycle' });
      return;
    }
    if (activeTab === 'revisoes') {
      openDialog({ kind: governanceView(normalizedParams) === 'decisoes' ? 'decision' : governanceView(normalizedParams) === 'riscos' ? 'risk' : 'checkin' });
      return;
    }
    if (!snapshotQuery.data?.pilares.length) {
      setTab('objetivos');
      openDialog({ kind: 'pillar' });
      return;
    }
    if (activeTab === 'iniciativas' && snapshotQuery.data?.objetivos.length) openDialog({ kind: 'initiative' });
    else {
      setTab('objetivos');
      openDialog({ kind: 'objective' });
    }
  };

  const primaryLabel = !selectedCycle ? 'Criar planejamento'
    : activeTab === 'revisoes' ? governanceView(normalizedParams) === 'decisoes' ? 'Nova decisão' : governanceView(normalizedParams) === 'riscos' ? 'Novo risco' : 'Registrar revisão'
    : !snapshotQuery.data?.pilares.length ? 'Novo pilar'
    : activeTab === 'iniciativas' && snapshotQuery.data?.objetivos.length ? 'Nova iniciativa' : 'Novo objetivo';

  const snapshot = snapshotQuery.data;
  const focusedRecord = searchParams.get('foco');
  useEffect(() => {
    if (!focusedRecord) { lastRecordFocus.current = ''; return; }
    if (!snapshot || !focusedRecord || dialog || deleteTarget) return;
    const signature = `${cycleId}:${activeTab}:${focusedRecord}`;
    if (lastRecordFocus.current === signature) return;
    let frame: number;
    const deadline = performance.now() + 1000;
    const focus = () => {
      if (document.getElementById('root')?.hasAttribute('inert')) {
        if (performance.now() < deadline) frame = requestAnimationFrame(focus);
        return;
      }
      const target = document.getElementById(`planning-record-${focusedRecord}`);
      if (!target) return;
      let disclosure = target.closest('details');
      while (disclosure) { disclosure.open = true; disclosure = disclosure.parentElement?.closest('details') || null; }
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
      lastRecordFocus.current = signature;
    };
    frame = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(frame);
  }, [snapshot, focusedRecord, activeTab, cycleId, dialog, deleteTarget]);

  const recordParams = (tab: TabKey, recordId: string) => {
    const next = clearPlanningScope(changePlanningTab(searchParams, activeTab, tab), tab);
    if (tab === 'revisoes') next.set('revisoes.lista', governanceViewForRecord(recordId));
    next.set('foco', recordId);
    return next;
  };
  const openRecord = (tab: TabKey, recordId: string) => setSearchParams(recordParams(tab, recordId));

  useEffect(() => {
    if (!snapshot) return;
    const next = new URLSearchParams(normalizedParams);
    for (const tab of ['iniciativas', 'revisoes']) {
      const id = next.get(`${tab}.objetivo`);
      if (id && !snapshot.objetivos.some(item => item.id === id)) next.delete(`${tab}.objetivo`);
    }
    if (next.toString() !== normalizedParams.toString()) setSearchParams(next, { replace: true });
  }, [snapshot, normalizedParams, setSearchParams]);

  return (
    <Layout>
      <div className="planning-workspace space-y-7">
        <PageHeader
          eyebrow="Estratégia e execução"
          title="Planejamento estratégico"
          description="Conecte direção, objetivos, iniciativas, riscos e decisões em um ciclo mensurável."
          className="mb-0"
          action={selectedCycle ? (
            <button type="button" onClick={openPrimaryAction} disabled={cyclesQuery.isLoading || Boolean(cycleId && !snapshot)} className={headerPrimaryActionButtonClass}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              {primaryLabel}
              <span aria-hidden="true" className={headerPrimaryActionIconClass}><Flag className="h-3.5 w-3.5" /></span>
            </button>
          ) : null}
        />

        <p className="sr-only" aria-live="polite">{announcement}</p>
        {actionError && !dialog && !deleteTarget ? (
          <section role="alert" aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100">
            <p className="font-semibold">A operação não foi concluída</p>
            <p className="mt-1 leading-6">{actionError}</p>
            <button type="button" onClick={() => setActionError('')} className="geo-focus-ring mt-2 rounded-lg px-3 py-2 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-400/10">Dispensar mensagem</button>
          </section>
        ) : null}

        {cycles.length ? (
          <section aria-label="Ciclo estratégico selecionado" className="geo-surface flex w-full flex-col gap-4 rounded-lg p-4 sm:w-fit sm:max-w-full sm:flex-row sm:items-end">
            <div className="min-w-0 sm:w-[26rem] lg:w-[32rem]">
              <label htmlFor="strategic-cycle-select" className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                Ciclo estratégico
              </label>
              <div className="mt-2 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                <FormSelect
                  id="strategic-cycle-select"
                  value={cycleId || ''}
                  onChange={(event) => {
                    const next = changePlanningCycle(searchParams, event.target.value);
                    next.set('aba', activeTab);
                    setSearchParams(next);
                  }}
                  className={cn(filterNativeSelectClass, 'w-full sm:max-w-sm')}
                >
                  {cycles.map((cycle) => <option key={cycle.id} value={cycle.id}>{cycle.nome}</option>)}
                </FormSelect>
                {selectedCycle ? <StatusBadge value={selectedCycle.status} /> : null}
              </div>
              {selectedCycle ? (
                <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {formatDate(selectedCycle.dataInicio)} a {formatDate(selectedCycle.dataFim)}
                  {selectedCycle.proximaRevisao ? ` · Próxima revisão em ${formatDate(selectedCycle.proximaRevisao)}` : ' · Próxima revisão não definida'}
                </p>
              ) : null}
            </div>
            {selectedCycle ? (
              <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" onClick={() => openDialog({ kind: 'cycle', initial: selectedCycle })} className={secondarySmallActionButtonClass}>
                <PencilSimple aria-hidden="true" className="h-4 w-4" />
                Editar ciclo
              </button>
              <button type="button" onClick={() => openDialog({ kind: 'cycle' })} className={secondarySmallActionButtonClass}>
                <Plus aria-hidden="true" className="h-4 w-4" /> Novo ciclo
              </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {cycles.length ? (
          <nav aria-label="Áreas do planejamento estratégico" className={localNavigationBarClass}>
            <div ref={tabListRef} role="tablist" onKeyDown={handleTabKeys} className={localNavigationItemsClass}>
              {TAB_ITEMS.map(({ id, label: tabLabel, icon: Icon, tone }) => (
                <button
                  key={id}
                  id={`planning-tab-${id}`}
                  type="button"
                  role="tab"
                  tabIndex={activeTab === id ? 0 : -1}
                  aria-selected={activeTab === id}
                  aria-controls={`planning-panel-${id}`}
                  onClick={() => setTab(id)}
                  className={localNavigationButtonClass(activeTab === id, tone)}
                >
                  <span aria-hidden="true" className={localNavigationIconClass(activeTab === id, tone)}>
                    <Icon className="h-4 w-4" weight={activeTab === id ? 'fill' : 'regular'} />
                  </span>
                  {tabLabel}
                </button>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-zinc-500 sm:hidden dark:text-zinc-400">
              Deslize horizontalmente para ver todas as áreas <span aria-hidden="true">→</span>
            </p>
          </nav>
        ) : null}

        {cyclesQuery.isLoading ? (
          <section aria-label="Carregando planejamento" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-lg bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800" />)}
          </section>
        ) : cyclesQuery.isError ? (
          <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100" role="alert">
            <h2 className="font-semibold">Não foi possível carregar o planejamento</h2>
            <p className="mt-2 text-sm">Restabeleça a conexão com o serviço local e tente novamente.</p>
            <button type="button" onClick={() => cyclesQuery.refetch()} className={cn(secondarySmallActionButtonClass, 'mt-4')}>Tentar novamente</button>
          </section>
        ) : !cycles.length ? (
          <EmptyPlanning onCreate={() => openDialog({ kind: 'cycle' })} />
        ) : snapshotQuery.isLoading ? (
          <section aria-label="Carregando ciclo estratégico" className="space-y-4">
            <div className="h-32 animate-pulse rounded-lg bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-lg bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-800" />)}
            </div>
          </section>
        ) : snapshotQuery.isError ? (
          <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100" role="alert">
            <h2 className="font-semibold">O ciclo não pôde ser carregado</h2>
            <p className="mt-2 text-sm">Os dados não foram substituídos por valores padrão.</p>
            <button type="button" onClick={() => snapshotQuery.refetch()} className={cn(secondarySmallActionButtonClass, 'mt-4')}>Tentar novamente</button>
          </section>
        ) : !snapshot ? (
          <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-100" role="alert">
            <h2 className="font-semibold">O ciclo não retornou dados válidos</h2>
            <p className="mt-2 text-sm">Recarregue o ciclo sem criar valores substitutos.</p>
            <button type="button" onClick={() => snapshotQuery.refetch()} className={cn(secondarySmallActionButtonClass, 'mt-4')}>Tentar novamente</button>
          </section>
        ) : (
          <>
            {activeTab === 'visao' ? (
              <OverviewPanel
                snapshot={snapshot}
                onNavigate={setTab}
                onOpenRecord={openRecord}
                goalsHref={`?${clearPlanningScope(changePlanningTab(searchParams, activeTab, 'objetivos'), 'objetivos')}`}
                getGoalHref={(id) => `?${recordParams('objetivos', `keyResult-${id}`)}`}
                onCreateCheckin={() => openDialog({ kind: 'checkin' })}
                onCreateDecision={() => openDialog({ kind: 'decision' })}
              />
            ) : null}
            {activeTab === 'objetivos' ? (
              <ObjectivesPanel
                snapshot={snapshot}
                filters={filters}
                onFilterChange={setFilter}
                onClearFilters={clearFilters}
                onDialog={openDialog}
                onDelete={requestDelete}
              />
            ) : null}
            {activeTab === 'iniciativas' ? (
              <InitiativesPanel
                snapshot={snapshot}
                options={optionsQuery.data}
                filters={filters}
                onFilterChange={setFilter}
                onClearFilters={clearFilters}
                onDialog={openDialog}
                onDelete={requestDelete}
              />
            ) : null}
            {activeTab === 'revisoes' ? (
              <ReviewsPanel
                snapshot={snapshot}
                onOpenRecord={openRecord}
                filters={filters}
                onFilterChange={setFilter}
                onClearFilters={clearFilters}
                onDialog={openDialog}
                onDelete={requestDelete}
              />
            ) : null}
          </>
        )}
      </div>

      <StrategicPlanningFormModal
        dialog={dialog}
        cycleId={cycleId}
        snapshot={snapshot}
        options={optionsQuery.data}
        optionsError={optionsQuery.isError}
        pending={saveMutation.isPending}
        submitError={actionError}
        onClose={() => { setDialog(null); setActionError(''); }}
        onSubmit={(payload, followWithDecision) => {
          setActionError('');
          if (dialog) saveMutation.mutate({ currentDialog: dialog, payload, followWithDecision });
        }}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
        title={`Excluir ${deleteTarget?.title || 'registro estratégico'}`}
        description={deleteTarget ? planningDeletionDescription(deleteTarget.kind, deleteTarget.id, snapshot) : ''}
        confirmText={deleteMutation.isPending ? 'Excluindo…' : 'Excluir registro'}
        loading={deleteMutation.isPending}
        error={actionError}
      />
    </Layout>
  );
}

function OverviewPanel({
  snapshot,
  onNavigate,
  onOpenRecord,
  goalsHref,
  getGoalHref,
  onCreateCheckin,
  onCreateDecision
}: {
  snapshot: StrategicPlanningSnapshot;
  onNavigate: (tab: TabKey) => void;
  onOpenRecord: (tab: TabKey, recordId: string) => void;
  goalsHref: string;
  getGoalHref: (id: string) => string;
  onCreateCheckin: () => void;
  onCreateDecision: () => void;
}) {
  const exceptions = useMemo(() => planningAlertGroups(snapshot), [snapshot]);
  const [showAllExceptions, setShowAllExceptions] = useState(false);
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const pendingDecisions = snapshot.decisoes.filter((decision) => ['pendente', 'em_andamento'].includes(decision.status));

  return (
    <section id="planning-panel-visao" role="tabpanel" aria-labelledby="planning-tab-visao" className="grid gap-8 sm:gap-10">
      <article className="relative overflow-hidden rounded-lg border border-brand-primary-200/80 bg-gradient-to-br from-brand-primary-50 via-white to-brand-turquoise-50 p-6 dark:border-brand-primary-400/20 dark:from-brand-primary-400/10 dark:via-zinc-900 dark:to-brand-turquoise-400/10">
        <div className="relative z-10 max-w-4xl">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-primary-700 dark:text-brand-primary-200">Leitura executiva</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">{narrativeFor(snapshot, exceptions.length)}</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{snapshot.ciclo.visao}</p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-300">
            <span className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
              Última revisão: {formatDate(snapshot.resumo.ultimaRevisao)}
            </span>
            <span className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
              Próximo marco: {snapshot.resumo.proximoMarco ? `${snapshot.resumo.proximoMarco.titulo} · ${formatDate(snapshot.resumo.proximoMarco.data)}` : 'não definido'}
            </span>
          </div>
        </div>
      </article>

      <WidgetSection id="planning-cycle-indicators-title" title="Metas e alertas do ciclo" contentClassName="grid items-start gap-6 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <PlanningCycleGoalsWidget
          results={snapshot.resultadosChave}
          progress={snapshot.resumo.progressoGeral}
          goalsHref={goalsHref}
          getGoalHref={getGoalHref}
        />
        <div className="grid gap-5 sm:grid-cols-3 md:grid-cols-1">
          <SummaryCard
            title="Objetivos em risco"
            value={String(snapshot.resumo.objetivosEmRisco)}
            description="Objetivos sinalizados ou vinculados a riscos elevados."
            meta={`Fonte: objetivos, iniciativas e riscos · atualizado ${formatDateTime(latestPlanningUpdate([...snapshot.objetivos, ...snapshot.iniciativas, ...snapshot.riscos]))}`}
            icon={WarningCircle}
            tone={snapshot.resumo.objetivosEmRisco ? 'warning' : 'success'}
          />
          <SummaryCard
            title="Iniciativas atrasadas"
            value={String(snapshot.resumo.iniciativasAtrasadas)}
            description="Iniciativas abertas cujo prazo já terminou."
            meta={`Fonte: iniciativas do ciclo · referência ${formatDate(saoPauloDateKey())}`}
            icon={CalendarCheck}
            tone={snapshot.resumo.iniciativasAtrasadas ? 'danger' : 'success'}
          />
          <SummaryCard
            title="Decisões pendentes"
            value={String(snapshot.resumo.decisoesPendentes)}
            description="Decisões do ciclo que ainda exigem encaminhamento."
            meta={`Fonte: decisões do ciclo · atualizado ${formatDateTime(latestPlanningUpdate(snapshot.decisoes))}`}
            icon={Lightbulb}
            tone={snapshot.resumo.decisoesPendentes ? 'warning' : 'success'}
          />
        </div>
      </WidgetSection>

      <WidgetSection id="planning-cycle-followup-title" title="Riscos e decisões" contentClassName="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="geo-surface rounded-lg p-5" aria-labelledby="exceptions-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">O que está desviando?</span>
              <h3 id="exceptions-title" className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">Gestão por exceção</h3>
            </div>
            <button type="button" onClick={() => onNavigate('objetivos')} className={secondarySmallActionButtonClass}>Ver objetivos</button>
          </div>
          <p role="status" className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{exceptions.length} {exceptions.length === 1 ? 'contexto com alertas' : 'contextos com alertas'} · riscos críticos e altos primeiro; depois bloqueios, atrasos e qualidade dos dados.</p>
          {exceptions.length ? (
            <ul className="mt-5 space-y-3">
              {(showAllExceptions ? exceptions : exceptions.slice(0, 6)).map((item) => (
                <li key={item.id} className={cn(
                  'rounded-lg border p-4',
                  item.tone === 'danger'
                    ? 'border-red-200 bg-red-50/70 dark:border-red-400/20 dark:bg-red-400/10'
                    : 'border-amber-200 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-400/10'
                )}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-zinc-950 dark:text-white">{item.title}</h3>
                      <p className="mt-1 break-words text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.description}</p>
                    </div>
                    <button type="button" onClick={() => onOpenRecord(item.tab, item.recordId)} className="geo-focus-ring shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-brand-primary-700 hover:bg-white dark:text-brand-primary-200 dark:hover:bg-zinc-900">
                      {item.action}
                    </button>
                  </div>
                  {item.causes.length > 1 ? <details className="mt-3 text-xs">
                    <summary className="geo-focus-ring w-fit cursor-pointer rounded font-semibold text-zinc-700 dark:text-zinc-200">Ver {item.causes.length} causas relacionadas</summary>
                    <ul className="mt-2 space-y-2">{item.causes.map(cause => <li key={cause.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 break-words text-zinc-600 dark:text-zinc-300">{cause.title}: {cause.description}</span>
                      {cause.id !== item.id ? <button type="button" onClick={() => onOpenRecord(cause.tab, cause.recordId)} className={secondarySmallActionButtonClass}>{cause.action}</button> : null}
                    </li>)}</ul>
                  </details> : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
              <CheckCircle aria-hidden="true" className="mx-auto h-7 w-7 text-emerald-600 dark:text-emerald-300" weight="duotone" />
              <p className="mt-3 font-semibold text-zinc-950 dark:text-white">Nenhum desvio crítico registrado</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">A leitura depende dos indicadores e revisões cadastrados.</p>
            </div>
          )}
          {exceptions.length > 6 ? <button type="button" onClick={() => setShowAllExceptions(value => !value)} aria-expanded={showAllExceptions} className={cn(secondarySmallActionButtonClass, 'mt-4')}>
            {showAllExceptions ? 'Mostrar seis contextos' : `Ver todos os ${exceptions.length} contextos`}
          </button> : null}
        </section>

        <section className="geo-surface rounded-lg p-5" aria-labelledby="decisions-title">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">O que decidir agora?</span>
          <h3 id="decisions-title" className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">Próximas decisões</h3>
          {pendingDecisions.length ? (
            <ul className="mt-5 space-y-3">
              {pendingDecisions.slice(0, 4).map((decision) => (
                <li key={decision.id} className={cn('rounded-lg border p-4', decision.atrasada ? 'border-red-200 bg-red-50/60 dark:border-red-400/20 dark:bg-red-400/5' : 'border-zinc-200 dark:border-zinc-800')}>
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge value={decision.status} />{decision.atrasada ? <span className="text-xs font-semibold text-red-700 dark:text-red-200">Vencida</span> : null}</div>
                  <p className="mt-3 break-words text-sm font-semibold leading-6 text-zinc-950 dark:text-white">{decision.descricao}</p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{decision.responsavel} · prazo {formatDate(decision.prazo)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-5 rounded-lg bg-zinc-50 p-5 dark:bg-zinc-800/60">
              <p className="font-semibold text-zinc-950 dark:text-white">Nenhuma decisão pendente</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Registre uma decisão com responsável e prazo para acompanhar seu encaminhamento.</p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={onCreateDecision} className={primarySmallActionButtonClass}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Nova decisão
            </button>
            <button type="button" onClick={onCreateCheckin} className={secondarySmallActionButtonClass}>Registrar revisão</button>

          </div>
        </section>
      </WidgetSection>

      <WidgetSection id="planning-cycle-history-title" title="Evolução do ciclo" contentClassName="grid items-start gap-6 lg:grid-cols-2">
        <section className="geo-surface rounded-lg p-5" aria-labelledby="trend-title">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-primary-700 dark:text-brand-primary-200">O que mudou?</span>
          <h3 id="trend-title" className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">Evolução entre revisões</h3>
          {!snapshot.tendencias.disponivel ? (
            <div className="mt-5 rounded-lg border border-dashed border-zinc-300 p-5 dark:border-zinc-700">
              <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{snapshot.tendencias.motivo}</p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/60">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Progresso geral</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-white">
                  {snapshot.tendencias.progressoAnterior == null ? '—' : `${numberFormatter.format(snapshot.tendencias.progressoAnterior)}%`}
                  {' → '}
                  {snapshot.tendencias.progressoAtual == null ? '—' : `${numberFormatter.format(snapshot.tendencias.progressoAtual)}%`}
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Comparação de {formatDate(snapshot.tendencias.revisaoAnterior)} a {formatDate(snapshot.tendencias.revisaoAtual)}</p>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500 dark:text-zinc-400">Objetivos que melhoraram</dt><dd className="mt-1 font-semibold tabular-nums text-emerald-700 dark:text-emerald-200">{snapshot.tendencias.objetivosMelhoraram.length}</dd></div>
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500 dark:text-zinc-400">Objetivos que pioraram</dt><dd className="mt-1 font-semibold tabular-nums text-amber-800 dark:text-amber-200">{snapshot.tendencias.objetivosPioraram.length}</dd></div>
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500 dark:text-zinc-400">Riscos novos ou agravados</dt><dd className="mt-1 font-semibold tabular-nums text-red-700 dark:text-red-200">{snapshot.tendencias.riscosNovos + snapshot.tendencias.riscosAgravados}</dd></div>
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><dt className="text-xs text-zinc-500 dark:text-zinc-400">Decisões concluídas</dt><dd className="mt-1 font-semibold tabular-nums text-emerald-700 dark:text-emerald-200">{snapshot.tendencias.decisoesConcluidas}</dd></div>
              </dl>
            </div>
          )}
        </section>
        <section className="geo-surface rounded-lg p-5" aria-labelledby="timeline-title">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Histórico do ciclo</span>
          <h3 id="timeline-title" className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">Linha do tempo estratégica</h3>
          {snapshot.linhaDoTempo.length ? (
            <ol className="mt-5 space-y-4 border-l border-zinc-200 pl-5 dark:border-zinc-700">
              {(showFullTimeline ? snapshot.linhaDoTempo : snapshot.linhaDoTempo.slice(0, 8)).map((item) => (
                <li key={item.id} className="relative">
                  <span aria-hidden="true" className="absolute -left-[1.55rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-primary-500 ring-4 ring-white dark:ring-zinc-900" />
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge value={item.status} /><time className="text-xs text-zinc-500 dark:text-zinc-400" dateTime={item.data}>{formatDate(item.data)}</time></div>
                  <p className="mt-2 break-words text-sm font-semibold text-zinc-950 dark:text-white">{item.titulo}</p>
                  <p className="mt-1 break-words text-xs leading-5 text-zinc-600 dark:text-zinc-400">{planningTimelineDescription(item, snapshot)}</p>
                </li>
              ))}
            </ol>
          ) : <p className="mt-5 rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">A linha do tempo será formada por revisões, decisões, riscos e mudanças de execução reais.</p>}
          {snapshot.linhaDoTempo.length > 8 ? <button type="button" className={cn(secondarySmallActionButtonClass, 'mt-4')} aria-expanded={showFullTimeline} onClick={() => setShowFullTimeline(value => !value)}>{showFullTimeline ? 'Resumir histórico' : 'Ver mais eventos do histórico'}</button> : null}
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Até 30 eventos recentes. Consulte Auditoria em Relatórios para o registro de alterações.</p>
        </section>
      </WidgetSection>
    </section>
  );
}

function ObjectivesPanel({
  snapshot,
  filters,
  onFilterChange,
  onClearFilters,
  onDialog,
  onDelete
}: {
  snapshot: StrategicPlanningSnapshot;
  filters: PlanningFilters;
  onFilterChange: (key: PlanningFilterKey, value: string) => void;
  onClearFilters: () => void;
  onDialog: (dialog: PlanningDialog) => void;
  onDelete: (target: Exclude<DeleteTarget, null>) => void;
}) {
  const [params] = useSearchParams();
  const focus = params.get('foco');
  const focusObjectiveId = snapshot.resultadosChave.find(item => `keyResult-${item.id}` === focus)?.objetivoId;
  const filteredObjectives = filterAndSortObjectives(snapshot.objetivos, snapshot.resultadosChave, filters, saoPauloDateKey());
  const filtersActive = hasPlanningFilters(filters);
  const visiblePillars = filtersActive
    ? snapshot.pilares.filter((pillar) => filteredObjectives.some((objective) => objective.pilarId === pillar.id))
    : snapshot.pilares;
  return (
    <section id="planning-panel-objetivos" role="tabpanel" aria-labelledby="planning-tab-objetivos" className="grid gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-white">Objetivos e resultados-chave</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Metas são sempre explícitas e mantêm a origem do valor atual.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {snapshot.pilares.length ? <button type="button" onClick={() => onDialog({ kind: 'pillar' })} className={secondarySmallActionButtonClass}>
            <Plus aria-hidden="true" className="h-4 w-4" /> Novo pilar
          </button> : null}
        </div>
      </div>

      <PlanningFilterBar
        filters={filters}
        snapshot={snapshot}
        resultCount={filteredObjectives.length}
        totalCount={snapshot.objetivos.length}
        mode="objectives"
        onChange={onFilterChange}
        onClear={onClearFilters}
      />

      {!snapshot.pilares.length ? (
        <div className="geo-surface rounded-lg border-dashed p-8 text-center">
          <Flag aria-hidden="true" className="mx-auto h-8 w-8 text-brand-primary-600 dark:text-brand-primary-200" weight="duotone" />
          <h3 className="mt-4 text-xl font-semibold text-zinc-950 dark:text-white">Defina o primeiro pilar do ciclo</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Pilares organizam objetivos relacionados, como sustentabilidade financeira, crescimento comercial ou excelência operacional.</p>
        </div>
      ) : filtersActive && !filteredObjectives.length ? (
        <FilteredEmptyState onClear={onClearFilters} />
      ) : (
        <div className="grid gap-8">
          {visiblePillars.map((pillar) => {
            const objectives = filteredObjectives.filter((objective) => objective.pilarId === pillar.id);
            return (
              <article key={pillar.id} id={`planning-record-pillar-${pillar.id}`} tabIndex={-1} className="geo-focus-ring geo-surface overflow-hidden rounded-lg">
                <header className="flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50/70 p-5 sm:flex-row sm:items-start sm:justify-between dark:border-zinc-800 dark:bg-zinc-800/40">
                  <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-primary-700 dark:text-brand-primary-200">Pilar estratégico</span>
                    <h3 className="mt-1 break-words text-xl font-semibold text-zinc-950 dark:text-white">{pillar.nome}</h3>
                    {pillar.descricao ? <p className="mt-2 break-words text-sm leading-6 text-zinc-600 dark:text-zinc-400">{pillar.descricao}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => onDialog({ kind: 'objective', parentId: pillar.id })} className={secondarySmallActionButtonClass}>
                      <Plus aria-hidden="true" className="h-4 w-4" /> Objetivo
                    </button>
                    <EntityActions
                      onEdit={() => onDialog({ kind: 'pillar', initial: pillar })}
                      onDelete={() => onDelete({ kind: 'pillar', id: pillar.id, title: `pilar “${pillar.nome}”` })}
                      editLabel={`Editar pilar ${pillar.nome}`}
                      deleteLabel={`Excluir pilar ${pillar.nome}`}
                    />
                  </div>
                </header>
                {objectives.length ? (
                  <div className="px-3 py-5 sm:px-5">
                    <PlanningCollection items={objectives} name={`objetivos.pagina.${pillar.id}`} label={`Objetivos de ${pillar.nome}`} kind="objective" focusItemId={focusObjectiveId} className="grid gap-6 xl:grid-cols-2">
                      {(objective) => <ObjectiveCard key={objective.id} objective={objective} snapshot={snapshot} onDialog={onDialog} onDelete={onDelete} />}
                    </PlanningCollection>
                  </div>
                ) : (
                  <div className="p-6 text-center">
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Este pilar ainda não possui objetivos.</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ObjectiveCard({
  objective,
  snapshot,
  onDialog,
  onDelete
}: {
  objective: StrategicObjective;
  snapshot: StrategicPlanningSnapshot;
  onDialog: (dialog: PlanningDialog) => void;
  onDelete: (target: Exclude<DeleteTarget, null>) => void;
}) {
  const results = snapshot.resultadosChave.filter((result) => result.objetivoId === objective.id);
  return (
    <article id={`planning-record-objective-${objective.id}`} tabIndex={-1} className="geo-focus-ring min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-5 sm:px-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={objective.status} />
            <span className="text-xs font-semibold text-text-secondary">Prioridade {label(objective.prioridade).toLowerCase()}</span>
          </div>
          <h4 className="mt-3 break-words text-lg font-semibold leading-7 text-zinc-950 dark:text-white">{objective.titulo}</h4>
          {objective.descricao ? <p className="mt-2 break-words text-sm leading-6 text-zinc-600 dark:text-zinc-400">{objective.descricao}</p> : null}
        </div>
        <EntityActions
          onEdit={() => onDialog({ kind: 'objective', initial: objective })}
          onDelete={() => onDelete({ kind: 'objective', id: objective.id, title: `objetivo “${objective.titulo}”` })}
          editLabel={`Editar objetivo ${objective.titulo}`}
          deleteLabel={`Excluir objetivo ${objective.titulo}`}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-text-secondary">
        <span>Responsável: <strong className="text-zinc-700 dark:text-zinc-200">{objective.responsavel}</strong></span>
        <span>Prazo: <strong className="text-zinc-700 dark:text-zinc-200">{formatDate(objective.dataLimite)}</strong></span>
      </div>
      <div className="mt-5">
        <PlanningObjectiveWidget
          progress={objective.progresso}
          measured={results.filter(result => result.progresso != null).length}
          total={results.length}
        />
      </div>
      <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <h5 className="text-sm font-semibold text-zinc-950 dark:text-white">Resultados-chave</h5>
          <button type="button" onClick={() => onDialog({ kind: 'keyResult', parentId: objective.id })} className="geo-focus-ring rounded-lg px-3 py-2 text-xs font-semibold text-brand-primary-700 hover:bg-brand-primary-50 dark:text-brand-primary-200 dark:hover:bg-brand-primary-400/10">
            + Adicionar
          </button>
        </div>
        {results.length ? (
          <details className="mt-3">
            <summary className="geo-focus-ring cursor-pointer rounded py-2 text-sm font-semibold text-brand-primary-700 dark:text-brand-primary-200">Ver {results.length} resultados-chave</summary>
            <PlanningCollection items={results} name={`objetivos.pagina.resultados-${objective.id}`} label={`Resultados de ${objective.titulo}`} kind="keyResult" as="ul" className="mt-3 space-y-5">
              {(result) => <KeyResultRow key={result.id} result={result} dueDate={objective.dataLimite} onDialog={onDialog} onDelete={onDelete} />}
            </PlanningCollection>
          </details>
        ) : (
          <p className="mt-3 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">Sem resultados-chave. O progresso não será estimado.</p>
        )}
      </div>
    </article>
  );
}

function KeyResultRow({
  result,
  dueDate,
  onDialog,
  onDelete
}: {
  result: StrategicKeyResult;
  dueDate: string;
  onDialog: (dialog: PlanningDialog) => void;
  onDelete: (target: Exclude<DeleteTarget, null>) => void;
}) {
  const formattedValue = result.valorAtual === null ? '—' : formatPlanningMeasure(result.valorAtual, result.unidade);
  const formattedTarget = formatPlanningMeasure(result.meta, result.unidade);
  return (
    <li id={`planning-record-keyResult-${result.id}`} tabIndex={-1} className="geo-focus-ring rounded-lg border border-zinc-200 px-2 py-3 sm:p-4 dark:border-zinc-800">
      <PlanningGoalWidget
        title={result.titulo}
        target={formattedTarget}
        current={result.valorAtual == null ? null : formattedValue}
        progress={result.progresso}
        deadline={dueDate}
        onEdit={() => onDialog({ kind: 'keyResult', initial: result })}
      />
      <div className="mt-3 flex flex-col gap-2 rounded-lg bg-zinc-50 p-3 text-xs leading-5 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn(
            'w-fit rounded-full border px-2.5 py-1 font-semibold',
            result.estadoDado === 'disponivel'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200'
              : result.estadoDado === 'desatualizado'
                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200'
                : 'border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
          )}>
            {result.estadoDado === 'disponivel' ? 'Dado disponível' : result.estadoDado === 'desatualizado' ? 'Dado desatualizado' : 'Dado indisponível'}
          </span>
          <button
            type="button"
            onClick={() => onDelete({ kind: 'keyResult', id: result.id, title: `resultado-chave “${result.titulo}”` })}
            aria-label={`Excluir resultado-chave ${result.titulo}`}
            className="geo-focus-ring inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-rose-700 hover:bg-rose-100 dark:text-rose-200 dark:hover:bg-rose-400/10"
          >
            <Trash aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <span><Database aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> Fonte: {result.fonteNome}</span>
        <details className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <summary className="geo-focus-ring cursor-pointer rounded font-semibold text-brand-primary-700 dark:text-brand-primary-200">Origem e cálculo do indicador</summary>
        <div className="mt-3 space-y-2">
        <p>Regra: {result.fonteRegra || 'Não informada'}</p>
        <span>Período: {result.fontePeriodo || 'Não informado'} · atualização {formatDateTime(result.ultimaAtualizacao)}</span>
        {result.estadoDado === 'desatualizado' ? <span className="font-semibold text-amber-800 dark:text-amber-200">Atualize a fonte antes da próxima decisão.</span> : null}
        {result.estadoDado === 'indisponivel' ? <span className="font-semibold text-zinc-700 dark:text-zinc-200">Nenhum registro válido foi encontrado; o sistema não substituiu a ausência por zero.</span> : null}
        <details className="rounded-lg border border-zinc-200 bg-white p-3 open:shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <summary className="geo-focus-ring cursor-pointer rounded text-xs font-semibold text-brand-primary-700 dark:text-brand-primary-200">Como o progresso é calculado?</summary>
          <div className="mt-3 space-y-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
            <p><strong>Direção:</strong> {result.direcao === 'aumentar' ? 'aumentar o valor' : result.direcao === 'reduzir' ? 'reduzir o valor' : 'manter próximo da meta'}</p>
            <p><strong>Valores:</strong> linha de base {numberFormatter.format(result.linhaBase)}, atual {formattedValue}, meta {formattedTarget}.</p>
            <p><strong>Fórmula:</strong> {result.formulaProgresso}.</p>
            <p>O resultado é limitado ao intervalo de 0% a 100%. Sem valor atual válido, o progresso permanece indisponível.</p>
          </div>
        </details>
        {result.fonteRota ? (
          <Link to={result.fonteRota} className="geo-focus-ring inline-flex w-fit items-center gap-1 rounded text-brand-primary-700 hover:underline dark:text-brand-primary-200">
            Abrir fonte <ArrowSquareOut aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        ) : null}
        </div></details>
      </div>
    </li>
  );
}

function InitiativesPanel({
  snapshot,
  options,
  filters,
  onFilterChange,
  onClearFilters,
  onDialog,
  onDelete
}: {
  snapshot: StrategicPlanningSnapshot;
  options?: StrategicOptions;
  filters: PlanningFilters;
  onFilterChange: (key: PlanningFilterKey, value: string) => void;
  onClearFilters: () => void;
  onDialog: (dialog: PlanningDialog) => void;
  onDelete: (target: Exclude<DeleteTarget, null>) => void;
}) {
  const objectiveName = (id: string) => snapshot.objetivos.find((objective) => objective.id === id)?.titulo || 'Objetivo não encontrado';
  const filteredInitiatives = filterAndSortInitiatives(snapshot.iniciativas, filters, saoPauloDateKey());
  const filtersActive = hasPlanningFilters(filters);
  return (
    <section id="planning-panel-iniciativas" role="tabpanel" aria-labelledby="planning-tab-iniciativas" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-white">Iniciativas e execução</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Responsáveis, prazos, dependências e vínculos com Projetos e Tarefas.</p>
        </div>
      </div>
      <PlanningFilterBar
        filters={filters}
        snapshot={snapshot}
        resultCount={filteredInitiatives.length}
        totalCount={snapshot.iniciativas.length}
        mode="initiatives"
        onChange={onFilterChange}
        onClear={onClearFilters}
      />
      {!snapshot.objetivos.length ? (
        <div className="geo-surface rounded-lg border-dashed p-8 text-center">
          <ListChecks aria-hidden="true" className="mx-auto h-8 w-8 text-zinc-500" weight="duotone" />
          <h3 className="mt-4 text-xl font-semibold text-zinc-950 dark:text-white">Crie um objetivo antes das iniciativas</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Toda iniciativa deve contribuir diretamente para um objetivo estratégico.</p>
        </div>
      ) : filtersActive && !filteredInitiatives.length ? (
        <FilteredEmptyState onClear={onClearFilters} />
      ) : filteredInitiatives.length ? (
        <PlanningCollection items={filteredInitiatives} name="iniciativas.pagina" label="Iniciativas" kind="initiative" className="grid gap-4 lg:grid-cols-2">
          {(initiative) => <InitiativeCard key={initiative.id} initiative={initiative} objectiveName={objectiveName(initiative.objetivoId)} options={options} onDialog={onDialog} onDelete={onDelete} />}
        </PlanningCollection>
      ) : (
        <div className="geo-surface rounded-lg border-dashed p-8 text-center">
          <RocketLaunch aria-hidden="true" className="mx-auto h-8 w-8 text-brand-primary-600 dark:text-brand-primary-200" weight="duotone" />
          <h3 className="mt-4 text-xl font-semibold text-zinc-950 dark:text-white">Transforme objetivos em execução</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Cadastre a primeira iniciativa com responsável, prazo e próximo marco.</p>
        </div>
      )}
    </section>
  );
}

function InitiativeCard({
  initiative,
  objectiveName,
  options,
  onDialog,
  onDelete
}: {
  initiative: StrategicInitiative;
  objectiveName: string;
  options?: StrategicOptions;
  onDialog: (dialog: PlanningDialog) => void;
  onDelete: (target: Exclude<DeleteTarget, null>) => void;
}) {
  const [params] = useSearchParams();
  const returnParams = new URLSearchParams(params);
  returnParams.set('foco', `initiative-${initiative.id}`);
  const returnTo = `/planejamento?${returnParams.toString()}`;
  const project = options?.projetos.find(item => item.id === initiative.projetoId);
  const task = options?.tarefas.find(item => item.id === initiative.tarefaId);
  const withReturn = (path: string) => `${path}${path.includes('?') ? '&' : '?'}${new URLSearchParams({ retorno: returnTo })}`;
  return (
    <article id={`planning-record-initiative-${initiative.id}`} tabIndex={-1} className={cn('geo-focus-ring geo-surface rounded-lg p-5', initiative.atrasada && 'border-red-200 dark:border-red-400/20')}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={initiative.status} />
            {initiative.atrasada ? <span className="text-xs font-semibold text-red-700 dark:text-red-200">Prazo vencido</span> : null}
          </div>
          <h3 className="mt-3 break-words text-lg font-semibold text-zinc-950 dark:text-white">{initiative.titulo}</h3>
          <p className="mt-1 break-words text-xs font-medium text-brand-primary-700 dark:text-brand-primary-200">{objectiveName}</p>
        </div>
        <EntityActions
          onEdit={() => onDialog({ kind: 'initiative', initial: initiative })}
          onDelete={() => onDelete({ kind: 'initiative', id: initiative.id, title: `iniciativa “${initiative.titulo}”` })}
          editLabel={`Editar iniciativa ${initiative.titulo}`}
          deleteLabel={`Excluir iniciativa ${initiative.titulo}`}
        />
      </div>
      {initiative.descricao ? <p className="mt-3 break-words text-sm leading-6 text-zinc-600 dark:text-zinc-400">{initiative.descricao}</p> : null}
      <div className="mt-5"><ProgressBar value={initiative.progresso} labelText="Progresso informado" /></div>
      <dl className="mt-5 grid gap-3 rounded-lg bg-zinc-50 p-4 text-sm sm:grid-cols-2 dark:bg-zinc-800/50">
        <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">Responsável</dt><dd className="mt-1 font-semibold text-zinc-900 dark:text-white">{initiative.responsavel}</dd></div>
        <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">Prazo</dt><dd className="mt-1 font-semibold text-zinc-900 dark:text-white">{formatDate(initiative.dataLimite)}</dd></div>
        <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">Próximo marco</dt><dd className="mt-1 break-words font-semibold text-zinc-900 dark:text-white">{initiative.proximoMarco || 'Não definido'}</dd></div>
        <div><dt className="text-xs text-zinc-500 dark:text-zinc-400">Orçamento</dt><dd className="mt-1 font-semibold tabular-nums text-zinc-900 dark:text-white">{initiative.orcamentoCentavos == null ? 'Não informado' : currencyFormatter.format(initiative.orcamentoCentavos / 100)}</dd></div>
      </dl>
      {initiative.dependencias ? <p className="mt-4 break-words text-xs leading-5 text-zinc-500 dark:text-zinc-400"><strong>Dependências:</strong> {initiative.dependencias}</p> : null}
      {initiative.projetoId || initiative.tarefaId ? <p className="mt-4 break-words text-xs leading-5 text-zinc-600 dark:text-zinc-300">
        {project ? `Projeto: ${project.nome} · ${project.status}. ` : initiative.projetoId ? 'Projeto vinculado. ' : ''}
        {task ? `Tarefa: ${task.titulo} · ${task.status}.` : initiative.tarefaId ? 'Tarefa vinculada.' : ''}
        {' '}O vínculo não altera o progresso informado.
      </p> : null}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {initiative.projetoId ? <Link to={withReturn(appLinks.project(initiative.projetoId))} className="geo-focus-ring inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 font-semibold text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">Abrir projeto <ArrowSquareOut aria-hidden="true" className="h-3.5 w-3.5" /></Link> : null}
        {initiative.tarefaId ? <Link to={withReturn(appLinks.task(initiative.tarefaId))} className="geo-focus-ring inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">Abrir tarefa <ArrowSquareOut aria-hidden="true" className="h-3.5 w-3.5" /></Link> : null}
      </div>
    </article>
  );
}

function ReviewsPanel({
  snapshot,
  filters,
  onFilterChange,
  onClearFilters,
  onDialog,
  onDelete,
  onOpenRecord
}: {
  snapshot: StrategicPlanningSnapshot;
  filters: PlanningFilters;
  onFilterChange: (key: PlanningFilterKey, value: string) => void;
  onClearFilters: () => void;
  onDialog: (dialog: PlanningDialog) => void;
  onDelete: (target: Exclude<DeleteTarget, null>) => void;
  onOpenRecord: (tab: TabKey, recordId: string) => void;
}) {
  const [params] = useSearchParams();
  const view = governanceView(params);
  const today = saoPauloDateKey();
  const decisions = filterDecisions(snapshot.decisoes, filters, today);
  const risks = filterRisks(snapshot.riscos, filters, snapshot.iniciativas);
  const checkins = filterCheckins(snapshot.checkins, filters);
  const total = view === 'revisoes' ? snapshot.checkins.length : view === 'decisoes' ? snapshot.decisoes.length : view === 'riscos' ? snapshot.riscos.length : snapshot.decisoes.length + snapshot.riscos.length + snapshot.checkins.length;
  const resultCount = view === 'revisoes' ? checkins.length : view === 'decisoes' ? decisions.length : view === 'riscos' ? risks.length : decisions.length + risks.length + checkins.length;
  return (
    <section id="planning-panel-revisoes" role="tabpanel" aria-labelledby="planning-tab-revisoes" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-white">Revisões, decisões e riscos</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Registre a leitura do ciclo e mantenha mitigação e responsabilidade explícitas.</p>
        </div>
      </div>
      <nav aria-label="Listas de governança" className="flex flex-wrap gap-2">
        {([['revisoes', 'Revisões', snapshot.checkins.length], ['decisoes', 'Decisões', snapshot.decisoes.length], ['riscos', 'Riscos', snapshot.riscos.length], ['todas', 'Visão conjunta', total]] as const).map(([id, title, count]) => (
          <Link key={id} to={`?${changeGovernanceView(params, id)}`} aria-current={view === id ? 'page' : undefined} className={cn(secondarySmallActionButtonClass, view === id && 'border-brand-primary-300 bg-brand-primary-50 text-brand-primary-800 dark:bg-brand-primary-400/10 dark:text-brand-primary-200')}>{title}{id !== 'todas' ? ` (${count})` : ''}</Link>
        ))}
      </nav>
      <PlanningFilterBar
        filters={filters}
        snapshot={snapshot}
        resultCount={resultCount}
        totalCount={total}
        mode="reviews"
        view={view}
        onChange={onFilterChange}
        onClear={onClearFilters}
      />
      {view === 'todas' ? <p role="status" aria-live="polite" className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{decisions.length} de {snapshot.decisoes.length} decisões · {checkins.length} de {snapshot.checkins.length} revisões · {risks.length} de {snapshot.riscos.length} riscos</p> : null}
      {hasPlanningFilters(filters) && resultCount === 0 ? <FilteredEmptyState onClear={onClearFilters} /> : null}
      <div className={cn('grid items-start gap-6', view === 'todas' && 'xl:grid-cols-3')}>
        {(view === 'decisoes' || view === 'todas') ? <section className="geo-surface rounded-lg p-5" aria-labelledby="decisions-list-title">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Governança</span>
            <h3 id="decisions-list-title" className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">Decisões estratégicas</h3>
          </div>
          {decisions.length ? (
            <PlanningCollection items={decisions} name="revisoes.pagina.decisions" label="Decisões" kind="decision" as="ul" className="mt-5 space-y-4">
              {(decision) => <DecisionCard key={decision.id} decision={decision} onDialog={onDialog} onDelete={onDelete} />}
            </PlanningCollection>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
              <Lightbulb aria-hidden="true" className="mx-auto h-7 w-7 text-zinc-500" weight="duotone" />
              <p className="mt-3 font-semibold text-zinc-950 dark:text-white">Nenhuma decisão neste recorte</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Registre responsável, prazo e situação para acompanhar o encaminhamento.</p>
            </div>
          )}
        </section> : null}
        {(view === 'revisoes' || view === 'todas') ? <section className="geo-surface rounded-lg p-5" aria-labelledby="checkins-title">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-primary-700 dark:text-brand-primary-200">Histórico de decisão</span>
            <h3 id="checkins-title" className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">Revisões estratégicas</h3>
          </div>
          {checkins.length ? (
            <PlanningCollection items={checkins} name="revisoes.pagina.checkins" label="Revisões" kind="checkin" as="ol" className="mt-5 space-y-4">
              {(checkin) => <CheckinCard key={checkin.id} checkin={checkin} decisions={snapshot.decisoes.filter(item => item.checkinId === checkin.id)} onOpenRecord={onOpenRecord} onDialog={onDialog} onDelete={onDelete} />}
            </PlanningCollection>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
              <CalendarCheck aria-hidden="true" className="mx-auto h-7 w-7 text-zinc-500" weight="duotone" />
              <p className="mt-3 font-semibold text-zinc-950 dark:text-white">Nenhuma revisão registrada</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Registre a leitura do ciclo e vincule decisões com responsável e prazo.</p>
            </div>
          )}
        </section> : null}
        {(view === 'riscos' || view === 'todas') ? <section className="geo-surface rounded-lg p-5" aria-labelledby="risks-title">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">Gestão preventiva</span>
            <h3 id="risks-title" className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">Riscos estratégicos</h3>
          </div>
          {risks.length ? (
            <PlanningCollection items={risks} name="revisoes.pagina.risks" label="Riscos" kind="risk" as="ul" className="mt-5 space-y-4">
              {(risk) => <RiskCard key={risk.id} risk={risk} onDialog={onDialog} onDelete={onDelete} />}
            </PlanningCollection>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
              <ShieldWarning aria-hidden="true" className="mx-auto h-7 w-7 text-zinc-500" weight="duotone" />
              <p className="mt-3 font-semibold text-zinc-950 dark:text-white">Nenhum risco registrado</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">A ausência de registros não significa ausência de risco. Revise o ciclo periodicamente.</p>
            </div>
          )}
        </section> : null}
      </div>
    </section>
  );
}

function CheckinCard({
  checkin,
  decisions,
  onOpenRecord,
  onDialog,
  onDelete
}: {
  checkin: StrategicCheckin;
  decisions: StrategicDecision[];
  onOpenRecord: (tab: TabKey, recordId: string) => void;
  onDialog: (dialog: PlanningDialog) => void;
  onDelete: (target: Exclude<DeleteTarget, null>) => void;
}) {
  const [showAllDecisions, setShowAllDecisions] = useState(false);
  const visibleDecisions = showAllDecisions ? decisions : decisions.slice(0, 3);
  return (
    <li id={`planning-record-checkin-${checkin.id}`} tabIndex={-1} className="geo-focus-ring rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2"><StatusBadge value={checkin.status} /><span className="text-xs text-zinc-500 dark:text-zinc-400">{formatDate(checkin.data)}</span></div>
          <p className="mt-3 break-words text-sm font-semibold leading-6 text-zinc-950 dark:text-white">{checkin.narrativa}</p>
        </div>
        <EntityActions
          onEdit={() => onDialog({ kind: 'checkin', initial: checkin })}
          onDelete={() => onDelete({ kind: 'checkin', id: checkin.id, title: `revisão de ${formatDate(checkin.data)}` })}
          editLabel={`Editar revisão de ${formatDate(checkin.data)}`}
          deleteLabel={`Excluir revisão de ${formatDate(checkin.data)}`}
        />
      </div>
      {checkin.bloqueios ? <p className="mt-3 break-words text-xs leading-5 text-zinc-600 dark:text-zinc-400"><strong>Bloqueios:</strong> {checkin.bloqueios}</p> : null}
      {checkin.decisoes || checkin.decisoesPendentes || checkin.proximosPassos ? <details className="mt-3 text-xs leading-5">
        <summary className="geo-focus-ring w-fit cursor-pointer rounded font-semibold text-zinc-700 dark:text-zinc-200">Anotações anteriores</summary>
        <dl className="mt-3 space-y-3">
        {checkin.decisoes ? <div><dt className="font-semibold text-zinc-700 dark:text-zinc-200">Decisões tomadas</dt><dd className="break-words text-zinc-600 dark:text-zinc-400">{checkin.decisoes}</dd></div> : null}
        {checkin.decisoesPendentes ? <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-400/10"><dt className="font-semibold text-amber-900 dark:text-amber-100">Decisões pendentes</dt><dd className="break-words text-amber-800 dark:text-amber-200">{checkin.decisoesPendentes}</dd></div> : null}
        {checkin.proximosPassos ? <div><dt className="font-semibold text-zinc-700 dark:text-zinc-200">Próximos passos</dt><dd className="break-words text-zinc-600 dark:text-zinc-400">{checkin.proximosPassos}</dd></div> : null}
        </dl>
      </details> : null}
      {checkin.proximaRevisao ? <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Próxima revisão prevista na época: {formatDate(checkin.proximaRevisao)}</p> : null}
      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Decisões vinculadas ({decisions.length})</h4>
        {decisions.length ? <ul id={`checkin-decisions-${checkin.id}`} className="mt-2 space-y-2">{visibleDecisions.map(decision => <li key={decision.id}>
          <button type="button" onClick={() => onOpenRecord('revisoes', `decision-${decision.id}`)} className="geo-focus-ring w-full rounded px-2 py-2 text-left text-sm text-brand-primary-700 hover:bg-brand-primary-50 dark:text-brand-primary-200 dark:hover:bg-brand-primary-400/10"><span className="break-words">{decision.descricao}</span><span className="mt-1 block text-xs">{label(decision.status)} · {decision.responsavel} · {formatDate(decision.prazo)}</span></button>
        </li>)}</ul> : null}
        {decisions.length > 3 ? <button type="button" aria-expanded={showAllDecisions} aria-controls={`checkin-decisions-${checkin.id}`} onClick={() => setShowAllDecisions(value => !value)} className={cn(secondarySmallActionButtonClass, 'mt-3 mr-2')}>
          {showAllDecisions ? 'Mostrar menos decisões' : `Ver todas as ${decisions.length} decisões`}
        </button> : null}
        <button type="button" onClick={() => onDialog({ kind: 'decision', checkinId: checkin.id, parentId: checkin.objetivoId || undefined })} className={cn(secondarySmallActionButtonClass, 'mt-3')}><Plus aria-hidden="true" className="h-4 w-4" /> Adicionar decisão a esta revisão</button>
      </div>
    </li>
  );
}

function DecisionCard({
  decision,
  onDialog,
  onDelete
}: {
  decision: StrategicDecision;
  onDialog: (dialog: PlanningDialog) => void;
  onDelete: (target: Exclude<DeleteTarget, null>) => void;
}) {
  return (
    <li id={`planning-record-decision-${decision.id}`} tabIndex={-1} className={cn(
      'geo-focus-ring rounded-lg border p-4',
      decision.atrasada
        ? 'border-red-200 bg-red-50/60 dark:border-red-400/20 dark:bg-red-400/5'
        : 'border-zinc-200 dark:border-zinc-800'
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={decision.status} />
            {decision.atrasada ? <span className="text-xs font-semibold text-red-700 dark:text-red-200">Decisão vencida</span> : null}
          </div>
          <p className="mt-3 break-words text-sm font-semibold leading-6 text-zinc-950 dark:text-white">{decision.descricao}</p>
        </div>
        <EntityActions
          onEdit={() => onDialog({ kind: 'decision', initial: decision })}
          onDelete={() => onDelete({ kind: 'decision', id: decision.id, title: 'decisão estratégica' })}
          editLabel="Editar decisão estratégica"
          deleteLabel="Excluir decisão estratégica"
        />
      </div>
      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div><dt className="text-zinc-500 dark:text-zinc-400">Responsável</dt><dd className="mt-1 break-words font-semibold text-zinc-800 dark:text-zinc-200">{decision.responsavel}</dd></div>
        <div><dt className="text-zinc-500 dark:text-zinc-400">Prazo</dt><dd className="mt-1 font-semibold text-zinc-800 dark:text-zinc-200">{formatDate(decision.prazo)}</dd></div>
      </dl>
      {decision.observacaoEncerramento ? (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
          <strong>Encerramento:</strong> {decision.observacaoEncerramento}
        </div>
      ) : null}
    </li>
  );
}

function RiskCard({
  risk,
  onDialog,
  onDelete
}: {
  risk: StrategicRisk;
  onDialog: (dialog: PlanningDialog) => void;
  onDelete: (target: Exclude<DeleteTarget, null>) => void;
}) {
  return (
    <li id={`planning-record-risk-${risk.id}`} tabIndex={-1} className={cn('geo-focus-ring rounded-lg border p-4', ['alto', 'critico'].includes(risk.impacto) ? 'border-red-200 dark:border-red-400/20' : 'border-zinc-200 dark:border-zinc-800')}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={risk.status} />
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Impacto {label(risk.impacto).toLowerCase()} · probabilidade {label(risk.probabilidade).toLowerCase().replace(/o$/, 'a')}</span>
          </div>
          <p className="mt-3 break-words text-sm font-semibold leading-6 text-zinc-950 dark:text-white">{risk.descricao}</p>
        </div>
        <EntityActions
          onEdit={() => onDialog({ kind: 'risk', initial: risk })}
          onDelete={() => onDelete({ kind: 'risk', id: risk.id, title: 'risco estratégico' })}
          editLabel="Editar risco estratégico"
          deleteLabel="Excluir risco estratégico"
        />
      </div>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Responsável: <strong className="text-zinc-700 dark:text-zinc-200">{risk.responsavel}</strong></p>
      {risk.mitigacao ? <div className="mt-3 rounded-lg bg-zinc-50 p-3 text-xs leading-5 text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300"><strong>Mitigação:</strong> {risk.mitigacao}</div> : null}
    </li>
  );
}
