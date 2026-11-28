import { useListPageNavigation } from '../../hooks/useListPageNavigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Certificate,
  CheckCircle,
  Clock,
  FileText,
  MagnifyingGlass,
  Plus,
  Warning,
  WarningCircle
} from '@phosphor-icons/react';
import {
  LICENSE_STATUSES,

  type LicenseListItem,
  type LicensePayload
} from '@geogestor/contracts';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { CustomSelect } from '../../components/CustomSelect';
import { filterBarClass, filterSearchInputClass } from '../../utils/filterStyles';
import { geoPanelClass } from '../../utils/geoTheme';
import { apiClient } from '../../services/apiClient';
import { getWorkStatusPresentation } from '../../utils/workStatus';
import { LicenseFormModal } from './LicenseFormModal';
import { formatLicenseDate, getLicenseDeadline, getSafeLicenseReturnTo, licenseDetailPath, licenseStatusClass, parseLicensePage } from './licensePresentation';
import './licensing.css';

const formatDate = formatLicenseDate;
const numberFormatter = new Intl.NumberFormat('pt-BR');

function LicenseDates({ license }: { license: LicenseListItem }) {
  const deadline = getLicenseDeadline(license.dataVencimento);
  return <><span className="block font-semibold tabular-nums">{formatDate(license.dataVencimento)}</span><span className={cn('mt-1 inline-flex rounded-md px-2 py-1 text-xs', `license-tone-${deadline.tone}`)}>{deadline.label}</span></>;
}

interface LicenciamentoProps {
  showHeader?: boolean;
  createModalOpen?: boolean;
  onCreateModalOpenChange?: (open: boolean) => void;
}

