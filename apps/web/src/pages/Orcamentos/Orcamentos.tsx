import { DatePickerField, FormSelect } from '../../components/Form';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowsLeftRight,
  ChartLineUp,
  Copy,
  Eye,
  FilePdf,
  FileText,
  Funnel,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  X
} from '@phosphor-icons/react';
import { BUDGET_STATUSES, BUDGET_STATUS_LABELS, SERVICE_TYPES, type BudgetStatus } from '@geogestor/contracts';
import { Layout } from '../../components/Layout';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Skeleton } from '../../components/Skeleton';
import { apiClient } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass, primaryActionIconClass } from '../../utils/actionStyles';
import { geoFieldClass, geoKickerClass } from '../../utils/geoTheme';
import { BudgetEditor } from './BudgetEditor';
import { BudgetDetails } from './BudgetDetails';
import { currencyInputToCents, formatBasisPoints, formatCurrency, formatDate } from './budgetForm';
import { generateProfessionalBudgetPdf } from './budgetPdfGenerator';
import type { BudgetDetail, BudgetKpis, BudgetListItem, BudgetOptions } from './types';

const fieldClass = cn(geoFieldClass, 'min-h-11 w-full px-3 text-sm');
const iconButtonClass = 'geo-focus-ring inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-zinc-600 transition-[background-color,color,transform] duration-150 hover:bg-brand-surface-subtle hover:text-zinc-950 active:scale-[0.97] dark:text-zinc-300 dark:hover:text-white';

const emptyKpis: BudgetKpis = {
  total: 0,
  counts: Object.fromEntries(BUDGET_STATUSES.map((status) => [status, 0])) as Record<BudgetStatus, number>,
  viewed: 0,
  totalBudgetedCents: 0,
  totalApprovedCents: 0,
  averageApprovedTicketCents: 0,
  conversionBasisPoints: 0,
  estimatedTaxesCents: 0,
  estimatedNetFeesCents: 0,
  accountsReceivableCents: 0,
  receivedCents: 0,
  conversionByService: []
};

const emptyOptions: BudgetOptions = {
  clients: [], projects: [], properties: [], taxProfiles: [], templates: [], pricingParameters: []
};

const statusTone: Record<BudgetStatus, string> = {
  rascunho: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  emitido: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200',
  enviado: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-200',
  em_negociacao: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100',
  aprovado: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-100',
  rejeitado: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-100',
  expirado: 'bg-orange-50 text-orange-800 dark:bg-orange-500/10 dark:text-orange-100',
  cancelado: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  substituido: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-100'
};

function budgetQuery(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  params.delete('budgetId');
  return params.toString();
}

function budgetStatusQuery(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  params.delete('budgetId');
  params.delete('status');
  return params.toString();
}

function centsParamToReais(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return '';
  const cents = BigInt(value);
  const fraction = String(cents % 100n).padStart(2, '0').replace(/0+$/, '');
  return `${cents / 100n}${fraction ? `.${fraction}` : ''}`;
}

