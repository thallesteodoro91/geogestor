import { AddressBook, ArrowCounterClockwise, ArrowsLeftRight, CalendarBlank, CalendarCheck, CaretLeft, CaretRight, Check, ClockCountdown, ClockCounterClockwise, CurrencyDollar, Eye, FileText, Funnel, Handshake, MagnifyingGlass, PencilSimple, Plus, Target, Trash, TrendUp, WarningCircle, X
} from '@phosphor-icons/react';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { ACTIVE_OPPORTUNITY_STAGES, OPPORTUNITY_STAGES, isActiveOpportunityStage, type OpportunityAnalytics, type OpportunityListItem, type OpportunityStage } from '@geogestor/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { DatePickerField, FormError, FormField, FormFooter, FormSection, FormSelect } from '../../components/Form';
import { Skeleton } from '../../components/Skeleton';
import { apiClient } from '../../services/apiClient';
import { matchesSearch } from '../../utils/searchHelpers';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass, primaryActionIconClass, primarySubmitButtonClass } from '../../utils/actionStyles';
import { CLIENT_ORIGIN_OPTIONS, CLIENT_SERVICOS_OPTIONS } from '../../utils/clientTags';
import { geoFieldClass, geoKickerClass } from '../../utils/geoTheme';
import { Contatos, type ContatosHandle } from '../Contatos/Contatos';

type CRMOptions = {
  clients: Array<{ id: string; name: string }>;
  leads: Array<{ id: string; name: string; company: string | null }>;
  budgets: Array<{
    id: string;
    clientId: string;
    code: string | null;
    version: number;
    description: string | null;
    status: string;
    totalCents: number;
    projectId: string | null;
  }>;
};

type FormState = {
  clienteId: string;
  leadId: string;
  titulo: string;
  valorEstimado: string;
  responsavel: string;
  origem: string;
  servicoTipo: string;
  proximaAcao: string;
  proximaAcaoEm: string;
  previsaoFechamento: string;
  probabilidade: string;
  observacoes: string;
  orcamentoId: string;
};

type OpportunityFormErrors = Partial<Record<'subject' | 'titulo' | 'valorEstimado' | 'probabilidade' | 'proximaAcao' | 'proximaAcaoEm', string>>;

type CommercialSubjectOption = {
  id: string;
  type: 'client' | 'lead';
  label: string;
};

type OpportunityHistoryItem = {
  id: string;
  estagioAnterior: OpportunityStage | null;
  estagioNovo: OpportunityStage;
  motivo: string | null;
  usuarioId: string | null;
  createdAt: string;
};

type OpportunityDetail = OpportunityListItem & { history: OpportunityHistoryItem[] };

const emptyAnalytics: OpportunityAnalytics = {
  total: 0,
  activeCount: 0,
  wonCount: 0,
  lostCount: 0,
  openPipelineCents: 0,
  weightedPipelineCents: 0,
  wonValueCents: 0,
  conversionBasisPoints: 0,
  overdueNextActions: 0,
  staleOpportunities: 0,
  counts: { Prospectado: 0, Contato: 0, Proposta: 0, Ganho: 0, Perdido: 0 },
  values: { Prospectado: 0, Contato: 0, Proposta: 0, Ganho: 0, Perdido: 0 },
  averageDaysInStage: { Prospectado: 0, Contato: 0, Proposta: 0, Ganho: 0, Perdido: 0 }
};

const fieldClass = cn(geoFieldClass, 'min-h-11 w-full px-3 text-sm');
const activeStages = [...ACTIVE_OPPORTUNITY_STAGES] as OpportunityStage[];

