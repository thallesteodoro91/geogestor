import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  daysUntilDate,
  type LicenseListItem,
  type LicensePayload
} from '@geogestor/contracts';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { CustomSelect } from '../../components/CustomSelect';
import { filterBarClass, filterSearchInputClass } from '../../utils/filterStyles';
import { geoPanelClass } from '../../utils/geoTheme';
import { apiClient } from '../../services/apiClient';
import { LicenseFormModal } from './LicenseFormModal';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const formatDate = (date?: string | null) => date ? dateFormatter.format(new Date(`${date}T12:00:00Z`)) : 'Não informada';

const statusClasses: Record<string, string> = {
  'Em análise': 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
  'Válida': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  'Em renovação': 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  'Suspensa': 'bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-200',
  'Vencida': 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
  'Encerrada': 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200'
};

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
  className
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const toneClass = {
    success: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-400/20',
    warning: 'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/20',
    danger: 'bg-red-100 text-red-700 ring-red-200 dark:bg-red-400/15 dark:text-red-200 dark:ring-red-400/20'
  }[tone];

  return (
    <div className={cn('flex min-w-0 items-center gap-3 px-3 py-3.5 sm:px-4', className)}>
      <span aria-hidden="true" className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1', toneClass)}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums text-zinc-950 dark:text-white">{value}</p>
      </div>
    </div>
  );
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
  const searchTerm = searchParams.get('lic_q') || '';
  const statusFilter = searchParams.get('lic_status') || '';
  const tipoFilter = searchParams.get('lic_tipo') || '';
  const vencimentoFilter = searchParams.get('lic_vencimento') || '';

  const updateFilter = (key: 'lic_q' | 'lic_status' | 'lic_tipo' | 'lic_vencimento', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.set('tab', 'licenciamento');
    setSearchParams(next, { replace: true });
  };

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (searchTerm.trim()) query.set('q', searchTerm.trim());
    if (statusFilter) query.set('status', statusFilter);
    if (tipoFilter) query.set('tipo', tipoFilter);
    if (vencimentoFilter) query.set('vencimento', vencimentoFilter);
    return query.toString();
  }, [searchTerm, statusFilter, tipoFilter, vencimentoFilter]);

  const licensesQuery = useQuery<LicenseListItem[]>({
    queryKey: ['licencas', queryString],
    queryFn: () => apiClient.get<LicenseListItem[]>(`/api/licencas${queryString ? `?${queryString}` : ''}`)
  });
  const allLicensesQuery = useQuery<LicenseListItem[]>({
    queryKey: ['licencas', 'summary'],
    queryFn: () => apiClient.get<LicenseListItem[]>('/api/licencas')
  });

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

  const summary = useMemo(() => {
    const licenses = allLicensesQuery.data || [];
    return {
      valid: licenses.filter((item) => item.status === 'Válida').length,
      expired: licenses.filter((item) => item.status === 'Vencida').length,
      near: licenses.filter((item) => { const days = daysUntilDate(item.dataVencimento); return days >= 0 && days <= 120 && item.status !== 'Encerrada'; }).length,
      renewal: licenses.filter((item) => item.statusRegistrado === 'Em renovação').length,
      pending: licenses.reduce((total, item) => total + item.condicionantesPendentes, 0),
      overdue: licenses.reduce((total, item) => total + item.condicionantesVencidas, 0)
    };
  }, [allLicensesQuery.data]);

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['lic_q', 'lic_status', 'lic_tipo', 'lic_vencimento'].forEach((key) => next.delete(key));
    next.set('tab', 'licenciamento');
    setSearchParams(next, { replace: true });
  };
  const hasFilters = Boolean(searchTerm || statusFilter || tipoFilter || vencimentoFilter);

  return (
    <div className="space-y-6">
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

      <div aria-live="polite" className="sr-only">{allLicensesQuery.isLoading ? 'Atualizando indicadores…' : 'Indicadores de licenciamento atualizados.'}</div>
      {allLicensesQuery.isLoading ? (
        <div role="status" className={cn(geoPanelClass, 'flex min-h-20 items-center justify-center rounded-2xl px-4 text-sm text-zinc-500 dark:text-zinc-400')}>
          Atualizando resumo operacional…
        </div>
      ) : (allLicensesQuery.data?.length || 0) > 0 ? (
        <section aria-labelledby="license-summary-title" className={cn(geoPanelClass, 'overflow-hidden rounded-2xl')}>
          <header className="flex items-center gap-3 border-b border-zinc-200/80 px-4 py-3.5 sm:px-5 dark:border-zinc-800">
            <span aria-hidden="true" className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-400/20">
              <Certificate weight="duotone" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="license-summary-title" className="text-sm font-bold text-zinc-950 dark:text-white">Resumo operacional</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Situação consolidada da carteira de licenças.</p>
            </div>
          </header>
          <div className="grid lg:grid-cols-[2fr_1fr]">
            <section aria-labelledby="license-summary-licenses" className="p-3 sm:p-4 lg:border-r lg:border-zinc-200/80 dark:lg:border-zinc-800">
              <h3 id="license-summary-licenses" className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Licenças</h3>
              <div className="grid grid-cols-2">
                <OperationalSummaryItem label="Válidas" value={summary.valid} tone="success" icon={<CheckCircle weight="fill" className="h-5 w-5" />} className="border-r border-zinc-200/80 dark:border-zinc-800" />
                <OperationalSummaryItem label="Vencidas" value={summary.expired} tone="danger" icon={<Warning weight="fill" className="h-5 w-5" />} />
                <OperationalSummaryItem label="Até 120 dias" value={summary.near} tone="warning" icon={<Clock weight="fill" className="h-5 w-5" />} className="border-r border-t border-zinc-200/80 dark:border-zinc-800" />
                <OperationalSummaryItem label="Em renovação" value={summary.renewal} tone="warning" icon={<Certificate weight="fill" className="h-5 w-5" />} className="border-t border-zinc-200/80 dark:border-zinc-800" />
              </div>
            </section>
            <section aria-labelledby="license-summary-conditions" className="border-t border-zinc-200/80 p-3 sm:p-4 lg:border-t-0 dark:border-zinc-800">
              <h3 id="license-summary-conditions" className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">Condicionantes</h3>
              <div className="grid grid-cols-2">
                <OperationalSummaryItem label="Pendentes" value={summary.pending} tone="warning" icon={<FileText weight="fill" className="h-5 w-5" />} className="border-r border-zinc-200/80 dark:border-zinc-800" />
                <OperationalSummaryItem label="Vencidas" value={summary.overdue} tone="danger" icon={<WarningCircle weight="fill" className="h-5 w-5" />} />
              </div>
            </section>
          </div>
        </section>
      ) : null}

      <div className={cn(filterBarClass, 'flex flex-col items-stretch gap-2 xl:flex-row xl:items-center')}>
        <div className="relative min-w-0 flex-1 xl:max-w-md">
          <label htmlFor="license-search" className="sr-only">Buscar licenças</label>
          <MagnifyingGlass aria-hidden="true" className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input id="license-search" name="buscaLicenca" type="search" autoComplete="off" placeholder="Buscar por empreendimento, cliente, órgão ou licença…" value={searchTerm} onChange={(event) => updateFilter('lic_q', event.target.value)} className={filterSearchInputClass} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
          <CustomSelect value={statusFilter} onChange={(value) => updateFilter('lic_status', value)} placeholder="Status: todos" ariaLabel="Filtrar licenças por status" className="min-w-0 flex-1" options={[{ label: 'Status: todos', value: '' }, ...LICENSE_STATUSES.map((status) => ({ label: status, value: status }))]} />
          <CustomSelect value={tipoFilter} onChange={(value) => updateFilter('lic_tipo', value)} placeholder="Tipo: todos" ariaLabel="Filtrar licenças por tipo" className="min-w-0 flex-1" options={[{ label: 'Tipo: todos', value: '' }, { label: 'Licença Prévia — LP', value: 'LP' }, { label: 'Licença de Instalação — LI', value: 'LI' }, { label: 'Licença de Operação — LO', value: 'LO' }, { label: 'Renovação', value: 'Renovação' }, { label: 'Outros', value: 'Outros' }]} />
          <CustomSelect value={vencimentoFilter} onChange={(value) => updateFilter('lic_vencimento', value)} placeholder="Vencimento: todos" ariaLabel="Filtrar licenças por vencimento" className="min-w-0 flex-1" options={[{ label: 'Vencimento: todos', value: '' }, { label: 'Próximos 30 dias', value: '30d' }, { label: 'Próximos 60 dias', value: '60d' }, { label: 'Próximos 90 dias', value: '90d' }, { label: 'Próximos 120 dias', value: '120d' }, { label: 'Vencidas', value: 'vencida' }]} />
          {hasFilters && <button type="button" onClick={clearFilters} className={secondarySmallActionButtonClass}>Limpar</button>}
        </div>
      </div>

      <div aria-live="polite" className="sr-only">{licensesQuery.isLoading ? 'Carregando licenças…' : `${licensesQuery.data?.length || 0} licenças exibidas.`}</div>
      {licensesQuery.isLoading ? (
        <div role="status" className="rounded-xl border border-zinc-200 bg-white py-14 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">Carregando licenças…</div>
      ) : licensesQuery.isError ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 py-10 text-center dark:border-red-900/50 dark:bg-red-950/30"><WarningCircle aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-red-600" /><h2 className="text-sm font-semibold text-red-900 dark:text-red-200">Não foi possível carregar as licenças</h2><p className="mt-1 text-xs text-red-700 dark:text-red-300">Verifique o servidor local e tente novamente.</p><button type="button" onClick={() => licensesQuery.refetch()} className={cn(secondarySmallActionButtonClass, 'mt-4')}>Tentar novamente</button></div>
      ) : !licensesQuery.data?.length ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white py-12 text-center dark:border-zinc-800 dark:bg-zinc-900"><Certificate aria-hidden="true" className="mx-auto mb-2 h-9 w-9 text-zinc-300" /><h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{hasFilters ? 'Nenhuma licença corresponde aos filtros' : 'Nenhuma licença cadastrada'}</h2><p className="mt-1 text-xs text-zinc-500">{hasFilters ? 'Limpe ou ajuste os filtros.' : 'Cadastre a primeira licença ambiental.'}</p><div className="mt-4 flex justify-center"><button type="button" onClick={hasFilters ? clearFilters : () => setShowForm(true)} className={cn(hasFilters ? secondarySmallActionButtonClass : primaryActionButtonClass, 'px-4')}>{hasFilters ? 'Limpar filtros' : 'Cadastrar primeira licença'}</button></div></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {licensesQuery.data.map((license) => (
              <Link key={license.id} to={`/ambiental/licencas/${license.id}`} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-[border-color,box-shadow] hover:border-amber-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold text-zinc-950 dark:text-white">{license.numero}</p><h2 className="mt-1 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">{license.projetoNome}</h2><p className="mt-0.5 truncate text-xs text-zinc-500">{license.clienteNome}</p></div><span className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold', statusClasses[license.status])}>{license.status}</span></div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-zinc-400">Tipo / órgão</dt><dd className="mt-0.5 font-medium text-zinc-700 dark:text-zinc-300">{license.tipoLicenca || 'Não informado'} · {license.orgao}</dd></div><div><dt className="text-zinc-400">Vencimento</dt><dd className="mt-0.5 font-semibold text-zinc-700 dark:text-zinc-300">{formatDate(license.dataVencimento)}</dd></div><div className="col-span-2"><dt className="text-zinc-400">Condicionantes</dt><dd className="mt-0.5 font-medium text-zinc-700 dark:text-zinc-300">{license.condicionantesPendentes} pendentes · {license.condicionantesVencidas} vencidas</dd></div></dl>
              </Link>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm md:block dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <caption className="sr-only">Licenças ambientais, vencimentos e condicionantes</caption>
                <thead><tr className="border-b border-zinc-200 bg-zinc-50/70 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/30 dark:text-zinc-400"><th scope="col" className="px-4 py-3">Número / órgão</th><th scope="col" className="px-4 py-3">Projeto / cliente</th><th scope="col" className="px-4 py-3">Tipo</th><th scope="col" className="px-4 py-3">Vencimento</th><th scope="col" className="px-4 py-3">Condicionantes</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3"><span className="sr-only">Ações</span></th></tr></thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">{licensesQuery.data.map((license) => <tr key={license.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"><td className="px-4 py-3"><div className="font-semibold text-zinc-950 dark:text-white">{license.numero}</div><div className="mt-0.5 text-[10px] text-zinc-500">{license.orgao}</div></td><td className="max-w-[260px] px-4 py-3"><div className="truncate font-medium text-zinc-800 dark:text-zinc-200">{license.projetoNome}</div><div className="mt-0.5 truncate text-[10px] text-zinc-500">{license.clienteNome}</div></td><td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{license.tipoLicenca || 'Não informado'}</td><td className="px-4 py-3 font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{formatDate(license.dataVencimento)}</td><td className="px-4 py-3"><span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', license.condicionantesVencidas ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300' : license.condicionantesPendentes ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300')}>{license.condicionantesVencidas ? `${license.condicionantesVencidas} vencidas` : license.condicionantesPendentes ? `${license.condicionantesPendentes} pendentes` : 'Em dia'}</span></td><td className="px-4 py-3"><span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold', statusClasses[license.status])}>{license.status}</span></td><td className="px-4 py-3 text-right"><Link to={`/ambiental/licencas/${license.id}`} className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-300 dark:hover:bg-blue-500/10" aria-label={`Abrir licença ${license.numero}`}>Abrir</Link></td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <LicenseFormModal isOpen={showForm} onClose={() => !createMutation.isPending && setShowForm(false)} loading={createMutation.isPending} onSubmit={(payload) => createMutation.mutateAsync(payload).then(() => undefined)} />
    </div>
  );
}
