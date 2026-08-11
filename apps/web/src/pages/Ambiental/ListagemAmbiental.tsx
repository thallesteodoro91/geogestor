import { DatePickerField, FormSelect } from '../../components/Form';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  Plus,
  Scales,
  WarningCircle
} from '@phosphor-icons/react';
import type { EnvironmentalDemandListResponse } from '@geogestor/contracts';
import { Layout } from '../../components/Layout';
import { PageFilterBar } from '../../components/PageFilterBar';
import { PageHeader } from '../../components/PageHeader';
import { apiClient } from '../../services/apiClient';
import { Licenciamento } from '../Licenciamento/Licenciamento';
import { CalculadoraAmbiental } from '../Calculadoras/CalculadoraAmbiental';
import { ProjectFormModal } from '../Projetos/ProjectFormModal';
import { cn } from '../../utils/cn';
import {
  headerPrimaryActionButtonClass,
  headerPrimaryActionIconClass,
  secondarySmallActionButtonClass,
} from '../../utils/actionStyles';
import { filterSearchInputClass } from '../../utils/filterStyles';
import {
  localNavigationBarClass,
  localNavigationButtonClass,
  localNavigationIconClass,
} from '../../utils/localNavigationStyles';
import environmentalDemandsIcon from '../../assets/magnific-icons/eco-energy_3274986.png';
import licensingIcon from '../../assets/magnific-icons/certification_5192312.png';
import carAnalysisIcon from '../../assets/magnific-icons/calculator_9264106.svg';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
const numberFormatter = new Intl.NumberFormat('pt-BR');
const environmentalTabs = ['ambiental', 'licenciamento', 'car'] as const;
type EnvironmentalTab = typeof environmentalTabs[number];
const formatDate = (date?: string | null) => date ? dateFormatter.format(new Date(`${date.slice(0, 10)}T12:00:00Z`)) : 'Não definido';

function deadlineTone(date?: string | null) {
  if (!date) return 'text-zinc-500 dark:text-zinc-400';
  const days = Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'text-red-700 dark:text-red-300';
  if (days <= 7) return 'text-amber-700 dark:text-amber-300';
  return 'text-emerald-700 dark:text-emerald-300';
}