export function Orcamentos() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryString = budgetQuery(searchParams);
  const statusQueryString = budgetStatusQuery(searchParams);
  const selectedId = searchParams.get('budgetId');
  const creationContext = location.state as { createForClienteId?: string; opportunityId?: string; openCreateModal?: boolean } | null;
  const initialClientId = creationContext?.createForClienteId;
  const opportunityId = creationContext?.opportunityId;
  const [editorOpen, setEditorOpen] = useState(Boolean(initialClientId || creationContext?.openCreateModal));
  const [editingBudget, setEditingBudget] = useState<BudgetDetail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetListItem | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<BudgetListItem[]>({
    queryKey: ['budgets', queryString],
    queryFn: () => apiClient.get(`/api/orcamentos${queryString ? `?${queryString}` : ''}`)
  });
  const { data: kpis = emptyKpis, isLoading: kpisLoading } = useQuery<BudgetKpis>({
    queryKey: ['budget-kpis', queryString],
    queryFn: () => apiClient.get(`/api/orcamentos/kpis${queryString ? `?${queryString}` : ''}`)
  });
  const { data: statusKpis = emptyKpis } = useQuery<BudgetKpis>({
    queryKey: ['budget-status-kpis', statusQueryString],
    queryFn: () => apiClient.get(`/api/orcamentos/kpis${statusQueryString ? `?${statusQueryString}` : ''}`)
  });
  const { data: options = emptyOptions } = useQuery<BudgetOptions>({
    queryKey: ['budget-options'],
    queryFn: () => apiClient.get('/api/orcamentos/options')
  });
  const { data: selectedDetail = null } = useQuery<BudgetDetail | null>({
    queryKey: ['budget-detail', selectedId],
    queryFn: () => selectedId ? apiClient.get(`/api/orcamentos/${selectedId}`) : Promise.resolve(null),
    enabled: Boolean(selectedId)
  });

  const updateFilter = (key: string, value: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('budgetId');
      return next;
    }, { replace: true });
  };

  const clearFilters = () => setSearchParams(new URLSearchParams(), { replace: true });
  const openDetail = (budget: { id: string }) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.set('budgetId', budget.id);
    return next;
  });
  const closeDetail = () => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    next.delete('budgetId');
    return next;
  }, { replace: true });

  const handleBudgetSaved = async (saved: BudgetDetail) => {
    setEditorOpen(false);
    setEditingBudget(null);
    queryClient.setQueryData(['budget-detail', saved.id], saved);
    if (opportunityId) {
      try {
        await apiClient.post(`/api/oportunidades/${opportunityId}/link-budget`, { orcamentoId: saved.id });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
          queryClient.invalidateQueries({ queryKey: ['opportunity-analytics'] })
        ]);
        toast.success('Or\u00e7amento vinculado \u00e0 oportunidade e etapa atualizada para Proposta.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'O or\u00e7amento foi salvo, mas n\u00e3o foi poss\u00edvel vincul\u00e1-lo \u00e0 oportunidade.');
      }
    }
    openDetail(saved);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/orcamentos/${id}`),
    onSuccess: async () => {
      setDeleteTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['budget-kpis'] }),
        queryClient.invalidateQueries({ queryKey: ['budget-status-kpis'] })
      ]);
      toast.success('Rascunho exclu\u00eddo.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'N\u00e3o foi poss\u00edvel excluir o rascunho.')
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<BudgetDetail>(`/api/orcamentos/${id}/duplicate`),
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['budgets'] }),
        queryClient.invalidateQueries({ queryKey: ['budget-kpis'] }),
        queryClient.invalidateQueries({ queryKey: ['budget-status-kpis'] })
      ]);
      openDetail(created);
      toast.success('C\u00f3pia criada em rascunho.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'N\u00e3o foi poss\u00edvel duplicar o or\u00e7amento.')
  });

  const generatePdf = async (id: string) => {
    try {
      const detail = await apiClient.get<BudgetDetail>(`/api/orcamentos/${id}`);
      generateProfessionalBudgetPdf(detail);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'N\u00e3o foi poss\u00edvel gerar o documento.');
    }
  };

  const hasFilters = useMemo(() => Array.from(searchParams.keys()).some((key) => key !== 'budgetId'), [searchParams]);
  const activeFilters = useMemo(() => {
    const labels: Record<string, string> = {
      query: 'Busca',
      clientId: 'Cliente',
      serviceType: 'Servi\u00e7o',
      municipality: 'Munic\u00edpio',
      property: 'Im\u00f3vel',
      technicalLead: 'Respons\u00e1vel',
      propertyType: 'Tipo de im\u00f3vel',
      linkedProject: 'Projeto',
      issueFrom: 'Emiss\u00e3o desde',
      issueTo: 'Emiss\u00e3o at\u00e9',
      validFrom: 'Validade desde',
      validTo: 'Validade at\u00e9',
      minValueCents: 'Valor m\u00ednimo',
      maxValueCents: 'Valor m\u00e1ximo'
    };

    return Array.from(searchParams.entries())
      .filter(([key]) => key !== 'budgetId' && key !== 'status')
      .map(([key, rawValue]) => {
        let value = rawValue;
        if (key === 'clientId') value = options.clients.find((client) => client.id === rawValue)?.name || rawValue;
        if (key === 'propertyType') value = rawValue === 'rural' ? 'Rural' : rawValue === 'urbano' ? 'Urbano' : rawValue;
        if (key === 'linkedProject') value = rawValue === 'sim' ? 'Vinculado' : rawValue === 'nao' ? 'Sem projeto' : rawValue;
        if (key === 'minValueCents' || key === 'maxValueCents') value = formatCurrency(Number(rawValue));
        return { key, label: labels[key] || key, value };
      });
  }, [options.clients, searchParams]);

  const selectedStatus = searchParams.get('status') || '';
  const primaryIndicators = [
    {
      label: 'Valor aprovado',
      value: formatCurrency(kpis.totalApprovedCents),
      description: 'Soma somente das vers\u00f5es aprovadas vigentes, sem vers\u00f5es substitu\u00eddas.'
    },
    {
      label: 'Recebido',
      value: formatCurrency(kpis.receivedCents),
      description: 'Valores efetivamente liquidados nas parcelas. Esta \u00e9 a fonte de caixa realizado.'
    },
    {
      label: 'A receber',
      value: formatCurrency(kpis.accountsReceivableCents),
      description: 'Saldo das parcelas abertas geradas por aprova\u00e7\u00f5es. N\u00e3o representa receita recebida.'
    },
    {
      label: 'Taxa de convers\u00e3o',
      value: formatBasisPoints(kpis.conversionBasisPoints),
      description: 'Aprova\u00e7\u00f5es divididas pelos or\u00e7amentos eleg\u00edveis encerrados.'
    }
  ];
  const analysisMetrics = [
    ['Total or\u00e7ado', formatCurrency(kpis.totalBudgetedCents)],
    ['Honor\u00e1rios l\u00edquidos', formatCurrency(kpis.estimatedNetFeesCents)],
    ['Impostos previstos', formatCurrency(kpis.estimatedTaxesCents)],
    ['Ticket m\u00e9dio aprovado', formatCurrency(kpis.averageApprovedTicketCents)],
    ['Total de or\u00e7amentos', String(kpis.total)],
    ['Visualizados', String(kpis.viewed)]
  ];

  return (
    <Layout contentClassName="min-w-0 max-w-[1600px]">
      <div className="min-w-0 max-w-full space-y-7">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className={cn(geoKickerClass, 'mb-3')}>Comercial e precifica&ccedil;&atilde;o</span>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">Or&ccedil;amentos</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-text-secondary sm:text-base">Crie propostas t&eacute;cnicas, preserve vers&otilde;es e transforme aprova&ccedil;&otilde;es em projetos e contas a receber rastre&aacute;veis.</p>
          </div>
          <button type="button" onClick={() => { setEditingBudget(null); setEditorOpen(true); }} className={primaryActionButtonClass}><span className={primaryActionIconClass}><Plus aria-hidden="true" size={18} weight="bold" /></span>Novo or&ccedil;amento</button>
        </header>

        <div>
          <section aria-labelledby="budget-pulse-title" className="border-y border-brand-border bg-brand-surface-subtle/25">
            <div className="flex flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-brand-green-500 shadow-[0_0_0_4px_rgba(16,185,129,0.10)]" />
                <h2 id="budget-pulse-title" className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Pulso comercial</h2>
              </div>
              <button type="button" aria-expanded={showAnalysis} aria-controls="budget-commercial-analysis" onClick={() => setShowAnalysis((value) => !value)} className="geo-button-base geo-button-secondary geo-focus-ring min-h-9 max-w-full px-3 text-xs">
                <ChartLineUp aria-hidden="true" size={16} />
                {showAnalysis ? 'Ocultar an\u00e1lise' : 'Abrir an\u00e1lise comercial'}
              </button>
            </div>
            {kpisLoading ? <Skeleton className="mx-4 mb-4 h-20 sm:mx-5" /> : (
              <div className="overflow-x-auto overscroll-x-contain">
                <dl className="grid min-w-[720px] grid-cols-4 divide-x divide-brand-border border-t border-brand-border">
                  {primaryIndicators.map((indicator) => (
                    <div key={indicator.label} title={indicator.description} className="min-w-0 px-5 py-4 lg:px-7">
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{indicator.label}<span className="sr-only">. {indicator.description}</span></dt>
                      <dd className="mt-1.5 truncate font-mono text-xl font-bold tracking-tight tabular-nums text-text-primary lg:text-2xl">{indicator.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </section>

          {showAnalysis && (
            <section id="budget-commercial-analysis" aria-labelledby="budget-commercial-analysis-title" className="border-b border-brand-border bg-brand-surface-subtle/45 px-4 py-5 sm:px-5">
              <div className="grid gap-7 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                <div>
                  <h2 id="budget-commercial-analysis-title" className="text-sm font-semibold text-text-primary">An&aacute;lise comercial</h2>
                  <p className="mt-1 text-xs text-text-muted">Leitura financeira e operacional da sele&ccedil;&atilde;o atual.</p>
                  <dl className="mt-4 divide-y divide-brand-border border-y border-brand-border">
                    {analysisMetrics.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-5 py-2.5 text-sm">
                        <dt className="text-text-secondary">{label}</dt>
                        <dd className="font-mono font-bold tabular-nums text-text-primary">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">Convers&atilde;o por servi&ccedil;o</h3>
                  <p className="mt-1 text-xs text-text-muted">Aprovados sobre propostas eleg&iacute;veis encerradas.</p>
                  {kpis.conversionByService.length ? (
                    <div className="mt-4 overflow-x-auto overscroll-contain border-y border-brand-border">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="text-[10px] uppercase tracking-[0.14em] text-text-muted"><tr><th className="py-2.5 pr-4">Servi&ccedil;o</th><th className="px-4 py-2.5 text-right">Aprovados</th><th className="px-4 py-2.5 text-right">Encerrados</th><th className="py-2.5 pl-4 text-right">Convers&atilde;o</th></tr></thead>
                        <tbody className="divide-y divide-brand-border">{kpis.conversionByService.map((item) => <tr key={item.serviceType}><td className="max-w-80 truncate py-2.5 pr-4 font-semibold text-text-primary">{item.serviceType}</td><td className="px-4 py-2.5 text-right font-mono tabular-nums text-text-secondary">{item.approved}</td><td className="px-4 py-2.5 text-right font-mono tabular-nums text-text-secondary">{item.eligible}</td><td className="py-2.5 pl-4 text-right font-mono font-bold tabular-nums text-brand-green-700 dark:text-brand-green-100">{formatBasisPoints(item.conversionBasisPoints)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  ) : <p className="mt-4 border-y border-dashed border-brand-border py-6 text-center text-sm text-text-muted">Ainda n&atilde;o h&aacute; propostas encerradas suficientes para esta leitura.</p>}
                </div>
              </div>
            </section>
          )}
        </div>

        <section aria-labelledby="budget-list-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="budget-list-title" className="text-lg font-semibold text-text-primary">Propostas comerciais</h2>
              <p className="mt-1 text-sm text-text-muted">Localize, compare e conduza cada proposta.</p>
            </div>
            <span className="inline-flex min-h-8 items-center rounded-full border border-brand-border bg-brand-surface-subtle px-3 font-mono text-xs font-semibold tabular-nums text-text-secondary" aria-live="polite">
              {budgets.length} {budgets.length === 1 ? 'or\u00e7amento exibido' : 'or\u00e7amentos exibidos'}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,2fr)_minmax(190px,1fr)_minmax(210px,1fr)_auto_auto]">
            <label className="relative md:col-span-2 xl:col-span-1"><span className="sr-only">Buscar por n&uacute;mero, cliente, im&oacute;vel ou descri&ccedil;&atilde;o</span><MagnifyingGlass aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-3.5 text-text-muted" /><input name="query" type="search" autoComplete="off" value={searchParams.get('query') || ''} onChange={(event) => updateFilter('query', event.target.value)} placeholder="N&uacute;mero, cliente, im&oacute;vel&hellip;" className={cn(fieldClass, 'pl-10')} /></label>
            <label><span className="sr-only">Filtrar por cliente</span><FormSelect aria-label="Filtrar por cliente" value={searchParams.get('clientId') || ''} onChange={(event) => updateFilter('clientId', event.target.value)} className={fieldClass}><option value="">Todos os clientes</option>{options.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</FormSelect></label>
            <label><span className="sr-only">Filtrar por tipo de servi&ccedil;o</span><FormSelect aria-label="Filtrar por tipo de servi&ccedil;o" value={searchParams.get('serviceType') || ''} onChange={(event) => updateFilter('serviceType', event.target.value)} className={fieldClass}><option value="">Todos os servi&ccedil;os</option>{SERVICE_TYPES.map((type) => <option key={type}>{type}</option>)}</FormSelect></label>
            <button type="button" aria-expanded={showAdvancedFilters} aria-controls="budget-advanced-filters" onClick={() => setShowAdvancedFilters((value) => !value)} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 text-xs"><Funnel aria-hidden="true" size={17} />{showAdvancedFilters ? 'Ocultar filtros' : 'Mais filtros'}</button>
            {hasFilters && <button type="button" onClick={clearFilters} className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4 text-xs">Limpar filtros</button>}
          </div>

          {showAdvancedFilters && <fieldset id="budget-advanced-filters" className="mt-4 grid gap-4 border-y border-brand-border bg-brand-surface-subtle/35 px-4 py-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"><legend className="sr-only">Filtros avan&ccedil;ados</legend>
            <input aria-label="Filtrar por munic&iacute;pio" value={searchParams.get('municipality') || ''} onChange={(event) => updateFilter('municipality', event.target.value)} placeholder="Munic&iacute;pio" className={fieldClass} />
            <input aria-label="Filtrar por im&oacute;vel" value={searchParams.get('property') || ''} onChange={(event) => updateFilter('property', event.target.value)} placeholder="Im&oacute;vel" className={fieldClass} />
            <input aria-label="Filtrar por respons&aacute;vel t&eacute;cnico" value={searchParams.get('technicalLead') || ''} onChange={(event) => updateFilter('technicalLead', event.target.value)} placeholder="Respons&aacute;vel t&eacute;cnico" className={fieldClass} />
            <FormSelect aria-label="Filtrar rural ou urbano" value={searchParams.get('propertyType') || ''} onChange={(event) => updateFilter('propertyType', event.target.value)} className={fieldClass}><option value="">Rural e urbano</option><option value="rural">Rural</option><option value="urbano">Urbano</option></FormSelect>
            <FormSelect aria-label="Filtrar v&iacute;nculo com projeto" value={searchParams.get('linkedProject') || ''} onChange={(event) => updateFilter('linkedProject', event.target.value)} className={fieldClass}><option value="">Com ou sem projeto</option><option value="sim">Vinculado a projeto</option><option value="nao">Sem projeto</option></FormSelect>
            <label className="text-xs text-text-muted">Emiss&atilde;o inicial<DatePickerField aria-label="Emiss&atilde;o inicial" value={searchParams.get('issueFrom') || ''} onChange={(event) => updateFilter('issueFrom', event.target.value)} className={cn(fieldClass, 'mt-1')} /></label>
            <label className="text-xs text-text-muted">Emiss&atilde;o final<DatePickerField aria-label="Emiss&atilde;o final" value={searchParams.get('issueTo') || ''} onChange={(event) => updateFilter('issueTo', event.target.value)} className={cn(fieldClass, 'mt-1')} /></label>
            <label className="text-xs text-text-muted">Validade inicial<DatePickerField aria-label="Validade inicial" value={searchParams.get('validFrom') || ''} onChange={(event) => updateFilter('validFrom', event.target.value)} className={cn(fieldClass, 'mt-1')} /></label>
            <label className="text-xs text-text-muted">Validade final<DatePickerField aria-label="Validade final" value={searchParams.get('validTo') || ''} onChange={(event) => updateFilter('validTo', event.target.value)} className={cn(fieldClass, 'mt-1')} /></label>
            <input aria-label="Valor m&iacute;nimo em reais" type="number" min="0" step="0.01" inputMode="decimal" value={centsParamToReais(searchParams.get('minValueCents'))} onChange={(event) => updateFilter('minValueCents', event.target.value ? String(currencyInputToCents(event.target.value)) : '')} placeholder="Valor m&iacute;nimo (R$)" className={fieldClass} />
            <input aria-label="Valor m&aacute;ximo em reais" type="number" min="0" step="0.01" inputMode="decimal" value={centsParamToReais(searchParams.get('maxValueCents'))} onChange={(event) => updateFilter('maxValueCents', event.target.value ? String(currencyInputToCents(event.target.value)) : '')} placeholder="Valor m&aacute;ximo (R$)" className={fieldClass} />
          </fieldset>}

          {activeFilters.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filtros ativos"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Filtros ativos</span>{activeFilters.map((filter) => <button key={filter.key} type="button" onClick={() => updateFilter(filter.key, '')} className="geo-focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface-subtle px-3 text-xs font-medium text-text-secondary transition-[background-color,color,border-color] hover:border-brand-primary-300 hover:text-text-primary" aria-label={`Remover filtro ${filter.label}: ${filter.value}`}><span>{filter.label}: {filter.value}</span><X aria-hidden="true" size={13} /></button>)}</div>}

          <nav aria-label="Filtrar propostas por status" className="mt-4 overflow-x-auto overscroll-x-contain border-y border-brand-border">
            <div className="flex min-w-max" role="group" aria-label="Status do or&ccedil;amento">
              <button type="button" aria-pressed={!selectedStatus} onClick={() => updateFilter('status', '')} className={cn('geo-focus-ring relative flex min-h-11 items-center gap-2 px-4 text-xs font-semibold transition-[background-color,color] hover:bg-brand-surface-subtle', !selectedStatus ? 'text-brand-primary-700 dark:text-brand-primary-200' : 'text-text-muted')}><span>Todos</span><span className="font-mono tabular-nums">{statusKpis.total}</span>{!selectedStatus && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 bg-brand-primary-500" />}</button>
              {BUDGET_STATUSES.map((status) => {
                const active = selectedStatus === status;
                return <button key={status} type="button" aria-pressed={active} onClick={() => updateFilter('status', status)} className={cn('geo-focus-ring relative flex min-h-11 items-center gap-2 px-4 text-xs font-semibold transition-[background-color,color] hover:bg-brand-surface-subtle', active ? 'text-brand-primary-700 dark:text-brand-primary-200' : 'text-text-muted')}><span>{BUDGET_STATUS_LABELS[status]}</span><span className="font-mono tabular-nums">{statusKpis.counts[status] || 0}</span>{active && <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 bg-brand-primary-500" />}</button>;
              })}
            </div>
          </nav>

          <div className="mt-4">
            {budgetsLoading ? <div className="space-y-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : budgets.length === 0 ? (
              <div className="geo-card flex flex-col items-center px-6 py-16 text-center"><FileText aria-hidden="true" size={44} className="text-text-muted" weight="duotone" /><h3 className="mt-4 text-lg font-semibold text-text-primary">Nenhum or&ccedil;amento encontrado</h3><p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">{hasFilters ? 'Ajuste ou limpe os filtros para ampliar a busca.' : 'Crie o primeiro or\u00e7amento para iniciar seu fluxo comercial.'}</p>{!hasFilters && <button type="button" onClick={() => setEditorOpen(true)} className="mt-5 geo-button-base geo-button-primary geo-focus-ring min-h-11 px-5"><Plus aria-hidden="true" size={17} /> Novo or&ccedil;amento</button>}</div>
            ) : (
              <div className="geo-card max-w-full overflow-hidden">
                <div className="flex items-center justify-end gap-2 border-b border-brand-border bg-brand-surface-subtle/50 px-4 py-2 text-[11px] font-medium text-text-muted lg:hidden">
                  <ArrowsLeftRight aria-hidden="true" size={15} />
                  Arraste para ver todas as colunas
                </div>
                <div className="geo-focus-ring max-h-[70vh] overflow-auto overscroll-contain" role="region" aria-label="Tabela de propostas comerciais" tabIndex={0}>
                  <table className="w-full min-w-[1160px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-brand-border text-xs uppercase tracking-wider text-text-muted">
                        <th className="sticky left-0 top-0 z-30 bg-brand-surface-subtle px-4 py-3 shadow-[12px_0_20px_-20px_rgba(0,0,0,0.55)]">N&uacute;mero / vers&atilde;o</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3">Cliente e im&oacute;vel</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3">Servi&ccedil;o</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3">Emiss&atilde;o / validade</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3">Status</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3 text-right">Valor</th>
                        <th className="sticky top-0 z-20 bg-brand-surface-subtle px-4 py-3 text-right">Margem</th>
                        <th className="sticky right-0 top-0 z-30 bg-brand-surface-subtle px-4 py-3 text-right shadow-[-12px_0_20px_-20px_rgba(0,0,0,0.55)]">A&ccedil;&otilde;es</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {budgets.map((budget) => (
                        <tr key={budget.id} className="group transition-colors duration-150 hover:bg-brand-surface-subtle/60">
                          <td className="sticky left-0 z-10 bg-brand-surface px-4 py-3 shadow-[12px_0_20px_-20px_rgba(0,0,0,0.55)] transition-colors duration-150 group-hover:bg-brand-surface-subtle">
                            <button type="button" onClick={() => openDetail(budget)} className="geo-focus-ring rounded-md text-left font-mono font-bold text-brand-primary-700 hover:underline dark:text-brand-primary-200">{budget.number || 'Rascunho'} <span className="text-xs text-text-muted">v{budget.version}</span></button>
                            <p className="mt-1 max-w-52 truncate text-xs text-text-muted">{budget.description || 'Sem descri\u00e7\u00e3o'}</p>
                          </td>
                          <td className="px-4 py-3"><p className="max-w-52 truncate text-sm font-semibold text-text-primary">{budget.clientName}</p><p className="mt-1 max-w-52 truncate text-xs text-text-muted">{budget.propertyName || 'Im\u00f3vel n\u00e3o informado'} &bull; {budget.municipality || 'Munic\u00edpio n\u00e3o informado'}</p></td>
                          <td className="px-4 py-3"><p className="max-w-64 truncate text-sm text-text-secondary">{budget.serviceType || 'N\u00e3o informado'}</p>{budget.projectId && <Link to={`/projetos/${budget.projectId}`} className="mt-1 block max-w-64 truncate text-xs font-semibold text-brand-primary-700 hover:underline dark:text-brand-primary-200">{budget.projectName || 'Abrir projeto'}</Link>}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-text-secondary"><p>{formatDate(budget.issueDate)}</p><p className="mt-1 text-xs text-text-muted">at&eacute; {formatDate(budget.validUntil)}</p></td>
                          <td className="px-4 py-3"><span className={cn('inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold', statusTone[budget.status])}>{BUDGET_STATUS_LABELS[budget.status]}</span>{budget.viewedAt && <p className="mt-1 text-xs text-text-muted">Visualizado</p>}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold tabular-nums text-text-primary">{formatCurrency(budget.totalCents)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums text-text-primary">{formatBasisPoints(budget.marginBasisPoints)}</td>
                          <td className="sticky right-0 z-10 bg-brand-surface p-3 shadow-[-12px_0_20px_-20px_rgba(0,0,0,0.55)] transition-colors duration-150 group-hover:bg-brand-surface-subtle">
                            <div className="flex justify-end gap-1 rounded-xl border border-transparent bg-brand-surface-subtle/50 p-1 transition-[border-color,background-color] duration-150 group-hover:border-brand-border group-hover:bg-brand-surface">
                              <button type="button" onClick={() => openDetail(budget)} className={cn(iconButtonClass, 'border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-950/30 dark:text-sky-200')} aria-label={`Visualizar ${budget.number || 'or\u00e7amento'} de ${budget.clientName}`}><Eye aria-hidden="true" size={17} /></button>
                              {budget.status === 'rascunho' && <button type="button" onClick={async () => { const detail = await apiClient.get<BudgetDetail>(`/api/orcamentos/${budget.id}`); setEditingBudget(detail); setEditorOpen(true); }} className={cn(iconButtonClass, 'border-indigo-200/80 bg-indigo-50 text-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-950/30 dark:text-indigo-200')} aria-label={`Editar rascunho de ${budget.clientName}`}><PencilSimple aria-hidden="true" size={17} /></button>}
                              <button type="button" onClick={() => duplicateMutation.mutate(budget.id)} className={iconButtonClass} aria-label={`Duplicar or\u00e7amento de ${budget.clientName}`}><Copy aria-hidden="true" size={17} /></button>
                              <button type="button" onClick={() => generatePdf(budget.id)} className={cn(iconButtonClass, 'border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-950/30 dark:text-sky-200')} aria-label={`Gerar PDF do or\u00e7amento de ${budget.clientName}`}><FilePdf aria-hidden="true" size={17} /></button>
                              {budget.status === 'rascunho' && <button type="button" onClick={() => setDeleteTarget(budget)} className={cn(iconButtonClass, 'border-red-200/80 bg-red-50 text-brand-red-700 dark:border-red-400/20 dark:bg-red-950/30 dark:text-brand-red-100')} aria-label={`Excluir rascunho de ${budget.clientName}`}><Trash aria-hidden="true" size={17} /></button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {editorOpen && <BudgetEditor key={`budget-editor-${editingBudget?.id || `new-${initialClientId || 'empty'}`}`} isOpen onClose={() => { setEditorOpen(false); setEditingBudget(null); }} options={options} initial={editingBudget} initialClientId={initialClientId} onSaved={handleBudgetSaved} />}
      {selectedDetail && <BudgetDetails key={`budget-details-${selectedDetail.id}`} detail={selectedDetail} options={options} onClose={closeDetail} onEdit={(detail) => { closeDetail(); setEditingBudget(detail); setEditorOpen(true); }} onOpenBudget={(detail) => openDetail(detail)} />}
      <ConfirmDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }} title="Excluir rascunho" description={`O rascunho de ${deleteTarget?.clientName || 'cliente n\u00e3o informado'} ser\u00e1 removido. Or\u00e7amentos emitidos ou aprovados n\u00e3o podem ser exclu\u00eddos.`} confirmText={deleteMutation.isPending ? 'Excluindo\u2026' : 'Excluir rascunho'} loading={deleteMutation.isPending} />
    </Layout>
  );
}