const stageStyles: Record<OpportunityStage, { border: string; badge: string; surface: string; dot: string }> = {
  Prospectado: { border: 'border-t-blue-500', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200', surface: 'bg-blue-50/30 dark:bg-blue-500/[0.025]', dot: 'bg-blue-500' },
  Contato: { border: 'border-t-amber-500', badge: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100', surface: 'bg-amber-50/30 dark:bg-amber-500/[0.025]', dot: 'bg-amber-500' },
  Proposta: { border: 'border-t-violet-500', badge: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200', surface: 'bg-violet-50/30 dark:bg-violet-500/[0.025]', dot: 'bg-violet-500' },
  Ganho: { border: 'border-t-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-100', surface: 'bg-emerald-50/30 dark:bg-emerald-500/[0.025]', dot: 'bg-emerald-500' },
  Perdido: { border: 'border-t-rose-500', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-100', surface: 'bg-rose-50/30 dark:bg-rose-500/[0.025]', dot: 'bg-rose-500' }
};

function emptyForm(clientId = '', leadId = ''): FormState {
  return {
    clienteId: clientId,
    leadId,
    titulo: '',
    valorEstimado: '',
    responsavel: '',
    origem: '',
    servicoTipo: '',
    proximaAcao: '',
    proximaAcaoEm: '',
    previsaoFechamento: '',
    probabilidade: '10',
    observacoes: '',
    orcamentoId: ''
  };
}

function opportunityToForm(opportunity: OpportunityListItem): FormState {
  return {
    clienteId: opportunity.clienteId || '',
    leadId: opportunity.leadId || '',
    titulo: opportunity.titulo,
    valorEstimado: opportunity.valorEstimado == null ? '' : String(opportunity.valorEstimado / 100),
    responsavel: opportunity.responsavel || '',
    origem: opportunity.origem || '',
    servicoTipo: opportunity.servicoTipo || '',
    proximaAcao: opportunity.proximaAcao || '',
    proximaAcaoEm: opportunity.proximaAcaoEm || '',
    previsaoFechamento: opportunity.previsaoFechamento || '',
    probabilidade: String(opportunity.probabilidadePontosBase / 100),
    observacoes: opportunity.observacoes || '',
    orcamentoId: opportunity.orcamentoId || ''
  };
}

function formatCurrency(cents?: number | null) {
  if (cents == null) return 'A definir';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function formatPercentage(basisPoints: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(basisPoints / 10_000);
}

function formatDate(value?: string | null) {
  if (!value) return 'Não definida';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function currencyToCents(value: string) {
  if (!value.trim()) return null;
  const sanitized = value.trim().replace(/[^\d,.-]/g, '');
  const normalized = sanitized.includes(',')
    ? sanitized.replace(/\./g, '').replace(',', '.')
    : (() => {
        const dotParts = sanitized.split('.');
        return dotParts.length > 2 || (dotParts.length === 2 && dotParts[1].length === 3)
          ? sanitized.replace(/\./g, '')
          : sanitized;
      })();
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
}

function formatCurrencyInput(value: string) {
  const cents = currencyToCents(value);
  if (cents == null) return value;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

type MetricTone = 'default' | 'danger' | 'warning';

function Metric({ label, value, helper, icon, tone = 'default' }: { label: string; value: string; helper: string; icon: React.ReactNode; tone?: MetricTone }) {
  return (
    <div className={cn(
      'geo-card relative min-w-0 p-4 shadow-sm',
      tone === 'danger' && 'border-rose-200 bg-rose-50/45 dark:border-rose-400/20 dark:bg-rose-500/[0.07]',
      tone === 'warning' && 'border-amber-200 bg-amber-50/45 dark:border-amber-400/20 dark:bg-amber-500/[0.07]'
    )}>
      <p className="pr-11 text-[10px] font-bold uppercase tracking-[0.13em] text-text-muted">{label}</p>
      <p className="mt-2 whitespace-nowrap font-mono text-lg font-bold tabular-nums text-text-primary 2xl:text-base" title={value}>{value}</p>
      <p className="mt-1 text-xs text-text-muted">{helper}</p>
      <span className={cn(
        'absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg ring-1',
        tone === 'default' && 'bg-brand-surface-subtle text-brand-primary-700 ring-brand-border dark:text-brand-primary-200',
        tone === 'danger' && 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-400/20',
        tone === 'warning' && 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-400/20'
      )}>{icon}</span>
    </div>
  );
}

type CRMView = 'leads' | 'funil' | 'indicadores';

interface LeadAnalytics {
  total: number;
  activeCount: number;
  convertedCount: number;
  conversionBasisPoints: number;
}

const CRM_SECTIONS: Array<{ id: CRMView; label: string; icon: React.ReactNode }> = [
  { id: 'leads', label: 'Leads', icon: <AddressBook aria-hidden="true" size={18} /> },
  { id: 'funil', label: 'Funil de vendas', icon: <Funnel aria-hidden="true" size={18} /> },
  { id: 'indicadores', label: 'Indicadores', icon: <TrendUp aria-hidden="true" size={18} /> }
];

function CRMSectionNavigation({ activeView }: { activeView: CRMView }) {
  const [searchParams] = useSearchParams();

  return (
    <nav aria-label="Seções do CRM" className="max-w-full min-w-0 overflow-x-auto rounded-2xl border border-brand-border bg-brand-surface p-1.5 shadow-sm">
      <div className="flex min-w-max gap-1" role="list">
        {CRM_SECTIONS.map((section) => {
          const active = section.id === activeView;
          const nextSearchParams = new URLSearchParams(searchParams);
          nextSearchParams.set('view', section.id);
          return (
            <Link
              key={section.id}
              to={`/crm?${nextSearchParams.toString()}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'geo-focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[background-color,color,box-shadow] duration-150',
                active
                  ? 'bg-brand-primary-50 text-brand-primary-700 shadow-sm ring-1 ring-inset ring-brand-primary-200/70 dark:bg-brand-primary-400/15 dark:text-brand-primary-100 dark:ring-brand-primary-300/15'
                  : 'text-text-secondary hover:bg-brand-surface-subtle hover:text-text-primary'
              )}
            >
              {section.icon}
              {section.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function CRM() {
  const leadsRef = useRef<ContatosHandle>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const activeView: CRMView = requestedView === 'leads' || requestedView === 'indicadores' || requestedView === 'funil' ? requestedView : 'funil';
  const searchTerm = searchParams.get('q') || '';
  const responsibleFilter = searchParams.get('responsavel') || '';
  const serviceFilter = searchParams.get('servico') || '';
  const attentionParam = searchParams.get('atencao');
  const attentionFilter: 'all' | 'overdue' | 'stale' = attentionParam === 'overdue' || attentionParam === 'stale' ? attentionParam : 'all';
  const updateFilter = (key: string, value: string, defaultValue = '') => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value && value !== defaultValue) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  };
  const setSearchTerm = (value: string) => updateFilter('q', value);
  const setResponsibleFilter = (value: string) => updateFilter('responsavel', value);
  const setServiceFilter = (value: string) => updateFilter('servico', value);
  const setAttentionFilter = (value: 'all' | 'overdue' | 'stale') => updateFilter('atencao', value, 'all');
  const [showModal, setShowModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityListItem | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [formError, setFormError] = useState('');
  const [formErrors, setFormErrors] = useState<OpportunityFormErrors>({});
  const [subjectSearch, setSubjectSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<OpportunityListItem | null>(null);
  const [pendingOutcome, setPendingOutcome] = useState<{ opportunity: OpportunityListItem; stage: 'Ganho' | 'Perdido' } | null>(null);
  const [outcomeReason, setOutcomeReason] = useState('');
  const [historyTarget, setHistoryTarget] = useState<OpportunityListItem | null>(null);

  const opportunitiesQuery = useQuery<OpportunityListItem[]>({
    queryKey: ['opportunities'],
    queryFn: () => apiClient.get('/api/oportunidades')
  });
  const optionsQuery = useQuery<CRMOptions>({
    queryKey: ['opportunity-options'],
    queryFn: () => apiClient.get('/api/oportunidades/options')
  });
  const analyticsQuery = useQuery<OpportunityAnalytics>({
    queryKey: ['opportunity-analytics'],
    queryFn: () => apiClient.get('/api/oportunidades/analytics')
  });
  const leadAnalyticsQuery = useQuery<LeadAnalytics>({
    queryKey: ['lead-analytics'],
    queryFn: () => apiClient.get('/api/contatos/analytics')
  });
  const historyQuery = useQuery<OpportunityDetail>({
    queryKey: ['opportunity-detail', historyTarget?.id],
    queryFn: () => apiClient.get(`/api/oportunidades/${historyTarget!.id}`),
    enabled: Boolean(historyTarget)
  });

  const opportunities = useMemo(() => opportunitiesQuery.data ?? [], [opportunitiesQuery.data]);
  const options = optionsQuery.data || { clients: [], leads: [], budgets: [] };
  const analytics = analyticsQuery.data || emptyAnalytics;
  const commercialSubjectOptions = useMemo<CommercialSubjectOption[]>(() => [
    ...options.clients.map((client) => ({ id: client.id, type: 'client' as const, label: `Cliente · ${client.name}` })),
    ...options.leads.map((lead) => ({ id: lead.id, type: 'lead' as const, label: `Lead · ${lead.name}${lead.company ? ` · ${lead.company}` : ''}` }))
  ], [options.clients, options.leads]);

  const clearFormError = (field: keyof OpportunityFormErrors) => {
    setFormErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const updateFormField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field in formErrors) clearFormError(field as keyof OpportunityFormErrors);
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
      queryClient.invalidateQueries({ queryKey: ['opportunity-analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['opportunity-options'] }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      queryClient.invalidateQueries({ queryKey: ['budget-kpis'] })
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.clienteId && !form.leadId) throw new Error('Selecione um cliente ou um lead.');
      if (!form.titulo.trim()) throw new Error('Informe o título do negócio.');
      const valueCents = currencyToCents(form.valorEstimado);
      if (form.valorEstimado.trim() && valueCents == null) throw new Error('Informe um valor estimado válido.');
      const probability = Number(form.probabilidade.replace(',', '.'));
      if (!Number.isFinite(probability) || probability < 0 || probability > 100) throw new Error('A probabilidade deve estar entre 0% e 100%.');
      if (Boolean(form.proximaAcao.trim()) !== Boolean(form.proximaAcaoEm)) throw new Error('Informe a próxima ação e sua data em conjunto.');
      const payload = {
        clienteId: form.clienteId || null,
        leadId: form.leadId || null,
        titulo: form.titulo.trim(),
        valorEstimado: valueCents,
        responsavel: form.responsavel.trim() || null,
        origem: form.origem.trim() || null,
        servicoTipo: form.servicoTipo.trim() || null,
        proximaAcao: form.proximaAcao.trim() || null,
        proximaAcaoEm: form.proximaAcaoEm || null,
        previsaoFechamento: form.previsaoFechamento || null,
        probabilidadePontosBase: Math.round(probability * 100),
        observacoes: form.observacoes.trim() || null
      };

      if (!selectedOpportunity) {
        return apiClient.post<OpportunityListItem>('/api/oportunidades', { ...payload, orcamentoId: form.orcamentoId || null });
      }

      await apiClient.patch<OpportunityListItem>(`/api/oportunidades/${selectedOpportunity.id}`, payload);
      if (form.orcamentoId !== (selectedOpportunity.orcamentoId || '')) {
        if (form.orcamentoId) {
          return apiClient.post<OpportunityListItem>(`/api/oportunidades/${selectedOpportunity.id}/link-budget`, { orcamentoId: form.orcamentoId });
        }
        return apiClient.patch<OpportunityListItem>(`/api/oportunidades/${selectedOpportunity.id}`, { orcamentoId: null });
      }
      return apiClient.get<OpportunityListItem>(`/api/oportunidades/${selectedOpportunity.id}`);
    },
    onSuccess: async () => {
      setShowModal(false);
      await refresh();
      toast.success(selectedOpportunity ? 'Oportunidade atualizada.' : 'Oportunidade criada.');
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : 'Não foi possível salvar a oportunidade.')
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, stage, reason, order }: { id: string; stage: OpportunityStage; reason?: string; order?: number }) => (
      apiClient.patch<OpportunityListItem>(`/api/oportunidades/${id}/transition`, { estagio: stage, motivo: reason || null, ordem: order })
    ),
    onSuccess: async () => {
      setPendingOutcome(null);
      setOutcomeReason('');
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível mover a oportunidade.')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/oportunidades/${id}`),
    onSuccess: async () => {
      setDeleteTarget(null);
      await refresh();
      toast.success('Oportunidade excluída.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível excluir a oportunidade.')
  });

  const convertProjectMutation = useMutation({
    mutationFn: (opportunity: OpportunityListItem) => apiClient.post<{ projectId: string }>(`/api/oportunidades/${opportunity.id}/convert-project`, { nomeProjeto: opportunity.titulo }),
    onSuccess: async (result) => {
      await refresh();
      toast.success('Projeto vinculado à oportunidade.');
      navigate(`/projetos/${result.projectId}`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível converter a oportunidade em projeto.')
  });

  const openCreate = () => {
    setSelectedOpportunity(null);
    setForm(emptyForm());
    setSubjectSearch('');
    setFormError('');
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (opportunity: OpportunityListItem) => {
    setSelectedOpportunity(opportunity);
    setForm(opportunityToForm(opportunity));
    const subject = commercialSubjectOptions.find((option) => (
      option.type === 'client' ? option.id === opportunity.clienteId : option.id === opportunity.leadId
    ));
    setSubjectSearch(subject?.label || `${opportunity.vinculoTipo === 'lead' ? 'Lead' : 'Cliente'} · ${opportunity.clienteNome}`);
    setFormError('');
    setFormErrors({});
    setShowModal(true);
  };

  const handleSubjectChange = (value: string) => {
    setSubjectSearch(value);
    const subject = commercialSubjectOptions.find((option) => option.label === value);
    setForm((current) => ({
      ...current,
      clienteId: subject?.type === 'client' ? subject.id : '',
      leadId: subject?.type === 'lead' ? subject.id : '',
      orcamentoId: ''
    }));
    clearFormError('subject');
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: OpportunityFormErrors = {};
    if (!form.clienteId && !form.leadId) errors.subject = 'Selecione uma opção válida da lista de clientes ou leads.';
    if (!form.titulo.trim()) errors.titulo = 'Informe o título do negócio.';
    if (form.valorEstimado.trim() && currencyToCents(form.valorEstimado) == null) errors.valorEstimado = 'Informe um valor monetário válido.';
    const probability = Number(form.probabilidade.replace(',', '.'));
    if (!Number.isFinite(probability) || probability < 0 || probability > 100) errors.probabilidade = 'Informe uma probabilidade entre 0% e 100%.';
    if (form.proximaAcao.trim() && !form.proximaAcaoEm) errors.proximaAcaoEm = 'Informe a data da próxima ação.';
    if (!form.proximaAcao.trim() && form.proximaAcaoEm) errors.proximaAcao = 'Descreva a ação programada para esta data.';
    const todayKey = new Date().toISOString().slice(0, 10);
    if (form.proximaAcaoEm && form.proximaAcaoEm < todayKey && form.proximaAcaoEm !== selectedOpportunity?.proximaAcaoEm) {
      errors.proximaAcaoEm = 'A data informada já está vencida. Escolha hoje ou uma data futura.';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError('Revise os campos destacados antes de salvar.');
      const fieldOrder: Array<keyof OpportunityFormErrors> = ['subject', 'titulo', 'valorEstimado', 'probabilidade', 'proximaAcao', 'proximaAcaoEm'];
      const fieldIds: Record<keyof OpportunityFormErrors, string> = {
        subject: 'crm-client',
        titulo: 'crm-title',
        valorEstimado: 'crm-value',
        probabilidade: 'crm-probability',
        proximaAcao: 'crm-next-action',
        proximaAcaoEm: 'crm-next-action-date'
      };
      const firstInvalid = fieldOrder.find((field) => errors[field]);
      window.requestAnimationFrame(() => {
        const target = firstInvalid ? document.getElementById(fieldIds[firstInvalid]) : null;
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      });
      return;
    }

    setFormError('');
    saveMutation.mutate();
  };

  const responsibleOptions = useMemo(() => Array.from(new Set(opportunities.map((item) => item.responsavel).filter(Boolean) as string[])).sort(), [opportunities]);
  const serviceOptions = useMemo(() => Array.from(new Set(opportunities.map((item) => item.servicoTipo).filter(Boolean) as string[])).sort(), [opportunities]);
  const serviceSuggestions = useMemo(() => Array.from(new Set([...CLIENT_SERVICOS_OPTIONS, ...serviceOptions])).sort(), [serviceOptions]);
  const attentionDates = useMemo(() => {
    const referenceTime = opportunitiesQuery.dataUpdatedAt || analyticsQuery.dataUpdatedAt;
    return {
      today: referenceTime ? new Date(referenceTime).toISOString().slice(0, 10) : '',
      staleLimit: referenceTime - 14 * 86_400_000
    };
  }, [analyticsQuery.dataUpdatedAt, opportunitiesQuery.dataUpdatedAt]);
  const { today, staleLimit } = attentionDates;
  const filteredOpportunities = useMemo(() => opportunities.filter((opportunity) => {
    const searchable = [opportunity.titulo, opportunity.clienteNome, opportunity.estagio, opportunity.servicoTipo, opportunity.responsavel, opportunity.origem].filter(Boolean).join(' ');
    if (!matchesSearch(searchable, searchTerm)) return false;
    if (responsibleFilter && opportunity.responsavel !== responsibleFilter) return false;
    if (serviceFilter && opportunity.servicoTipo !== serviceFilter) return false;
    if (attentionFilter === 'overdue' && !(isActiveOpportunityStage(opportunity.estagio) && opportunity.proximaAcaoEm && opportunity.proximaAcaoEm < today)) return false;
    if (attentionFilter === 'stale' && !(isActiveOpportunityStage(opportunity.estagio) && Date.parse(opportunity.estagioAlteradoEm) < staleLimit)) return false;
    return true;
  }), [attentionFilter, opportunities, responsibleFilter, searchTerm, serviceFilter, staleLimit, today]);
  const boardFiltered = Boolean(searchTerm || responsibleFilter || serviceFilter || attentionFilter !== 'all');

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) return;
    if (boardFiltered) {
      toast.info('Limpe os filtros para reordenar por arraste sem alterar a posição de cards ocultos.');
      return;
    }
    const destinationStage = destination.droppableId as OpportunityStage;
    const opportunity = opportunities.find((item) => item.id === draggableId);
    if (!opportunity) return;

    if (source.droppableId !== destination.droppableId) {
      if (destinationStage === 'Ganho' || destinationStage === 'Perdido') {
        setPendingOutcome({ opportunity, stage: destinationStage });
        setOutcomeReason('');
        return;
      }
      transitionMutation.mutate({ id: opportunity.id, stage: destinationStage, order: destination.index });
      return;
    }

    const stageItems = opportunities.filter((item) => item.estagio === destinationStage).sort((a, b) => a.ordem - b.ordem);
    const draggedIndex = stageItems.findIndex((item) => item.id === draggableId);
    if (draggedIndex < 0) return;
    const [dragged] = stageItems.splice(draggedIndex, 1);
    stageItems.splice(destination.index, 0, dragged);
    const updates = stageItems.map((item, order) => ({ id: item.id, estagio: destinationStage, ordem: order }));
    const previous = opportunities;
    queryClient.setQueryData<OpportunityListItem[]>(['opportunities'], opportunities.map((item) => {
      const update = updates.find((candidate) => candidate.id === item.id);
      return update ? { ...item, ordem: update.ordem } : item;
    }));
    try {
      await apiClient.patch('/api/oportunidades/reorder', updates);
    } catch (error) {
      queryClient.setQueryData(['opportunities'], previous);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a nova ordem.');
    }
  };

  const moveActiveStage = (opportunity: OpportunityListItem, direction: 'left' | 'right') => {
    const index = activeStages.indexOf(opportunity.estagio);
    const target = activeStages[direction === 'left' ? index - 1 : index + 1];
    if (target) transitionMutation.mutate({ id: opportunity.id, stage: target });
  };

  const confirmOutcome = () => {
    if (!pendingOutcome) return;
    if (pendingOutcome.stage === 'Perdido' && !outcomeReason.trim()) {
      toast.error('Informe o motivo da perda.');
      return;
    }
    transitionMutation.mutate({ id: pendingOutcome.opportunity.id, stage: pendingOutcome.stage, reason: outcomeReason.trim() });
  };

  const selectedBudgets = options.budgets.filter((budget) => budget.clientId === form.clienteId);
  const leadAnalytics = leadAnalyticsQuery.data || { total: 0, activeCount: 0, convertedCount: 0, conversionBasisPoints: 0 };

  if (activeView === 'leads') {
    return (
      <Layout contentClassName="max-w-[1800px]">
        <div className="min-w-0 space-y-6">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className={cn(geoKickerClass, 'mb-4')}>Área comercial</span>
              <h1 className="flex items-center gap-3 text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl"><Funnel aria-hidden="true" size={42} weight="duotone" className="text-brand-primary-600" />CRM</h1>
              <p className="mt-3 max-w-3xl break-words text-base font-medium leading-7 text-text-secondary">Centralize leads, oportunidades e resultados comerciais sem misturar seus cadastros.</p>
            </div>
            <button type="button" onClick={() => leadsRef.current?.openCreate()} className={cn(primaryActionButtonClass, 'shrink-0 self-start sm:self-auto')}>
              <span>Novo lead</span>
              <span className={primaryActionIconClass}><Plus aria-hidden="true" size={17} weight="bold" /></span>
            </button>
          </header>
          <CRMSectionNavigation activeView={activeView} />
          <Contatos ref={leadsRef} embedded />
        </div>
      </Layout>
    );
  }

  if (activeView === 'indicadores') {
    const indicatorsError = leadAnalyticsQuery.isError || analyticsQuery.isError;
    const indicatorsLoading = leadAnalyticsQuery.isLoading || analyticsQuery.isLoading;
    const hasOpportunityData = analytics.total > 0 || OPPORTUNITY_STAGES.some((stage) => analytics.counts[stage] > 0 || analytics.values[stage] > 0);
    const funnelSearchParams = new URLSearchParams(searchParams);
    funnelSearchParams.set('view', 'funil');
    return (
      <Layout contentClassName="max-w-[1800px]">
        <div className="min-w-0 space-y-6">
          <header>
            <span className={cn(geoKickerClass, 'mb-4')}>Área comercial</span>
            <h1 className="flex items-center gap-3 text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl"><Funnel aria-hidden="true" size={42} weight="duotone" className="text-brand-primary-600" />CRM</h1>
            <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-text-secondary">Acompanhe conversão de leads, valor do pipeline e oportunidades que exigem atenção.</p>
          </header>
          <CRMSectionNavigation activeView={activeView} />
          {indicatorsError ? (
            <div className="geo-card p-6"><FormError message="Não foi possível carregar todos os indicadores comerciais." /><button type="button" onClick={() => { void leadAnalyticsQuery.refetch(); void analyticsQuery.refetch(); }} className="geo-button-base geo-button-secondary geo-focus-ring mt-4 min-h-10 px-4">Tentar novamente</button></div>
          ) : indicatorsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}</div>
          ) : (
            <>
              <section aria-label="Indicadores comerciais" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Leads ativos" value={String(leadAnalytics.activeCount)} helper="Aguardando conversão" icon={<AddressBook aria-hidden="true" size={19} />} />
                <Metric label="Leads convertidos" value={String(leadAnalytics.convertedCount)} helper="Histórico preservado" icon={<Check aria-hidden="true" size={19} />} />
                <Metric label="Conversão de leads" value={formatPercentage(leadAnalytics.conversionBasisPoints)} helper={`${leadAnalytics.convertedCount} de ${leadAnalytics.total} leads`} icon={<Target aria-hidden="true" size={19} />} />
                <Metric label="Pipeline em aberto" value={formatCurrency(analytics.openPipelineCents)} helper={`${analytics.activeCount} oportunidade(s) ativa(s)`} icon={<CurrencyDollar aria-hidden="true" size={19} />} />
                <Metric label="Oportunidades ganhas" value={String(analytics.wonCount)} helper={formatCurrency(analytics.wonValueCents)} icon={<TrendUp aria-hidden="true" size={19} />} />
                <Metric label="Oportunidades perdidas" value={String(analytics.lostCount)} helper="Negócios encerrados sem ganho" icon={<X aria-hidden="true" size={19} />} />
                <Metric label="Próximas ações atrasadas" value={String(analytics.overdueNextActions)} helper="Prazo programado já ultrapassado" icon={<CalendarBlank aria-hidden="true" size={19} />} tone={analytics.overdueNextActions > 0 ? 'danger' : 'default'} />
                <Metric label="Oportunidades paradas" value={String(analytics.staleOpportunities)} helper="Mais de 14 dias na etapa" icon={<ClockCountdown aria-hidden="true" size={19} />} tone={analytics.staleOpportunities > 0 ? 'warning' : 'default'} />
              </section>
              <section className="geo-card overflow-hidden" aria-labelledby="stage-indicators-title">
                <div className="border-b border-brand-border p-5"><h2 id="stage-indicators-title" className="text-lg font-semibold text-text-primary">Oportunidades por etapa</h2><p className="mt-1 text-sm text-text-secondary">Quantidade e valor estimado em cada etapa do funil.</p></div>
                {hasOpportunityData ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="bg-brand-surface-subtle text-xs uppercase tracking-wide text-text-muted"><tr><th scope="col" className="px-5 py-3">Etapa</th><th scope="col" className="px-5 py-3 text-right">Quantidade</th><th scope="col" className="px-5 py-3 text-right">Valor</th></tr></thead>
                      <tbody className="divide-y divide-brand-border">{OPPORTUNITY_STAGES.map((stage) => <tr key={stage}><th scope="row" className="px-5 py-4 font-semibold text-text-primary"><span className="inline-flex items-center gap-2.5"><span aria-hidden="true" className={cn('h-2.5 w-2.5 shrink-0 rounded-full', stageStyles[stage].dot)} />{stage}</span></th><td className="px-5 py-4 text-right font-mono tabular-nums text-text-secondary">{analytics.counts[stage]}</td><td className="px-5 py-4 text-right font-mono tabular-nums text-text-secondary">{formatCurrency(analytics.values[stage])}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center px-6 py-12 text-center" role="status">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary-50 text-brand-primary-700 ring-1 ring-inset ring-brand-primary-200/70 dark:bg-brand-primary-400/10 dark:text-brand-primary-200 dark:ring-brand-primary-300/15"><Funnel aria-hidden="true" size={24} weight="duotone" /></span>
                    <p className="mt-4 font-semibold text-text-primary">Nenhuma oportunidade registrada</p>
                    <p className="mt-1 max-w-md text-sm leading-6 text-text-secondary">Crie ou acompanhe oportunidades no funil para visualizar quantidades e valores por etapa.</p>
                    <Link to={`/crm?${funnelSearchParams.toString()}`} className="geo-button-base geo-button-secondary geo-focus-ring mt-5 min-h-11 px-4">Ir para o funil</Link>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout contentClassName="max-w-[1800px]">
      <div className="min-w-0 space-y-8">
        <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className={cn(geoKickerClass, 'mb-4')}>Área comercial</span>
            <h1 className="flex items-center gap-3 text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl"><Funnel aria-hidden="true" size={42} weight="duotone" className="text-brand-primary-600" />CRM</h1>
            <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-text-secondary">Acompanhe próximas ações, propostas, probabilidade de fechamento e conversões em projetos.</p>
          </div>
          <button type="button" onClick={openCreate} disabled={!options.clients.length && !options.leads.length} className={cn(primaryActionButtonClass, 'disabled:cursor-not-allowed disabled:opacity-50')}><span>Nova oportunidade</span><span className={primaryActionIconClass}><Plus aria-hidden="true" size={17} weight="bold" /></span></button>
        </header>
        <CRMSectionNavigation activeView={activeView} />

        <section className="geo-card p-4 sm:p-5" aria-label="Filtros do funil">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,2fr)_repeat(3,minmax(180px,1fr))]">
            <label className="relative"><span className="sr-only">Buscar oportunidades</span><MagnifyingGlass aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-3.5 text-text-muted" /><input type="search" name="crm-search" autoComplete="off" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Oportunidade, cliente, serviço…" className={cn(fieldClass, 'pl-10')} /></label>
            <FormSelect aria-label="Filtrar por responsável" value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)} className={fieldClass}><option value="">Todos os responsáveis</option>{responsibleOptions.map((value) => <option key={value}>{value}</option>)}</FormSelect>
            <FormSelect aria-label="Filtrar por serviço" value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)} className={fieldClass}><option value="">Todos os serviços</option>{serviceOptions.map((value) => <option key={value}>{value}</option>)}</FormSelect>
            <FormSelect aria-label="Filtrar oportunidades que exigem atenção" value={attentionFilter} onChange={(event) => setAttentionFilter(event.target.value as typeof attentionFilter)} className={fieldClass}><option value="all">Todas as oportunidades</option><option value="overdue">Próximas ações atrasadas</option><option value="stale">Paradas há mais de 14 dias</option></FormSelect>
          </div>
          {boardFiltered && <p className="mt-3 flex items-center gap-2 text-xs text-text-muted"><WarningCircle aria-hidden="true" size={15} />O arraste fica protegido durante filtros. Use as ações do card ou limpe os filtros para reordenar.</p>}
        </section>

        {opportunitiesQuery.isError ? (
          <div className="geo-card p-6"><FormError message={opportunitiesQuery.error instanceof Error ? opportunitiesQuery.error.message : 'Não foi possível carregar o funil.'} /><button type="button" onClick={() => opportunitiesQuery.refetch()} className="geo-button-base geo-button-secondary geo-focus-ring mt-4 min-h-10 px-4">Tentar novamente</button></div>
        ) : opportunitiesQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-[520px] rounded-2xl" />)}</div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-end gap-2 text-xs text-text-muted min-[1440px]:hidden"><ArrowsLeftRight aria-hidden="true" size={15} />Role horizontalmente para navegar entre todas as etapas</div>
            <div className="relative">
            <div className="snap-x snap-proximity overflow-x-auto pb-5 pr-8 overscroll-x-contain min-[1440px]:overflow-x-visible min-[1440px]:pr-0" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(148, 163, 184, 0.35) transparent' }} aria-label="Etapas do funil com rolagem horizontal">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex min-w-max items-start gap-5 min-[1440px]:w-full min-[1440px]:min-w-0 min-[1440px]:gap-3">
                  {OPPORTUNITY_STAGES.map((stage) => {
                    const items = filteredOpportunities.filter((item) => item.estagio === stage).sort((a, b) => a.ordem - b.ordem);
                    return (
                      <section key={stage} className={cn('flex w-[310px] shrink-0 snap-start flex-col rounded-2xl border border-brand-border border-t-4 p-3 shadow-sm sm:w-[330px] min-[1440px]:min-h-[calc(100vh-510px)] min-[1440px]:w-0 min-[1440px]:min-w-0 min-[1440px]:flex-1 min-[1440px]:p-2.5', stageStyles[stage].border, stageStyles[stage].surface)} aria-labelledby={`crm-stage-${stage}`}>
                        <div className="mb-3 flex items-start justify-between gap-3 px-1 pt-1">
                          <div className="min-w-0"><h2 id={`crm-stage-${stage}`} className="truncate text-sm font-bold uppercase tracking-wide text-text-primary">{stage}</h2><p className="mt-1 truncate text-xs text-text-muted" title={`${formatCurrency(items.reduce((sum, item) => sum + (item.valorEstimado || 0), 0))} · média ${analytics.averageDaysInStage[stage]} dia(s)`}>{formatCurrency(items.reduce((sum, item) => sum + (item.valorEstimado || 0), 0))} · média {analytics.averageDaysInStage[stage]} dia(s)</p></div>
                          <span className={cn('inline-flex min-w-7 items-center justify-center rounded-full px-2 py-1 text-xs font-bold', stageStyles[stage].badge)}>{items.length}</span>
                        </div>
                        <Droppable droppableId={stage}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={cn('min-h-[420px] flex-1 rounded-xl p-1 transition-colors duration-150 min-[1440px]:min-h-[340px]', snapshot.isDraggingOver && 'bg-brand-primary-50/60 dark:bg-brand-primary-500/10')}>
                              {items.map((opportunity, index) => {
                                const overdue = isActiveOpportunityStage(opportunity.estagio) && Boolean(opportunity.proximaAcaoEm && opportunity.proximaAcaoEm < today);
                                const stale = isActiveOpportunityStage(opportunity.estagio) && Date.parse(opportunity.estagioAlteradoEm) < staleLimit;
                                return (
                                  <Draggable key={opportunity.id} draggableId={opportunity.id} index={index} isDragDisabled={boardFiltered}>
                                    {(dragProvided, dragSnapshot) => (
                                      <article ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} style={dragProvided.draggableProps.style} className={cn('group mb-3 min-w-0 rounded-xl border border-brand-border bg-brand-surface p-4 shadow-sm transition-[border-color,box-shadow,transform] duration-150 min-[1440px]:p-3', !boardFiltered && 'hover:-translate-y-0.5 hover:shadow-md', dragSnapshot.isDragging && 'rotate-1 border-brand-primary-400 shadow-xl')}>
                                        <div className="flex items-start justify-between gap-3">
                                          <span className="min-w-0 truncate rounded-full bg-brand-surface-subtle px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-text-secondary" title={`${opportunity.vinculoTipo === 'lead' ? 'Lead' : 'Cliente'}: ${opportunity.clienteNome}`}>{opportunity.vinculoTipo === 'lead' ? 'Lead · ' : ''}{opportunity.clienteNome}</span>
                                          <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums text-brand-primary-700 dark:text-brand-primary-200">{formatPercentage(opportunity.probabilidadePontosBase)}</span>
                                        </div>
                                        <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-text-primary">{opportunity.titulo}</h3>
                                        {opportunity.servicoTipo && <p className="mt-1 truncate text-xs text-text-muted" title={opportunity.servicoTipo}>{opportunity.servicoTipo}</p>}
                                        <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-brand-border pt-3 min-[1440px]:mt-2 min-[1440px]:pt-2">
                                          <span className="font-mono text-xs font-bold tabular-nums text-text-secondary">{formatCurrency(opportunity.valorEstimado)}</span>
                                          {(overdue || stale) && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', overdue ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100')}>{overdue ? 'Ação vencida' : 'Parada'}</span>}
                                        </div>
                                        {opportunity.proximaAcao && <div className="mt-3 rounded-lg bg-brand-surface-subtle p-2.5"><p className="line-clamp-2 text-xs font-medium text-text-secondary">{opportunity.proximaAcao}</p><p className={cn('mt-1 text-[10px]', overdue ? 'font-bold text-rose-600 dark:text-rose-300' : 'text-text-muted')}>{formatDate(opportunity.proximaAcaoEm)}</p></div>}
                                        {!isActiveOpportunityStage(opportunity.estagio) && <div className={cn('mt-3 rounded-lg border p-2.5', opportunity.estagio === 'Ganho' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/20 dark:bg-emerald-500/[0.07]' : 'border-rose-200 bg-rose-50/60 dark:border-rose-400/20 dark:bg-rose-500/[0.07]')}>
                                          <p className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide', opportunity.estagio === 'Ganho' ? 'text-emerald-700 dark:text-emerald-200' : 'text-rose-700 dark:text-rose-200')}>{opportunity.estagio === 'Ganho' ? <Check aria-hidden="true" size={13} /> : <X aria-hidden="true" size={13} />}Encerrada em {formatDate(opportunity.encerradoEm)}</p>
                                          {opportunity.estagio === 'Perdido' && <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-text-secondary" title={opportunity.motivoPerda || 'Motivo não informado'}>{opportunity.motivoPerda || 'Motivo não informado'}</p>}
                                        </div>}
                                        {(opportunity.orcamentoId || opportunity.projetoId) && <div className="mt-3 flex flex-wrap gap-2">{opportunity.orcamentoId && <Link to={`/orcamentos?budgetId=${opportunity.orcamentoId}`} className="geo-focus-ring inline-flex items-center gap-1 rounded-md text-[10px] font-semibold text-brand-primary-700 hover:underline dark:text-brand-primary-200"><FileText aria-hidden="true" size={13} />{opportunity.orcamentoCodigo || 'Orçamento'}</Link>}{opportunity.projetoId && <Link to={`/projetos/${opportunity.projetoId}`} className="geo-focus-ring inline-flex items-center gap-1 rounded-md text-[10px] font-semibold text-emerald-700 hover:underline dark:text-emerald-200"><Eye aria-hidden="true" size={13} />Projeto</Link>}</div>}
                                        {opportunity.estagio === 'Ganho' && !opportunity.projetoId && <button type="button" title="Criar projeto a partir desta oportunidade" onClick={() => convertProjectMutation.mutate(opportunity)} className="geo-focus-ring mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20 dark:hover:bg-emerald-500/15">Criar projeto</button>}
                                        {isActiveOpportunityStage(opportunity.estagio) && !opportunity.orcamentoId && opportunity.clienteId && <button type="button" title="Criar orçamento para esta oportunidade" onClick={() => navigate('/orcamentos', { state: { createForClienteId: opportunity.clienteId, opportunityId: opportunity.id } })} className="geo-focus-ring mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-brand-surface-subtle px-3 text-[11px] font-bold text-brand-primary-700 ring-1 ring-brand-border hover:bg-brand-primary-50 dark:text-brand-primary-200 dark:hover:bg-brand-primary-500/10">Criar orçamento</button>}
                                        {isActiveOpportunityStage(opportunity.estagio) && !opportunity.clienteId && <Link to="/crm?view=leads&status=ativo" className="geo-focus-ring mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-amber-50 px-3 text-center text-[11px] font-bold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-400/20">Converter lead para avançar</Link>}
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-1 border-t border-brand-border pt-3 min-[1440px]:mt-2 min-[1440px]:pt-2">
                                          <div className="flex items-center gap-0.5" aria-label="Movimentação da oportunidade">
                                            {activeStages.includes(opportunity.estagio) && opportunity.estagio !== 'Prospectado' && <button type="button" title="Mover para a etapa anterior" onClick={() => moveActiveStage(opportunity, 'left')} className="geo-focus-ring rounded-lg p-2 text-text-muted hover:bg-brand-surface-subtle hover:text-text-primary" aria-label={`Mover ${opportunity.titulo} para a etapa anterior`}><CaretLeft aria-hidden="true" size={16} /></button>}
                                            {activeStages.includes(opportunity.estagio) && opportunity.estagio !== 'Proposta' && <button type="button" title="Mover para a próxima etapa" onClick={() => moveActiveStage(opportunity, 'right')} className="geo-focus-ring rounded-lg p-2 text-text-muted hover:bg-brand-surface-subtle hover:text-text-primary" aria-label={`Mover ${opportunity.titulo} para a próxima etapa`}><CaretRight aria-hidden="true" size={16} /></button>}
                                            {isActiveOpportunityStage(opportunity.estagio) && opportunity.clienteId && <button type="button" title="Marcar como ganha" onClick={() => { setPendingOutcome({ opportunity, stage: 'Ganho' }); setOutcomeReason(''); }} className="geo-focus-ring rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10" aria-label={`Marcar ${opportunity.titulo} como ganho`}><Check aria-hidden="true" size={16} /></button>}
                                            {isActiveOpportunityStage(opportunity.estagio) && <button type="button" title="Marcar como perdida" onClick={() => { setPendingOutcome({ opportunity, stage: 'Perdido' }); setOutcomeReason(''); }} className="geo-focus-ring rounded-lg p-2 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10" aria-label={`Marcar ${opportunity.titulo} como perdido`}><X aria-hidden="true" size={16} /></button>}
                                            {!isActiveOpportunityStage(opportunity.estagio) && <button type="button" title="Reabrir em Proposta" onClick={() => transitionMutation.mutate({ id: opportunity.id, stage: 'Proposta', reason: 'Oportunidade reaberta' })} className="geo-focus-ring rounded-lg p-2 text-text-muted hover:bg-brand-surface-subtle hover:text-text-primary" aria-label={`Reabrir ${opportunity.titulo} em Proposta`}><ArrowCounterClockwise aria-hidden="true" size={16} /></button>}
                                          </div>
                                          <div className="flex items-center gap-0.5 opacity-65 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100" aria-label="Ações complementares">
                                            <button type="button" title="Ver histórico" onClick={() => setHistoryTarget(opportunity)} className="geo-focus-ring rounded-lg p-2 text-text-muted hover:bg-brand-surface-subtle hover:text-text-primary" aria-label={`Ver histórico de ${opportunity.titulo}`}><ClockCounterClockwise aria-hidden="true" size={16} /></button>
                                            <button type="button" title="Editar oportunidade" onClick={() => openEdit(opportunity)} className="geo-focus-ring rounded-lg p-2 text-text-muted hover:bg-brand-surface-subtle hover:text-brand-primary-700 dark:hover:text-brand-primary-200" aria-label={`Editar ${opportunity.titulo}`}><PencilSimple aria-hidden="true" size={16} /></button>
                                            <button type="button" title="Excluir oportunidade" onClick={() => setDeleteTarget(opportunity)} className="geo-focus-ring rounded-lg p-2 text-text-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-300" aria-label={`Excluir ${opportunity.titulo}`}><Trash aria-hidden="true" size={16} /></button>
                                          </div>
                                        </div>
                                      </article>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {!items.length && <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-brand-border px-4 text-center text-xs text-text-muted">Nenhuma oportunidade nesta etapa</div>}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </section>
                    );
                  })}
                </div>
              </DragDropContext>
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-zinc-50 via-zinc-50/75 to-transparent dark:from-[#121215] dark:via-[#121215]/75 min-[1440px]:hidden" />
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => !saveMutation.isPending && setShowModal(false)} title={selectedOpportunity ? 'Editar oportunidade' : 'Nova oportunidade'} maxWidth="max-w-4xl" initialFocusId="crm-client">
        <form onSubmit={handleFormSubmit} className="space-y-5" noValidate>
          <FormError message={formError} />
          <FormSection
            sectionId="crm-section-identification"
            title="Identificação comercial"
            description="Cliente, serviço, valor e responsável pela negociação."
            icon={<Handshake className="h-5 w-5" weight="duotone" />}
            tone="indigo"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField htmlFor="crm-client" label="Cliente ou lead" required error={formErrors.subject} hint="Digite para buscar e selecione uma opção identificada como Cliente ou Lead.">
                <input
                  id="crm-client"
                  name="vinculoComercial"
                  type="text"
                  list="crm-subject-options"
                  required
                  autoComplete="off"
                  value={subjectSearch}
                  onChange={(event) => handleSubjectChange(event.target.value)}
                  placeholder="Buscar cliente ou lead…"
                  aria-invalid={Boolean(formErrors.subject)}
                  aria-describedby={formErrors.subject ? 'crm-client-error' : 'crm-client-hint'}
                  className={fieldClass}
                />
                <datalist id="crm-subject-options">
                  {commercialSubjectOptions.map((option) => <option key={`${option.type}:${option.id}`} value={option.label} />)}
                </datalist>
              </FormField>
              <FormField htmlFor="crm-title" label="Título do negócio" required error={formErrors.titulo}>
                <input id="crm-title" name="titulo" required autoComplete="off" maxLength={200} value={form.titulo} onChange={(event) => updateFormField('titulo', event.target.value)} placeholder="Ex.: Georreferenciamento Fazenda Boa Vista" aria-invalid={Boolean(formErrors.titulo)} aria-describedby={formErrors.titulo ? 'crm-title-error' : undefined} className={fieldClass} />
              </FormField>
              <FormField htmlFor="crm-service" label="Serviço de interesse" hint="Selecione uma sugestão ou informe outro serviço.">
                <input id="crm-service" name="servicoTipo" list="crm-service-options" autoComplete="off" maxLength={160} value={form.servicoTipo} onChange={(event) => updateFormField('servicoTipo', event.target.value)} placeholder="Ex.: Georreferenciamento rural" aria-describedby="crm-service-hint" className={fieldClass} />
                <datalist id="crm-service-options">{serviceSuggestions.map((service) => <option key={service} value={service} />)}</datalist>
              </FormField>
              <FormField htmlFor="crm-owner" label="Responsável comercial" hint={responsibleOptions.length ? 'Selecione um responsável já utilizado ou informe outro nome.' : 'Informe quem conduzirá a negociação.'}>
                <input id="crm-owner" name="responsavel" list="crm-owner-options" autoComplete="off" maxLength={120} value={form.responsavel} onChange={(event) => updateFormField('responsavel', event.target.value)} placeholder="Nome do responsável" aria-describedby="crm-owner-hint" className={fieldClass} />
                <datalist id="crm-owner-options">{responsibleOptions.map((responsible) => <option key={responsible} value={responsible} />)}</datalist>
              </FormField>
              <FormField htmlFor="crm-source" label="Origem" hint="Selecione uma sugestão ou descreva outro canal.">
                <input id="crm-source" name="origem" list="crm-source-options" autoComplete="off" maxLength={120} value={form.origem} onChange={(event) => updateFormField('origem', event.target.value)} placeholder="Indicação, site, evento…" aria-describedby="crm-source-hint" className={fieldClass} />
                <datalist id="crm-source-options">{CLIENT_ORIGIN_OPTIONS.map((origin) => <option key={origin} value={origin} />)}</datalist>
              </FormField>
              <FormField htmlFor="crm-value" label="Valor estimado" error={formErrors.valorEstimado}>
                <div className="relative">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-muted">R$</span>
                  <input id="crm-value" name="valorEstimado" type="text" inputMode="decimal" value={form.valorEstimado} onChange={(event) => updateFormField('valorEstimado', event.target.value)} onBlur={() => updateFormField('valorEstimado', formatCurrencyInput(form.valorEstimado))} placeholder="0,00" aria-invalid={Boolean(formErrors.valorEstimado)} aria-describedby={formErrors.valorEstimado ? 'crm-value-error' : undefined} className={cn(fieldClass, 'pl-11 font-mono tabular-nums')} />
                </div>
              </FormField>
              <FormField htmlFor="crm-probability" label="Probabilidade de ganho" error={formErrors.probabilidade}>
                <div className="relative">
                  <input id="crm-probability" name="probabilidade" type="number" min="0" max="100" step="1" inputMode="numeric" value={form.probabilidade} onChange={(event) => updateFormField('probabilidade', event.target.value)} aria-invalid={Boolean(formErrors.probabilidade)} aria-describedby={formErrors.probabilidade ? 'crm-probability-error' : undefined} className={cn(fieldClass, 'pr-10 font-mono tabular-nums')} />
                  <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-muted">%</span>
                </div>
              </FormField>
              <FormField htmlFor="crm-forecast" label="Previsão de fechamento">
                <DatePickerField id="crm-forecast" name="previsaoFechamento" autoComplete="off" value={form.previsaoFechamento} onChange={(event) => updateFormField('previsaoFechamento', event.target.value)} className={fieldClass} />
              </FormField>
            </div>
          </FormSection>
          <FormSection
            sectionId="crm-section-follow-up"
            title="Acompanhamento"
            description="Defina claramente o próximo passo para evitar oportunidades paradas."
            icon={<CalendarCheck className="h-5 w-5" weight="duotone" />}
            tone="emerald"
            className="mb-16"
          >
            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)]">
              <FormField htmlFor="crm-next-action" label="Próxima ação" required={Boolean(form.proximaAcaoEm)} error={formErrors.proximaAcao}>
                <input id="crm-next-action" name="proximaAcao" autoComplete="off" maxLength={240} value={form.proximaAcao} onChange={(event) => updateFormField('proximaAcao', event.target.value)} placeholder="Ex.: Enviar escopo revisado ao cliente" aria-invalid={Boolean(formErrors.proximaAcao)} aria-describedby={formErrors.proximaAcao ? 'crm-next-action-error' : undefined} className={fieldClass} />
              </FormField>
              <FormField htmlFor="crm-next-action-date" label="Data da próxima ação" required={Boolean(form.proximaAcao.trim())} error={formErrors.proximaAcaoEm}>
                <DatePickerField id="crm-next-action-date" name="proximaAcaoEm" autoComplete="off" min={selectedOpportunity?.proximaAcaoEm === form.proximaAcaoEm ? undefined : new Date().toISOString().slice(0, 10)} value={form.proximaAcaoEm} onChange={(event) => updateFormField('proximaAcaoEm', event.target.value)} aria-invalid={Boolean(formErrors.proximaAcaoEm)} aria-describedby={formErrors.proximaAcaoEm ? 'crm-next-action-date-error' : undefined} className={fieldClass} />
              </FormField>
            </div>
            <FormField htmlFor="crm-budget" label="Orçamento relacionado" hint={form.leadId ? 'Orçamentos pertencem a clientes. Converta o lead para habilitar este vínculo.' : form.clienteId && !selectedBudgets.length ? 'Este cliente ainda não possui orçamentos disponíveis.' : 'Somente orçamentos do cliente selecionado são exibidos.'}>
              <FormSelect id="crm-budget" name="orcamentoId" disabled={!form.clienteId} value={form.orcamentoId} onChange={(event) => updateFormField('orcamentoId', event.target.value)} aria-describedby="crm-budget-hint" className={cn(fieldClass, 'geo-native-select cursor-pointer disabled:cursor-not-allowed disabled:opacity-60')}>
                <option value="">{form.clienteId ? 'Sem orçamento vinculado' : form.leadId ? 'Disponível após a conversão do lead' : 'Selecione primeiro um cliente'}</option>
                {selectedBudgets.map((budget) => <option key={budget.id} value={budget.id}>{budget.code || 'Rascunho'} v{budget.version} · {budget.status} · {formatCurrency(budget.totalCents)}</option>)}
              </FormSelect>
            </FormField>
            <FormField htmlFor="crm-notes" label="Observações" hint={`${form.observacoes.length}/4.000 caracteres`}>
              <textarea id="crm-notes" name="observacoes" rows={4} maxLength={4000} value={form.observacoes} onChange={(event) => updateFormField('observacoes', event.target.value)} aria-describedby="crm-notes-hint" className={cn(fieldClass, 'min-h-28 resize-y py-3 leading-relaxed')} />
            </FormField>
          </FormSection>
          <FormFooter className="flex-wrap"><button type="button" onClick={() => setShowModal(false)} disabled={saveMutation.isPending} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-5">Cancelar</button><button type="submit" disabled={saveMutation.isPending} className={cn(primarySubmitButtonClass, 'min-h-11 px-6 disabled:opacity-50')}>{saveMutation.isPending ? 'Salvando…' : 'Salvar oportunidade'}</button></FormFooter>
        </form>
      </Modal>

      <Modal isOpen={Boolean(pendingOutcome)} onClose={() => !transitionMutation.isPending && setPendingOutcome(null)} title={pendingOutcome?.stage === 'Ganho' ? 'Confirmar oportunidade ganha' : 'Registrar oportunidade perdida'} maxWidth="max-w-lg">
        <div className="space-y-5">
          <p className="text-sm leading-6 text-text-secondary">{pendingOutcome?.stage === 'Ganho' ? 'A oportunidade será encerrada como ganha. Se existir um orçamento vinculado, ele precisa estar aprovado.' : 'A oportunidade será encerrada como perdida. O motivo ficará registrado no histórico comercial.'}</p>
          <FormField htmlFor="crm-outcome-reason" label={pendingOutcome?.stage === 'Perdido' ? 'Motivo da perda' : 'Observação (opcional)'}><textarea id="crm-outcome-reason" rows={4} value={outcomeReason} onChange={(event) => setOutcomeReason(event.target.value)} className={cn(fieldClass, 'resize-y py-3')} /></FormField>
          <FormFooter><button type="button" onClick={() => setPendingOutcome(null)} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-5">Cancelar</button><button type="button" onClick={confirmOutcome} disabled={transitionMutation.isPending} className={cn(primarySubmitButtonClass, 'min-h-11 px-6')}>{transitionMutation.isPending ? 'Salvando…' : pendingOutcome?.stage === 'Ganho' ? 'Confirmar ganho' : 'Registrar perda'}</button></FormFooter>
        </div>
      </Modal>

      <Modal isOpen={Boolean(historyTarget)} onClose={() => setHistoryTarget(null)} title="Histórico da oportunidade" maxWidth="max-w-2xl">
        <div className="space-y-5">
          <div className="rounded-xl border border-brand-border bg-brand-surface-subtle p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">{historyTarget?.clienteNome}</p>
            <h3 className="mt-1 text-base font-semibold text-text-primary">{historyTarget?.titulo}</h3>
          </div>
          {historyQuery.isLoading ? (
            <div className="space-y-3" aria-label="Carregando histórico"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div>
          ) : historyQuery.isError ? (
            <div><FormError message={historyQuery.error instanceof Error ? historyQuery.error.message : 'Não foi possível carregar o histórico.'} /><button type="button" onClick={() => historyQuery.refetch()} className="geo-button-base geo-button-secondary geo-focus-ring mt-4 min-h-10 px-4">Tentar novamente</button></div>
          ) : (
            <ol className="space-y-3" aria-label="Alterações de etapa">
              {(historyQuery.data?.history || []).slice().reverse().map((item) => (
                <li key={item.id} className="relative rounded-xl border border-brand-border bg-brand-surface p-4 pl-12">
                  <span className="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-brand-surface-subtle text-brand-primary-700 ring-1 ring-brand-border dark:text-brand-primary-200"><ClockCounterClockwise aria-hidden="true" size={14} /></span>
                  <p className="text-sm font-semibold text-text-primary">{item.estagioAnterior ? `${item.estagioAnterior} → ${item.estagioNovo}` : `Oportunidade criada em ${item.estagioNovo}`}</p>
                  {item.motivo && <p className="mt-1 break-words text-sm leading-6 text-text-secondary">{item.motivo}</p>}
                  <p className="mt-2 text-xs text-text-muted">{formatDateTime(item.createdAt)}</p>
                </li>
              ))}
              {!historyQuery.data?.history.length && <li className="rounded-xl border border-dashed border-brand-border p-6 text-center text-sm text-text-muted">Nenhuma alteração de etapa registrada.</li>}
            </ol>
          )}
          <FormFooter><button type="button" onClick={() => setHistoryTarget(null)} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-5">Fechar</button></FormFooter>
        </div>
      </Modal>

      <ConfirmDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }} title="Excluir oportunidade" description={`A oportunidade “${deleteTarget?.titulo || ''}” será removida do funil, preservando os registros relacionados já existentes.`} confirmText={deleteMutation.isPending ? 'Excluindo…' : 'Excluir oportunidade'} loading={deleteMutation.isPending} />
    </Layout>
  );
}