function OperationalSummaryItem({
  icon,
  label,
  value,
  tone,
  className,
  onClick,
  active = false
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger';
  className?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const content = <>
      <span aria-hidden="true" className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', `license-tone-${tone}`)}>
        {icon}
      </span>
      <span className="min-w-0"><span className="license-summary-label license-secondary block">{label}</span><span className="license-summary-value block">{numberFormatter.format(value)}</span></span>
    </>;
  return onClick ? <button type="button" onClick={onClick} aria-label={`Filtrar licenças: ${label}`} aria-pressed={active} className={cn('license-summary-metric geo-focus-ring min-h-11', className)}>{content}</button>
    : <div className={cn('license-summary-metric', className)}>{content}</div>;
}

export function Licenciamento({
  showHeader = true,
  createModalOpen,
  onCreateModalOpenChange
}: LicenciamentoProps = {}) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [internalShowForm, setInternalShowForm] = useState(false);
  const showForm = createModalOpen ?? internalShowForm;
  const setShowForm = (open: boolean) => {
    if (onCreateModalOpenChange) onCreateModalOpenChange(open);
    else setInternalShowForm(open);
  };
  const requestedPage = searchParams.get('lic_page');
  const licensePage = parseLicensePage(requestedPage);
  const searchTerm = searchParams.get('lic_q') || '';
  const [searchDraft, setSearchDraft] = useState(searchTerm);
  const [lastSearchTerm, setLastSearchTerm] = useState(searchTerm);
  const statusFilter = searchParams.get('lic_status') || '';
  const tipoFilter = searchParams.get('lic_tipo') || '';
  const vencimentoFilter = searchParams.get('lic_vencimento') || '';
  const returnTo = getSafeLicenseReturnTo(`/ambiental?${searchParams}`);

  if (lastSearchTerm !== searchTerm) {
    setLastSearchTerm(searchTerm);
    setSearchDraft(searchTerm);
  }
  useEffect(() => {
    if (searchDraft === searchTerm) return;
    const timer = window.setTimeout(() => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        if (searchDraft) next.set('lic_q', searchDraft); else next.delete('lic_q');
        next.delete('lic_page'); next.set('tab', 'licenciamento'); return next;
      }, { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft, searchTerm, setSearchParams]);
  useEffect(() => {
    if (requestedPage === null || requestedPage === String(licensePage)) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (licensePage === 1) next.delete('lic_page'); else next.set('lic_page', String(licensePage));
      return next;
    }, { replace: true });
  }, [requestedPage, licensePage, setSearchParams]);

  const updateFilter = (key: 'lic_q' | 'lic_status' | 'lic_tipo' | 'lic_vencimento', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (searchDraft) next.set('lic_q', searchDraft); else next.delete('lic_q');
    next.delete('lic_page');
    next.set('tab', 'licenciamento');
    setSearchParams(next, { replace: true });
  };
  const applySummaryFilter = (key: 'lic_status' | 'lic_vencimento', value: string) => {
    const next = new URLSearchParams(searchParams);
    const active = next.get(key) === value;
    next.delete('lic_status'); next.delete('lic_vencimento'); next.delete('lic_page');
    if (!active) next.set(key, value);
    if (searchDraft) next.set('lic_q', searchDraft); else next.delete('lic_q');
    next.set('tab', 'licenciamento'); setSearchParams(next, { replace: true });
  };

  const queryString = useMemo(() => {
    const query = new URLSearchParams({ mode: 'page', page: String(licensePage), limit: '25' });
    if (searchTerm.trim()) query.set('q', searchTerm.trim());
    if (statusFilter) query.set('status', statusFilter);
    if (tipoFilter) query.set('tipo', tipoFilter);
    if (vencimentoFilter) query.set('vencimento', vencimentoFilter);
    return query.toString();
  }, [searchTerm, statusFilter, tipoFilter, vencimentoFilter, licensePage]);

  const licensesQuery = useQuery<{ items: LicenseListItem[]; total: number; page: number; totalPages: number }>({
    queryKey: ['licencas', queryString],
    queryFn: ({ signal }) => apiClient.get<{ items: LicenseListItem[]; total: number; page: number; totalPages: number }>(`/api/licencas?${queryString}`, { signal }),
    placeholderData: keepPreviousData
  });
  const allLicensesQuery = useQuery<{ total: number; valid: number; expired: number; near: number; renewal: number; pending: number; overdue: number }>({
    queryKey: ['licencas', 'summary'],
    queryFn: ({ signal }) => apiClient.get<{ total: number; valid: number; expired: number; near: number; renewal: number; pending: number; overdue: number }>('/api/licencas/summary', { signal })
  });
  const { resultsAnchor, preparePage } = useListPageNavigation({ page: licensePage, resolvedPage: licensesQuery.data?.page, ready: !licensesQuery.isFetching, failed: licensesQuery.isError, scope: [searchTerm, statusFilter, tipoFilter, vencimentoFilter].join('|') });
  const totalPages = Math.max(1, licensesQuery.data?.totalPages || 1);
  useEffect(() => {
    if (!licensesQuery.isSuccess || licensesQuery.isPlaceholderData || licensePage <= totalPages) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (totalPages === 1) next.delete('lic_page'); else next.set('lic_page', String(totalPages));
      return next;
    }, { replace: true });
  }, [licensePage, totalPages, licensesQuery.isSuccess, licensesQuery.isPlaceholderData, setSearchParams]);

  const createMutation = useMutation({
    mutationFn: (payload: LicensePayload) => apiClient.post('/api/licencas', payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['licencas'] }),
        queryClient.invalidateQueries({ queryKey: ['stats-geral'] })
      ]);
      setShowForm(false);
      toast.success('Licença criada com sucesso.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Não foi possível criar a licença.')
  });

  const summary = allLicensesQuery.data || { total: 0, valid: 0, expired: 0, near: 0, renewal: 0, pending: 0, overdue: 0 };

  const clearFilters = () => {
    setSearchDraft('');
    const next = new URLSearchParams(searchParams);
    ['lic_q', 'lic_status', 'lic_tipo', 'lic_vencimento'].forEach((key) => next.delete(key));
    next.delete('lic_page');
    next.set('tab', 'licenciamento');
    setSearchParams(next, { replace: true });
  };
  const hasFilters = Boolean(searchTerm || searchDraft || statusFilter || tipoFilter || vencimentoFilter);
  const summaryMessage = allLicensesQuery.isError
    ? allLicensesQuery.data ? 'Não foi possível atualizar os indicadores. Os últimos valores foram preservados.' : 'Não foi possível carregar os indicadores.'
    : allLicensesQuery.isFetching ? 'Atualizando indicadores…' : 'Indicadores de licenciamento atualizados.';

  return (
    <div className="licensing-surface space-y-6">
      {showHeader && (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <h1 className="flex items-center gap-3 text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              <span aria-hidden="true" className="rounded-xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"><Certificate weight="duotone" className="h-6 w-6" /></span>
              Licenciamento Ambiental
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Controle licenças, renovações, condicionantes e vencimentos reais.</p>
          </div>
          <button type="button" onClick={() => setShowForm(true)} className={cn(primaryActionButtonClass, 'gap-2 px-4 py-2.5 text-sm font-semibold')}><Plus aria-hidden="true" weight="bold" className="h-4 w-4" />Nova licença</button>
        </div>
      )}

      <div aria-live="polite" className="sr-only">{summaryMessage}</div>
      {allLicensesQuery.isError && <div role="alert" className="license-tone-warning flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm"><p className="min-w-0 flex-1">{summaryMessage}</p><button type="button" disabled={allLicensesQuery.isFetching} onClick={() => void allLicensesQuery.refetch()} className={cn(secondarySmallActionButtonClass, 'min-h-11')}>{allLicensesQuery.isFetching ? 'Tentando novamente…' : 'Tentar atualizar indicadores'}</button></div>}
      {allLicensesQuery.isLoading ? (
        <div role="status" className={cn(geoPanelClass, 'flex min-h-20 items-center justify-center rounded-2xl px-4 text-sm text-zinc-500 dark:text-zinc-400')}>
          Atualizando resumo operacional…
        </div>
      ) : (allLicensesQuery.data?.total || 0) > 0 ? (
        <section aria-labelledby="license-summary-title" className={cn(geoPanelClass, 'license-summary overflow-hidden rounded-2xl')}>
          <header className="flex items-center gap-3 border-b border-zinc-200/80 px-4 py-3.5 sm:px-5 dark:border-zinc-800">
            <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/20">
              <Certificate weight="duotone" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="license-summary-title" className="text-sm font-bold text-zinc-950 dark:text-white">Resumo operacional</h2>
              <p className="license-secondary mt-1 text-sm">Toda a carteira · {numberFormatter.format(summary.total)} {summary.total === 1 ? 'licença' : 'licenças'}. Os filtros abaixo afetam somente a lista.</p>
            </div>
          </header>
          <div className="license-summary-groups">
            <section aria-labelledby="license-summary-licenses" className="p-3 sm:p-4">
              <h3 id="license-summary-licenses" className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Licenças</h3>
              <div className="license-summary-metrics">
                <OperationalSummaryItem label="Válidas" value={summary.valid} tone="success" icon={<CheckCircle weight="fill" className="h-5 w-5" />} onClick={() => applySummaryFilter('lic_status', 'Válida')} active={statusFilter === 'Válida'} />
                <OperationalSummaryItem label="Vencidas" value={summary.expired} tone="danger" icon={<Warning weight="fill" className="h-5 w-5" />} onClick={() => applySummaryFilter('lic_status', 'Vencida')} active={statusFilter === 'Vencida'} />
                <OperationalSummaryItem label="Até 120 dias" value={summary.near} tone="warning" icon={<Clock weight="fill" className="h-5 w-5" />} onClick={() => applySummaryFilter('lic_vencimento', '120d')} active={vencimentoFilter === '120d'} />
                <OperationalSummaryItem label="Em renovação" value={summary.renewal} tone="warning" icon={<Certificate weight="fill" className="h-5 w-5" />} onClick={() => applySummaryFilter('lic_status', 'Em renovação')} active={statusFilter === 'Em renovação'} />
              </div>
            </section>
            <section aria-labelledby="license-summary-conditions" className="license-summary-conditions p-3 sm:p-4">
              <h3 id="license-summary-conditions" className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Condicionantes</h3>
              <div className="license-summary-metrics">
                <OperationalSummaryItem label="Pendentes" value={summary.pending} tone="warning" icon={<FileText weight="fill" className="h-5 w-5" />} />
                <OperationalSummaryItem label="Vencidas" value={summary.overdue} tone="danger" icon={<WarningCircle weight="fill" className="h-5 w-5" />} />
              </div>
            </section>
          </div>
        </section>
      ) : null}

      <div className={cn(filterBarClass, 'license-filters flex flex-col items-stretch gap-2 xl:flex-row xl:items-center')}>
        <div className="relative min-w-0 flex-1 xl:max-w-md">
          <label htmlFor="license-search" className="sr-only">Buscar licenças</label>
          <MagnifyingGlass aria-hidden="true" className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input id="license-search" name="buscaLicenca" type="search" autoComplete="off" placeholder="Buscar por empreendimento, cliente, órgão ou licença…" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} className={cn(filterSearchInputClass, 'min-h-11 text-sm')} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
          <CustomSelect buttonClassName="min-h-11 text-sm" value={statusFilter} onChange={(value) => updateFilter('lic_status', value)} placeholder="Status: todos" ariaLabel="Filtrar licenças por status" className="min-w-0 flex-1" options={[{ label: 'Status: todos', value: '' }, ...LICENSE_STATUSES.map((status) => ({ label: status, value: status }))]} />
          <CustomSelect buttonClassName="min-h-11 text-sm" value={tipoFilter} onChange={(value) => updateFilter('lic_tipo', value)} placeholder="Tipo: todos" ariaLabel="Filtrar licenças por tipo" className="min-w-0 flex-1" options={[{ label: 'Tipo: todos', value: '' }, { label: 'Licença Prévia — LP', value: 'LP' }, { label: 'Licença de Instalação — LI', value: 'LI' }, { label: 'Licença de Operação — LO', value: 'LO' }, { label: 'Renovação', value: 'Renovação' }, { label: 'Outros', value: 'Outros' }]} />
          <CustomSelect buttonClassName="min-h-11 text-sm" value={vencimentoFilter} onChange={(value) => updateFilter('lic_vencimento', value)} placeholder="Vencimento: todos" ariaLabel="Filtrar licenças por vencimento" className="min-w-0 flex-1" options={[{ label: 'Vencimento: todos', value: '' }, { label: 'Próximos 30 dias', value: '30d' }, { label: 'Próximos 60 dias', value: '60d' }, { label: 'Próximos 90 dias', value: '90d' }, { label: 'Próximos 120 dias', value: '120d' }, { label: 'Vencidas', value: 'vencida' }]} />
          {hasFilters && <button type="button" onClick={clearFilters} className={secondarySmallActionButtonClass}>Limpar filtros</button>}
        </div>
      </div>

      <p role="status" aria-live="polite" className="license-secondary min-h-5 text-sm">{licensesQuery.isError ? 'Não foi possível atualizar as licenças.' : licensesQuery.isFetching ? 'Atualizando licenças…' : `${numberFormatter.format(licensesQuery.data?.total || 0)} ${licensesQuery.data?.total === 1 ? 'licença encontrada' : 'licenças encontradas'}.`}</p>
      <p ref={resultsAnchor} tabIndex={-1} className="geo-focus-ring scroll-mt-28 text-sm text-text-secondary" role="status" aria-live="polite" aria-atomic="true">Página {licensesQuery.data?.page ?? licensePage} de {totalPages} · Intervalo {licensesQuery.data?.items.length ? ((licensesQuery.data.page - 1) * 25 + 1) : 0}–{licensesQuery.data?.items.length ? ((licensesQuery.data.page - 1) * 25 + licensesQuery.data.items.length) : 0}</p>
      {licensesQuery.isLoading ? (
        <div role="status" className="rounded-xl border border-zinc-200 bg-white py-14 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">Carregando licenças…</div>
      ) : licensesQuery.isError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 py-10 text-center dark:border-red-900/50 dark:bg-red-950/30"><WarningCircle aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-red-600" /><h2 className="text-sm font-semibold text-red-900 dark:text-red-200">Não foi possível carregar as licenças</h2><p className="mt-1 text-xs text-red-700 dark:text-red-300">Verifique o servidor local e tente novamente.</p><button type="button" onClick={() => licensesQuery.refetch()} className={cn(secondarySmallActionButtonClass, 'mt-4')}>Tentar novamente</button></div>
      ) : !licensesQuery.data?.items.length ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white py-12 text-center dark:border-zinc-800 dark:bg-zinc-900"><Certificate aria-hidden="true" className="mx-auto mb-2 h-9 w-9 text-zinc-300" /><h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{hasFilters ? 'Nenhuma licença corresponde aos filtros' : 'Nenhuma licença cadastrada'}</h2><p className="mt-1 text-xs text-zinc-500">{hasFilters ? 'Limpe ou ajuste os filtros.' : 'Cadastre a primeira licença ambiental.'}</p><div className="mt-4 flex justify-center"><button type="button" onClick={hasFilters ? clearFilters : () => setShowForm(true)} className={cn(hasFilters ? secondarySmallActionButtonClass : primaryActionButtonClass, 'px-4')}>{hasFilters ? 'Limpar filtros' : 'Cadastrar primeira licença'}</button></div></div>
      ) : (
        <>
          <div aria-busy={licensesQuery.isFetching} className="grid grid-cols-1 gap-3 md:hidden">
            {licensesQuery.data.items.map((license) => (
              <Link key={license.id} to={licenseDetailPath(license.id, returnTo)} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-[border-color,box-shadow] hover:border-amber-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-xs font-bold text-zinc-950 dark:text-white">{license.numero}</p><h2 className="mt-1 break-words text-base font-semibold text-zinc-800 dark:text-zinc-200">{license.projetoNome}</h2><p className="mt-0.5 break-words text-sm text-text-secondary">{license.clienteNome}</p></div><div className="flex shrink-0 flex-col items-end gap-1.5"><span className={cn('license-status-badge rounded-full px-2 py-1 text-xs font-semibold', licenseStatusClass(license.status))}>{license.status}</span><span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', getWorkStatusPresentation(license.trabalhoStatus).badgeClass)}>Trabalho: {getWorkStatusPresentation(license.trabalhoStatus).label}</span></div></div>
                <dl className="mt-4 grid grid-cols-1 gap-4 text-sm"><div><dt className="text-text-secondary">Tipo / órgão</dt><dd className="mt-0.5 font-medium text-zinc-700 dark:text-zinc-300">{license.tipoLicenca || 'Não informado'} · {license.orgao}</dd></div><div><dt className="text-text-secondary">Vencimento</dt><dd className="mt-0.5 font-semibold text-zinc-700 dark:text-zinc-300"><LicenseDates license={license} /></dd></div><div><dt className="text-text-secondary">Condicionantes</dt><dd className="mt-0.5 font-medium text-zinc-700 dark:text-zinc-300">{license.condicionantesPendentes} pendentes · {license.condicionantesVencidas} vencidas</dd></div>{license.proximaCondicionante && <div><dt>Próxima condicionante</dt><dd className="mt-1 font-semibold tabular-nums">{formatDate(license.proximaCondicionante)}</dd></div>}</dl>
              </Link>
            ))}
          </div>
          <div aria-busy={licensesQuery.isFetching} className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm md:block dark:border-zinc-800 dark:bg-zinc-900">
            <p className="license-secondary border-b border-brand-border px-4 py-3 text-xs">Role para os lados para ver todas as colunas.</p><div className="overflow-x-auto">
              <table className="license-table w-full border-collapse text-left text-sm">
                <caption className="sr-only">Licenças ambientais, vencimentos e condicionantes</caption>
                <thead><tr className="border-b border-zinc-200 bg-zinc-50/70 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/30 dark:text-zinc-400"><th scope="col" className="px-4 py-3">Número / órgão</th><th scope="col" className="px-4 py-3">Projeto / cliente</th><th scope="col" className="px-4 py-3">Tipo</th><th scope="col" className="px-4 py-3">Vencimento</th><th scope="col" className="px-4 py-3">Condicionantes</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th></tr></thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{licensesQuery.data.items.map((license) => <tr key={license.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"><td className="px-4 py-3"><div className="font-semibold text-zinc-950 dark:text-white">{license.numero}</div><div className="mt-0.5 text-[10px] text-zinc-500">{license.orgao}</div></td><td className="max-w-[260px] px-4 py-3"><div className="truncate font-medium text-zinc-800 dark:text-zinc-200">{license.projetoNome}</div><div className="mt-0.5 truncate text-[10px] text-zinc-500">{license.clienteNome}</div><span className={cn('mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', getWorkStatusPresentation(license.trabalhoStatus).badgeClass)}>Trabalho: {getWorkStatusPresentation(license.trabalhoStatus).label}</span></td><td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{license.tipoLicenca || 'Não informado'}</td><td className="px-4 py-3 font-medium tabular-nums text-zinc-700 dark:text-zinc-300"><LicenseDates license={license} /></td><td className="px-4 py-3"><span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', `license-tone-${license.condicionantesVencidas ? 'danger' : license.condicionantesPendentes ? 'warning' : 'neutral'}`)}>{license.condicionantesVencidas ? `${license.condicionantesVencidas} vencidas` : license.condicionantesPendentes ? `${license.condicionantesPendentes} pendentes` : 'Em dia'}</span>{license.proximaCondicionante && <p className="license-secondary mt-2 text-xs tabular-nums">Próxima: {formatDate(license.proximaCondicionante)}</p>}</td><td className="px-4 py-3"><span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', licenseStatusClass(license.status))}>{license.status}</span></td><td className="px-4 py-3 text-right"><Link to={licenseDetailPath(license.id, returnTo)} className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-500/10" aria-label={`Abrir licença ${license.numero}`}>Abrir</Link></td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <nav aria-label="Paginação das licenças" className="flex flex-wrap items-center gap-3">
        <p aria-live="polite" className="text-sm tabular-nums">Página {numberFormatter.format(licensePage)} de {numberFormatter.format(totalPages)} · {numberFormatter.format(licensesQuery.data?.total || 0)} {licensesQuery.data?.total === 1 ? 'resultado' : 'resultados'}. Esta lista mostra até 25 licenças por página.</p>
        <button type="button" className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4" disabled={licensePage <= 1 || licensesQuery.isFetching} onClick={() => { preparePage(licensePage - 1); const next = new URLSearchParams(searchParams); next.set('lic_page', String(licensePage - 1)); setSearchParams(next); }}>Anterior</button>
        <button type="button" className="geo-button-base geo-button-secondary geo-focus-ring min-h-11 px-4" disabled={licensePage >= totalPages || licensesQuery.isFetching} onClick={() => { preparePage(licensePage + 1); const next = new URLSearchParams(searchParams); next.set('lic_page', String(licensePage + 1)); setSearchParams(next); }}>Próxima</button>
      </nav>
      <LicenseFormModal isOpen={showForm} onClose={() => !createMutation.isPending && setShowForm(false)} loading={createMutation.isPending} onSubmit={(payload) => createMutation.mutateAsync(payload).then(() => undefined)} />
    </div>
  );
}