export function ListagemAmbiental() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [licenseFormOpen, setLicenseFormOpen] = useState(false);
  const [tabScrollCues, setTabScrollCues] = useState({ left: false, right: false });
  const requestedTab = searchParams.get('tab');
  const activeTab: EnvironmentalTab = environmentalTabs.includes(requestedTab as EnvironmentalTab)
    ? requestedTab as EnvironmentalTab
    : 'ambiental';
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const searchId = useId();
  const filterPanelId = useId();
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const status = searchParams.get('status') || '';
  const tipo = searchParams.get('tipo') || '';
  const inicio = searchParams.get('inicio') || '';
  const fim = searchParams.get('fim') || '';
  const searchTerm = searchParams.get('q') || '';
  const demandFormOpen = activeTab === 'ambiental' && searchParams.get('action') === 'new';

  useEffect(() => {
    const index = environmentalTabs.indexOf(activeTab);
    tabRefs.current[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    const updateScrollCues = () => {
      const tabList = tabListRef.current;
      if (!tabList) return;
      setTabScrollCues({
        left: tabList.scrollLeft > 2,
        right: tabList.scrollWidth - tabList.clientWidth - tabList.scrollLeft > 2
      });
    };

    const frame = window.requestAnimationFrame(updateScrollCues);
    window.addEventListener('resize', updateScrollCues);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateScrollCues);
    };
  }, [activeTab]);

  const updateParam = (key: string, value: string, replace = false) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace });
  };

  const handleTabChange = (tab: EnvironmentalTab) => {
    if (tab !== 'licenciamento') setLicenseFormOpen(false);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? environmentalTabs.length - 1
        : event.key === 'ArrowRight' ? (index + 1) % environmentalTabs.length
          : (index - 1 + environmentalTabs.length) % environmentalTabs.length;
    const tab = environmentalTabs[nextIndex];
    handleTabChange(tab);
    window.setTimeout(() => tabRefs.current[nextIndex]?.focus(), 0);
  };

  const queryString = useMemo(() => {
    const query = new URLSearchParams({ page: String(page), limit: '24' });
    const q = searchParams.get('q');
    if (q) query.set('q', q);
    if (status) query.set('status', status);
    if (tipo) query.set('tipo', tipo);
    if (inicio) query.set('inicio', inicio);
    if (fim) query.set('fim', fim);
    return query.toString();
  }, [fim, inicio, page, searchParams, status, tipo]);

  const demandsQuery = useQuery<EnvironmentalDemandListResponse>({
    queryKey: ['ambiental-demandas', queryString],
    queryFn: () => apiClient.get<EnvironmentalDemandListResponse>(`/api/ambiental?${queryString}`),
    enabled: activeTab === 'ambiental'
  });
  const hasFilters = Boolean(searchParams.get('q') || status || tipo || inicio || fim);
  const activeFilterCount = [searchTerm, status, tipo, inicio, fim].filter(Boolean).length;
  const totalPages = Math.max(1, Math.ceil((demandsQuery.data?.total || 0) / 24));

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['q', 'status', 'tipo', 'inicio', 'fim', 'page'].forEach((key) => next.delete(key));
    next.set('tab', 'ambiental');
    setSearchParams(next);
  };

  const activeHeader = activeTab === 'ambiental'
    ? {
        title: 'Gestão Ambiental e Perícias',
        description: 'Acompanhe processos, laudos, fases e próximas ações ambientais.'
      }
    : activeTab === 'licenciamento'
      ? {
          title: 'Licenciamento Ambiental',
          description: 'Controle licenças, renovações, condicionantes e vencimentos reais.'
        }
      : {
          title: 'Análise preliminar de Reserva Legal',
          description: 'Faça uma triagem quantitativa com base nos arts. 12, 15, 67 e 68 da Lei nº 12.651/2012. O resultado não substitui a análise do CAR pelo órgão competente.'
        };

  return (
    <Layout>
      <PageHeader
        eyebrow="Gestão ambiental"
        title={activeHeader.title}
        description={activeHeader.description}
        descriptionClassName={activeTab === 'car' ? 'max-w-none sm:text-sm 2xl:whitespace-nowrap' : undefined}
        action={
          activeTab === 'ambiental' ? (
            <button
              type="button"
              onClick={() => updateParam('action', 'new')}
              className={headerPrimaryActionButtonClass}
            >
              <span>Nova demanda</span>
              <span aria-hidden="true" className={headerPrimaryActionIconClass}>
                <Plus weight="bold" className="h-3.5 w-3.5" />
              </span>
            </button>
          ) : activeTab === 'licenciamento' ? (
            <button
              type="button"
              onClick={() => setLicenseFormOpen(true)}
              className={headerPrimaryActionButtonClass}
            >
              <span>Nova licença</span>
              <span aria-hidden="true" className={headerPrimaryActionIconClass}>
                <Plus weight="bold" className="h-3.5 w-3.5" />
              </span>
            </button>
          ) : null
        }
        className={activeTab === 'car' ? 'mb-3' : 'mb-4'}
      />

      <div className={cn('relative min-w-0 max-w-full', activeTab === 'car' ? 'mb-3' : 'mb-4')}>
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Módulo Ambiental"
          onScroll={(event) => setTabScrollCues({
            left: event.currentTarget.scrollLeft > 2,
            right: event.currentTarget.scrollWidth - event.currentTarget.clientWidth - event.currentTarget.scrollLeft > 2
          })}
          className={cn(localNavigationBarClass, 'flex scroll-px-3 gap-3')}
        >
        <button
          ref={(element) => { tabRefs.current[0] = element; }}
          id="ambiental-tab-demandas"
          type="button"
          role="tab"
          aria-selected={activeTab === 'ambiental'}
          aria-controls="ambiental-panel-demandas"
          tabIndex={activeTab === 'ambiental' ? 0 : -1}
          onKeyDown={(event) => handleTabKeyDown(event, 0)}
          onClick={() => handleTabChange('ambiental')}
          className={localNavigationButtonClass(activeTab === 'ambiental', 'success')}
        >
          <span aria-hidden="true" className={localNavigationIconClass(activeTab === 'ambiental', 'success', 'overflow-hidden bg-transparent p-0 dark:bg-transparent')}>
            <img src={environmentalDemandsIcon} alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" />
          </span>
          Demandas Ambientais
        </button>
        <button
          ref={(element) => { tabRefs.current[1] = element; }}
          id="ambiental-tab-licenciamento"
          type="button"
          role="tab"
          aria-selected={activeTab === 'licenciamento'}
          aria-controls="ambiental-panel-licenciamento"
          tabIndex={activeTab === 'licenciamento' ? 0 : -1}
          onKeyDown={(event) => handleTabKeyDown(event, 1)}
          onClick={() => handleTabChange('licenciamento')}
          className={localNavigationButtonClass(activeTab === 'licenciamento', 'warning')}
        >
          <span aria-hidden="true" className={localNavigationIconClass(activeTab === 'licenciamento', 'warning', 'overflow-hidden bg-transparent p-0 dark:bg-transparent')}>
            <img src={licensingIcon} alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" />
          </span>
          Licenciamento
        </button>
        <button
          ref={(element) => { tabRefs.current[2] = element; }}
          id="ambiental-tab-car"
          type="button"
          role="tab"
          aria-selected={activeTab === 'car'}
          aria-controls="ambiental-panel-car"
          tabIndex={activeTab === 'car' ? 0 : -1}
          onKeyDown={(event) => handleTabKeyDown(event, 2)}
          onClick={() => handleTabChange('car')}
          className={localNavigationButtonClass(activeTab === 'car', 'field')}
        >
          <span aria-hidden="true" className={localNavigationIconClass(activeTab === 'car', 'field', 'overflow-hidden bg-transparent p-0 dark:bg-transparent')}>
            <img src={carAnalysisIcon} alt="" width={26} height={26} className="h-[26px] w-[26px] object-contain" />
          </span>
          Análise CAR
        </button>
        </div>
        {tabScrollCues.left && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-10 items-center rounded-l-xl bg-gradient-to-r from-white via-white to-transparent pl-2 text-zinc-500 sm:hidden dark:from-zinc-900 dark:via-zinc-900 dark:text-zinc-300">
            <CaretLeft weight="bold" className="h-3.5 w-3.5" />
          </span>
        )}
        {tabScrollCues.right && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end rounded-r-xl bg-gradient-to-l from-white via-white to-transparent pr-2 text-zinc-500 sm:hidden dark:from-zinc-900 dark:via-zinc-900 dark:text-zinc-300">
            <CaretRight weight="bold" className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      <section
        id="ambiental-panel-demandas"
        role="tabpanel"
        aria-labelledby="ambiental-tab-demandas"
        hidden={activeTab !== 'ambiental'}
      >
        <PageFilterBar
          filtersOpen={showFilters}
          onFiltersToggle={() => setShowFilters((current) => !current)}
          onClear={clearFilters}
          activeFilterCount={activeFilterCount}
          filterPanelId={filterPanelId}
          search={
            <div className="relative min-w-0">
              <label htmlFor={searchId} className="sr-only">Buscar demandas ambientais</label>
              <MagnifyingGlass aria-hidden="true" className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input id={searchId} name="buscaAmbiental" type="search" autoComplete="off" value={searchTerm} onChange={(event) => updateParam('q', event.target.value, true)} placeholder="Buscar por demanda, cliente, órgão ou processo…" className={cn(filterSearchInputClass, 'pl-9')} />
            </div>
          }
        >
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Tipo
            <FormSelect name="tipoAmbiental" autoComplete="off" value={tipo} onChange={(event) => updateParam('tipo', event.target.value)} className="geo-native-select mt-1.5 h-10 min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-950">
              <option value="">Todos</option><option value="Ambiental">Ambiental</option><option value="Perícia">Perícia</option>
            </FormSelect>
          </label>
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Status
            <FormSelect name="statusAmbiental" autoComplete="off" value={status} onChange={(event) => updateParam('status', event.target.value)} className="geo-native-select mt-1.5 h-10 min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-950">
              <option value="">Todos</option><option value="Planejamento">Planejamento</option><option value="Em Análise">Em análise</option><option value="Em Andamento">Em andamento</option><option value="Aguardando Órgão">Aguardando órgão</option><option value="Finalizado">Finalizado</option>
            </FormSelect>
          </label>
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Prazo a partir de
            <DatePickerField name="inicioAmbiental" autoComplete="off" value={inicio} onChange={(event) => updateParam('inicio', event.target.value)} className="mt-1.5 h-10 min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-950" />
          </label>
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Prazo até
            <DatePickerField name="fimAmbiental" autoComplete="off" min={inicio || undefined} value={fim} onChange={(event) => updateParam('fim', event.target.value)} className="mt-1.5 h-10 min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs dark:border-zinc-700 dark:bg-zinc-950" />
          </label>
        </PageFilterBar>

        <div aria-live="polite" className="sr-only">{demandsQuery.isLoading ? 'Carregando demandas…' : `${demandsQuery.data?.total || 0} demandas encontradas.`}</div>
        {demandsQuery.isLoading ? (
          <div role="status" className="rounded-2xl border border-zinc-200 bg-white py-14 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">Carregando demandas…</div>
        ) : demandsQuery.isError ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-10 text-center dark:border-red-900/60 dark:bg-red-950/30">
            <WarningCircle aria-hidden="true" className="mx-auto mb-3 h-8 w-8 text-red-600" />
            <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">Não foi possível carregar as demandas</h2>
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">Verifique a conexão com o banco e tente novamente.</p>
            <button type="button" onClick={() => demandsQuery.refetch()} className={cn(secondarySmallActionButtonClass, 'mt-4')}>Tentar novamente</button>
          </div>
        ) : !demandsQuery.data?.items.length ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white py-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <Scales aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <h2 className="text-sm font-medium text-zinc-900 dark:text-white">{hasFilters ? 'Nenhum resultado para os filtros' : 'Nenhuma demanda cadastrada'}</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hasFilters ? 'Ajuste ou limpe os filtros para ampliar a busca.' : 'Use “Nova demanda” para cadastrar uma demanda ambiental ou perícia.'}</p>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className={cn(secondarySmallActionButtonClass, 'mt-4 px-4')}>
                Limpar pesquisa
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">{numberFormatter.format(demandsQuery.data.total)} {demandsQuery.data.total === 1 ? 'demanda encontrada' : 'demandas encontradas'}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {demandsQuery.data.items.map((demand) => (
                <Link key={demand.id} to={`/ambiental/${demand.id}`} className="group flex min-w-0 flex-col rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500/40 dark:focus-visible:ring-offset-zinc-950">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"><Scales aria-hidden="true" weight="duotone" className="h-4 w-4" /></span>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{demand.status || 'Sem status'}</span>
                  </div>
                  <p className="truncate text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">{demand.tipoDemanda || demand.tipo}</p>
                  <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-950 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">{demand.nome}</h2>
                  <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{demand.clienteNome}</p>
                  <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                    <div className="min-w-0"><dt className="text-zinc-400">Órgão / processo</dt><dd className="truncate font-medium text-zinc-700 dark:text-zinc-300">{demand.orgaoAmbiental || demand.protocolo || 'Não informado'}</dd></div>
                    <div className="min-w-0"><dt className="text-zinc-400">Fase</dt><dd className="truncate font-medium text-zinc-700 dark:text-zinc-300">{demand.statusFase || 'Inicial'}</dd></div>
                    <div className="col-span-2 min-w-0"><dt className="text-zinc-400">Próxima ação</dt><dd className="truncate font-medium text-zinc-700 dark:text-zinc-300">{demand.proximaAcao || 'Nenhuma ação programada'}</dd></div>
                  </dl>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-[11px] dark:border-zinc-800">
                    <span className={cn('flex min-w-0 items-center gap-1 font-semibold', deadlineTone(demand.dataEntrega))}><CalendarBlank aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{formatDate(demand.dataEntrega)}</span></span>
                    <span className="flex shrink-0 items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">Abrir <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></span>
                  </div>
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <nav aria-label="Paginação das demandas" className="mt-6 flex items-center justify-between gap-4">
                <button type="button" disabled={page <= 1} onClick={() => updateParam('page', String(page - 1))} className={secondarySmallActionButtonClass}>Anterior</button>
                <span className="text-xs text-zinc-500">Página {page} de {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => updateParam('page', String(page + 1))} className={secondarySmallActionButtonClass}>Próxima</button>
              </nav>
            )}
          </>
        )}
      </section>

      <section id="ambiental-panel-licenciamento" role="tabpanel" aria-labelledby="ambiental-tab-licenciamento" hidden={activeTab !== 'licenciamento'}>
        {activeTab === 'licenciamento' && (
          <Licenciamento
            showHeader={false}
            createModalOpen={licenseFormOpen}
            onCreateModalOpenChange={setLicenseFormOpen}
          />
        )}
      </section>

      <section id="ambiental-panel-car" role="tabpanel" aria-labelledby="ambiental-tab-car" hidden={activeTab !== 'car'}>
        {activeTab === 'car' && <CalculadoraAmbiental embedded showHeader={false} />}
      </section>

      <ProjectFormModal
        isOpen={demandFormOpen}
        onClose={() => updateParam('action', '', true)}
        context="ambiental"
        onSaved={(project) => navigate(`/ambiental/${project.id}`)}
      />
    </Layout>
  );
}
