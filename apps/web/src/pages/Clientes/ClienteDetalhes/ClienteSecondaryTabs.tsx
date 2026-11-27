import { Link, useNavigate } from 'react-router-dom';
import type { LicenseListItem } from '@geogestor/contracts';
import { ClientLoadState } from '../ClientLoadState';
import { clientDeadline, clientOpenBalance, formatClientDate } from '../clientWorkspace';
import type { ReactNode } from 'react';
import {
  Briefcase,
  Buildings,
  Calendar,
  CheckCircle,
  CurrencyDollar,
  FilePdf,
  FileText,
  FolderSimple,
  Leaf,
  MapPin,
  Plus,
  Receipt
} from '@phosphor-icons/react';
import { primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../../../utils/actionStyles';
import { cn } from '../../../utils/cn';
import { geoGreenIconClass, geoGreenLabelClass, geoGreenSurfaceClass, geoGreenValueClass } from '../../../utils/geoTheme';
import { buildBudgetEditorPath } from '../../Orcamentos/budgetNavigation';
import { getBudgetStatusLabel, isApprovedBudgetStatus } from '../../../utils/budgetStatus';
import { ClienteDocumentosTab, type ClienteArquivoItem } from './ClienteDocumentosTab';
import { SharedDataNotice } from '../../../components/SharedDataNotice';
import { ClientDescription } from './ClientDescription';
import { ClientListNoResults, ClientListPagination, ClientTabListTools } from './ClientTabListTools';
import { useClientTabList, type ClientListOrder } from './useClientTabList';
import { clientWorkCounts, clientWorkStatus, compareClientDates, compareClientNumbers } from './clientTabRecords';

type ClienteDetalhesTab = 'visao-geral' | 'propriedades' | 'servicos' | 'ambiental' | 'orcamentos' | 'financeiro' | 'arquivos';

interface ClientePropriedade {
  id: string;
  nome: string;
  areaHa?: number | null;
  matricula?: string | null;
  car?: string | null;
  ccir?: string | null;
  itr?: string | null;
  cidade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  situacaoImovel?: string | null;
}

export interface ClienteProjeto {
  id: string;
  nome: string;
  descricao?: string | null;
  areaHa?: number | null;
  cidade?: string | null;
  municipio?: string | null;
  dataInicio?: string | null;
  dataEntrega?: string | null;
  status?: string | null;
  tipo?: string | null;
}

interface ClienteOrcamento {
  id: string;
  projetoNome?: string | null;
  status?: string | null;
  valorTotal?: number | null;
  codigoOrcamento?: string | null;
  descricao?: string | null;
  formaDePagamento?: string | null;
  desconto?: number | null;
  createdAt?: string | null;
  dataOrcamento?: string | null;
  propriedadeNome?: string | null;
}

interface ClienteSecondaryTabsProps {
  activeTab: ClienteDetalhesTab;
  clienteId: string;
  clienteName: string;
  clientProperties: ClientePropriedade[];
  clientProjetos: ClienteProjeto[];
  clientAmbientalProjetos: ClienteProjeto[];
  clientOrcamentos: ClienteOrcamento[];
  clientLicenses: LicenseListItem[];
  loadingLicenses: boolean;
  licensesError: boolean;
  onRetryLicenses: () => void;
  focusedOrcamentoId: string | null;
  clientFinancialKpis: Record<string, unknown>;
  orcamentosPorStatus: Record<string, { count: number; total: number }>;
  focusedDocumentId: string | null;
  initialDocumentSearch: string;
  onPreviewFile: (file: ClienteArquivoItem) => void;
  onCreateProperty: () => void;
  onOpenProperty: (propertyId: string) => void;
  onCreateEnvironmentalProject: () => void;
  onCreateService: () => void;
  renderEnvironmentalProjectLink: (project: ClienteProjeto) => ReactNode;
  renderProjectTitleLink: (project: ClienteProjeto) => ReactNode;
  renderProjectDetailsLink: (project: ClienteProjeto) => ReactNode;
}

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

const propertyStatus = (property: ClientePropriedade) => property.situacaoImovel?.trim() ? property.situacaoImovel : 'Situação não informada';
const projectStatus = (project: ClienteProjeto) => clientWorkStatus(project.status).label;
const budgetStatus = (budget: ClienteOrcamento) => getBudgetStatusLabel(budget.status);
const budgetId = (budget: ClienteOrcamento) => budget.id;
const propertyFields = (property: ClientePropriedade) => [property.nome, property.matricula, property.car, property.ccir, property.itr, property.cidade, property.municipio, property.uf, propertyStatus(property)];
const projectFields = (project: ClienteProjeto) => [project.nome, project.descricao, project.tipo, project.cidade, project.municipio, project.dataInicio, project.dataEntrega, projectStatus(project)];
const budgetFields = (budget: ClienteOrcamento) => [budget.id, budget.codigoOrcamento, budget.descricao, budget.projetoNome, budget.propriedadeNome, budgetStatus(budget)];
const propertyOrders: ClientListOrder<ClientePropriedade>[] = [
  { value: 'original', label: 'Ordem original' },
  { value: 'nome', label: 'Nome (A–Z)', compare: (a,b)=>a.nome.localeCompare(b.nome,'pt-BR') },
  { value: 'area', label: 'Área crescente', compare: (a,b)=>compareClientNumbers(a.areaHa,b.areaHa) },
  { value: 'area-desc', label: 'Área decrescente', compare: (a,b)=>compareClientNumbers(a.areaHa,b.areaHa,true) }
];
const projectOrders: ClientListOrder<ClienteProjeto>[] = [
  { value: 'original', label: 'Ordem original' },
  { value: 'nome', label: 'Nome (A–Z)', compare: (a,b)=>a.nome.localeCompare(b.nome,'pt-BR') },
  { value: 'prazo', label: 'Prazo mais próximo', compare: (a,b)=>compareClientDates(a.dataEntrega,b.dataEntrega) },
  { value: 'inicio', label: 'Início mais recente', compare: (a,b)=>compareClientDates(a.dataInicio,b.dataInicio,true) }
];
const budgetOrders: ClientListOrder<ClienteOrcamento>[] = [
  { value: 'original', label: 'Ordem original' },
  { value: 'codigo', label: 'Código (A–Z)', compare: (a,b)=>(a.codigoOrcamento||a.id).localeCompare(b.codigoOrcamento||b.id,'pt-BR') },
  { value: 'valor', label: 'Valor crescente', compare: (a,b)=>compareClientNumbers(a.valorTotal,b.valorTotal) },
  { value: 'valor-desc', label: 'Valor decrescente', compare: (a,b)=>compareClientNumbers(a.valorTotal,b.valorTotal,true) },
  { value: 'data', label: 'Emissão ou criação mais recente', compare: (a,b)=>compareClientDates(a.dataOrcamento||a.createdAt,b.dataOrcamento||b.createdAt,true) }
];
const WorkBadge = ({ status }: { status?: string | null }) => {
  const presentation = clientWorkStatus(status);
  return <span className={'max-w-full break-words rounded-full px-2.5 py-1 text-xs font-semibold ' + presentation.badgeClass}>{presentation.label}</span>;
};

export function ClienteSecondaryTabs({
  activeTab,
  clienteId: id,
  clientProperties,
  clientProjetos,
  clientAmbientalProjetos,
  clientOrcamentos,
  clientLicenses,
  loadingLicenses,
  licensesError,
  onRetryLicenses,
  focusedOrcamentoId,
  clientFinancialKpis,
  orcamentosPorStatus,
  focusedDocumentId,
  initialDocumentSearch,
  onPreviewFile,
  onCreateProperty,
  onOpenProperty,
  onCreateEnvironmentalProject,
  onCreateService,
  renderEnvironmentalProjectLink,
  renderProjectTitleLink,
  renderProjectDetailsLink
}: ClienteSecondaryTabsProps) {
  const navigate = useNavigate();
  const balance = clientOpenBalance(clientFinancialKpis);
  const propertiesList = useClientTabList({ prefix: 'imoveis', items: clientProperties, fields: propertyFields, status: propertyStatus, orders: propertyOrders });
  const servicesList = useClientTabList({ prefix: 'servicos', items: clientProjetos, fields: projectFields, status: projectStatus, orders: projectOrders });
  const environmentalList = useClientTabList({ prefix: 'ambiental', items: clientAmbientalProjetos, fields: projectFields, status: projectStatus, orders: projectOrders });
  const budgetsList = useClientTabList({ prefix: 'orcamentos', items: clientOrcamentos, fields: budgetFields, status: budgetStatus, orders: budgetOrders, focusId: focusedOrcamentoId, recordId: budgetId });
  const environmentalCounts = clientWorkCounts(clientAmbientalProjetos);

  return (
    <>
      {/* Tab Contents */}
      {activeTab !== 'visao-geral' && (
      <div
        id={`cliente-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`cliente-tab-${activeTab}`}
        className="client-workspace-panel min-h-[300px] xl:col-span-2 xl:col-start-1"
      >
        {activeTab === 'propriedades' && (
          <section className="space-y-5" aria-labelledby="properties-tab-title">
            <div className="client-tab-heading gap-3 border-b border-zinc-200 pb-5 dark:border-zinc-800">
              <div>
                <h2 id="properties-tab-title" className="text-xl font-semibold text-zinc-950 dark:text-white">Propriedades do cliente</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Consulte os imóveis, suas áreas e os registros fundiários vinculados ao cliente.</p>
              </div>
              <button type="button" onClick={onCreateProperty} className={primarySmallActionButtonClass}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Cadastrar propriedade
              </button>
            </div>
            <ClientTabListTools list={propertiesList} noun="propriedades" searchHint="Nome, matrícula, CAR, CCIR, ITR, cidade, município, UF ou situação." searchExample="Ex.: Araucárias ou 12345" />
            {clientProperties.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
                <Buildings className="mx-auto h-10 w-10 text-zinc-500" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-zinc-950 dark:text-white">Nenhuma propriedade cadastrada</h3>
                <p className="mx-auto mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">Cadastre o primeiro imóvel para relacionar serviços, mapas e registros fundiários corretamente.</p>
              </div>
            ) : !propertiesList.found ? <ClientListNoResults onClear={propertiesList.clearFilters} /> : (
              <div className="client-property-grid">
                {propertiesList.rows.map((property) => (
                  <article key={property.id} data-client-record-id={property.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="client-record-heading gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-semibold text-zinc-950 dark:text-white">{property.nome}</h3>
                        <p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-300">{[property.cidade, property.municipio, property.uf].filter(Boolean).join(' / ') || 'Município/UF não informados'}</p>
                      </div>
                      {property.situacaoImovel && <span className="max-w-full rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{property.situacaoImovel}</span>}
                    </div>
                    <dl className="client-property-details mt-4 gap-3 text-sm">
                      <div><dt className="text-zinc-500 dark:text-zinc-400">Área</dt><dd className="font-semibold tabular-nums text-zinc-950 dark:text-white">{property.areaHa != null ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(property.areaHa)} ha` : 'Não informada'}</dd></div>
                      {[['Matrícula', property.matricula], ['CAR', property.car], ['CCIR', property.ccir], ['ITR', property.itr]].map(([label, value]) => <div key={label}><dt className="text-zinc-500 dark:text-zinc-400">{label}</dt><dd className="break-words font-semibold text-zinc-950 dark:text-white">{value || 'Não informado'}</dd></div>)}
                    </dl>
                    <button type="button" onClick={() => onOpenProperty(property.id)} className={cn(secondarySmallActionButtonClass, 'mt-4')}>Abrir propriedade</button>
                  </article>
                ))}
              </div>
            )}
            <ClientListPagination list={propertiesList} noun="propriedades" />
          </section>
        )}
        {activeTab === 'ambiental' && (
          <div className="space-y-5">
            <div className="client-tab-heading gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                    <Leaf weight="duotone" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Gestão ambiental do cliente</h2>
                    <p className="mt-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Trabalhos ambientais vinculados ao cliente. As licenças cadastradas estão na seção abaixo.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCreateEnvironmentalProject}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white shadow-sm transition-[background-color,box-shadow] duration-200 hover:bg-emerald-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
              >
                <Plus weight="bold" className="h-4 w-4" aria-hidden="true" />
                Nova demanda ambiental
              </button>
            </div>

            <div className="client-environment-metrics">
              {[
                ['Demandas vinculadas', clientAmbientalProjetos.length],
                ['Em andamento', environmentalCounts.active],
                ['Concluídas', environmentalCounts.completed]
              ].map(([label, value]) => (
                <div key={label} className={cn(geoGreenSurfaceClass, 'rounded-2xl p-5 shadow-sm')}>
                  <p className={cn('text-xs font-semibold', geoGreenLabelClass)}>{label}</p>
                  <p className={cn('mt-2 text-2xl font-bold tabular-nums', geoGreenValueClass)}>{value}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Suspensas ou pausadas: {environmentalCounts.paused} · Canceladas: {environmentalCounts.cancelled} · Outras situações: {environmentalCounts.other}</p>
            <ClientTabListTools list={environmentalList} noun="demandas ambientais" searchHint="Nome, descrição, tipo, cidade, município, datas de início e entrega (AAAA-MM-DD) ou situação." searchExample="Ex.: acompanhamento do CAR" />

            {clientAmbientalProjetos.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
                <Leaf weight="duotone" className="mb-3 h-10 w-10 text-emerald-500" />
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Nenhuma demanda ambiental vinculada</h3>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Use “Nova demanda ambiental” para cadastrar o primeiro trabalho ambiental deste cliente.
                </p>
              </div>
            ) : !environmentalList.found ? <ClientListNoResults onClear={environmentalList.clearFilters} /> : (
              <div className="client-property-grid">
                {environmentalList.rows.map((project) => (
                  <article key={project.id} data-client-record-id={project.id} className="flex min-w-0 flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-emerald-400/60 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="client-record-heading gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-300">{project.tipo || 'Ambiental'}</p>
                        <h3 className="mt-1 break-words text-base font-semibold text-zinc-950 dark:text-white">{project.nome}</h3>
                      </div>
                      <WorkBadge status={project.status} />
                    </div>
                    <ClientDescription text={project.descricao} />
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        {clientDeadline(project.dataEntrega, !clientWorkStatus(project.status).hasActiveDeadline)}
                      </span>
                      {renderEnvironmentalProjectLink(project)}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <ClientListPagination list={environmentalList} noun="demandas ambientais" />
          </div>
        )}

        {activeTab === 'ambiental' && <section className="mt-6 space-y-3" aria-labelledby="client-licenses-title">
          <h2 id="client-licenses-title" className="text-lg font-semibold text-zinc-950 dark:text-white">Licenças vinculadas</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Situação e vencimento da licença são distintos do andamento do trabalho.</p>
          {loadingLicenses || licensesError ? <ClientLoadState label="as licenças" error={licensesError} onRetry={onRetryLicenses} /> : !clientLicenses.length ? <p className="text-sm text-zinc-600 dark:text-zinc-300">Nenhuma licença cadastrada para este cliente.</p> : clientLicenses.map(license => <article key={license.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
            <h3 className="font-semibold text-zinc-950 dark:text-white">{license.numero}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{license.orgao} · {license.status}</p>
            <p className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Vencimento: {formatClientDate(license.dataVencimento)}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Trabalho: {license.projetoNome}</p>
            <Link to={`/ambiental/licencas/${license.id}`} className={secondarySmallActionButtonClass + ' mt-3 min-h-11'}>Consultar licença</Link>
          </article>)}
        </section>}
        {activeTab === 'servicos' && (
          <section className="space-y-4" aria-labelledby="services-tab-title">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="services-tab-title" className="text-xl font-semibold text-zinc-950 dark:text-white">Serviços do cliente</h2><button type="button" onClick={onCreateService} className={primarySmallActionButtonClass}>Novo serviço</button></div><p className="text-sm text-zinc-600 dark:text-zinc-300">Esta lista reúne todos os trabalhos. Demandas ambientais também aparecem na aba Ambiental, com acesso ao mesmo registro.</p>
            <ClientTabListTools list={servicesList} noun="serviços" searchHint="Nome, descrição, tipo, cidade, município, datas de início e entrega (AAAA-MM-DD) ou situação." searchExample="Ex.: planialtimétrico" />
            {clientProjetos.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
                <FolderSimple weight="duotone" className="mb-3 h-10 w-10 text-indigo-500" />
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Nenhum serviço vinculado</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Cadastre o primeiro serviço deste cliente.</p>
              </div>
            ) : !servicesList.found ? <ClientListNoResults onClear={servicesList.clearFilters} /> : (
              servicesList.rows.map((proj) => (
                <div
                  key={proj.id}
                  data-client-record-id={proj.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 rounded-2xl p-6 shadow-sm transition-[background-color,border-color,box-shadow] client-service-row"
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                      proj.tipo === 'Georreferenciamento' ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/60 dark:border-indigo-800/60' :
                      proj.tipo === 'Topografia' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/60' :
                      proj.tipo === 'CAR' ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/60' :
                      proj.tipo === 'Usucapião' ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-200/60 dark:border-violet-800/60' :
                      proj.tipo === 'Retificação' ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200/60 dark:border-teal-800/60' :
                      'bg-sky-50 dark:bg-sky-950/40 border-sky-200/60 dark:border-sky-800/60'
                    }`}>
                      <FolderSimple weight="duotone" className={`w-6 h-6 ${
                        proj.tipo === 'Georreferenciamento' ? 'text-indigo-500 dark:text-indigo-400' :
                        proj.tipo === 'Topografia' ? 'text-emerald-500 dark:text-emerald-400' :
                        proj.tipo === 'CAR' ? 'text-amber-500 dark:text-amber-400' :
                        proj.tipo === 'Usucapião' ? 'text-violet-500 dark:text-violet-400' :
                        proj.tipo === 'Retificação' ? 'text-teal-500 dark:text-teal-400' :
                        'text-sky-500 dark:text-sky-400'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-zinc-950 dark:text-white hover:underline">
                        {renderProjectTitleLink(proj)}
                      </h3>
                      <ClientDescription text={proj.descricao} />

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                        {proj.areaHa != null && (
                          <span className="font-semibold tabular-nums text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded">
                            {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(proj.areaHa)} ha
                          </span>
                        )}
                        {proj.cidade && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {proj.cidade} - {proj.municipio || ''}
                          </span>
                        )}
                        {proj.dataInicio && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Início: {formatClientDate(proj.dataInicio)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <WorkBadge status={proj.status} />
                    {renderProjectDetailsLink(proj)}
                  </div>
                </div>
              ))
            )}
            <ClientListPagination list={servicesList} noun="serviços" />
          </section>
        )}

        {activeTab === 'orcamentos' && (
          <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold text-zinc-950 dark:text-white">Orçamentos do cliente</h2><button type="button" onClick={() => navigate(buildBudgetEditorPath({ clientId: id }))} className={primarySmallActionButtonClass}>Novo orçamento</button></div>
            <ClientTabListTools list={budgetsList} noun="orçamentos" searchHint="Código, identificador, descrição, projeto, propriedade ou situação." searchExample="Ex.: ORC-2026 ou levantamento" />
            {clientOrcamentos.length === 0 ? (
              <div className="text-center py-16 bg-zinc-50/50 dark:bg-zinc-900/50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-500 dark:text-zinc-400 font-medium">Nenhum orçamento emitido para este cliente.</p>
              </div>
            ) : !budgetsList.found ? <ClientListNoResults onClear={budgetsList.clearFilters} /> : (
              budgetsList.rows.map((orc) => {
                const isFocusedOrcamento = focusedOrcamentoId === orc.id;
                return (
                <div
                  key={orc.id}
                  data-client-record-id={orc.id}
                  className={`client-budget-row bg-white dark:bg-[radial-gradient(circle_at_0%_0%,rgba(245,158,11,0.12),rgba(39,39,42,0.96)_42%,rgba(24,24,27,0.98)_100%)] border hover:border-amber-300/60 rounded-2xl p-6 shadow-sm transition-[border-color,box-shadow,filter] duration-200 gap-6 ${
                    isFocusedOrcamento
                      ? 'border-amber-300 ring-2 ring-amber-400/20 dark:border-amber-400/50'
                      : 'border-zinc-100 dark:border-amber-300/15'
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center flex-shrink-0">
                      <FilePdf weight="duotone" className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">
                          {orc.codigoOrcamento || 'Orçamento'}
                        </h3>
                        <span className="text-zinc-600 dark:text-zinc-300 text-xs">•</span>
                        <span className="font-bold text-amber-700 dark:text-amber-300">{formatCurrency(orc.valorTotal ?? 0)}</span>
                      </div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">{orc.descricao || 'Sem descrição.'}</p>
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mt-1">
                        {orc.projetoNome ? `Trabalho: ${orc.projetoNome}` : 'Orçamento geral do cliente'}{orc.propriedadeNome && <span className="block">Imóvel: {orc.propriedadeNome}</span>}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                        {orc.formaDePagamento && (
                          <span>Pagt: <strong className="text-zinc-500 dark:text-zinc-400 font-semibold">{orc.formaDePagamento}</strong></span>
                        )}
                        {typeof orc.desconto === 'number' && orc.desconto > 0 && (
                          <span className="text-emerald-800 dark:text-emerald-300 font-medium">Desconto: {formatCurrency(orc.desconto)}</span>
                        )}
                        <span>{orc.dataOrcamento ? `Emitido em: ${formatClientDate(orc.dataOrcamento)}` : `Criado em: ${formatClientDate(orc.createdAt)}`}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${
                      isApprovedBudgetStatus(orc.status) ? 'bg-blue-50 text-blue-700 ring-blue-600/10' :
                      orc.status === 'Rejeitado' ? 'bg-red-50 text-red-700 ring-red-600/10' :
                      'bg-amber-50 text-amber-700 ring-amber-600/10'
                    }`}>
                      {getBudgetStatusLabel(orc.status)}
                    </span>

                    <button type="button"
                      onClick={() => navigate(buildBudgetEditorPath({ budgetId: orc.id }))}
                      className="geo-focus-ring p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950 rounded-xl text-zinc-600 dark:text-zinc-300 transition-[background-color,border-color,color,box-shadow,transform] flex items-center justify-center gap-1.5 text-xs font-semibold"
                      title="Abrir este orçamento"
                    >
                      <FileText aria-hidden="true" className="w-4 h-4" /> Abrir orçamento
                    </button>
                  </div>
                </div>
                );
              })
            )}
            <ClientListPagination list={budgetsList} noun="orçamentos" />
          </div>
        )}

        {activeTab === 'financeiro' && (
          <div className="space-y-6"><h2 className="text-xl font-semibold text-zinc-950 dark:text-white">Financeiro do cliente</h2>
            <SharedDataNotice preferenceKey="client-finance-shared-data">
              Este é o consolidado financeiro do cliente. Despesas e recebimentos vinculados aos projetos aparecem aqui automaticamente; editar um lançamento em qualquer contexto atualiza o mesmo registro.
            </SharedDataNotice>
            <div className="client-finance-grid">
              {[
                {
                  label: 'Valor contratado',
                  value: formatCurrency(Number(clientFinancialKpis.valorContratado) || 0),
                  helper: 'Orçamentos aprovados ou pagos',
                  icon: <CurrencyDollar weight="duotone" className="h-5 w-5" />,
                  card: geoGreenSurfaceClass,
                  accent: geoGreenIconClass,
                  valueClass: geoGreenValueClass,
                  glow: undefined
                },
                {
                  label: 'Recebido no caixa',
                  value: formatCurrency(Number(clientFinancialKpis.valorRecebido) || 0),
                  helper: 'Recebimentos ativos vinculados ao cliente',
                  icon: <Briefcase weight="duotone" className="h-5 w-5" />,
                  card: geoGreenSurfaceClass,
                  accent: geoGreenIconClass,
                  valueClass: geoGreenValueClass,
                  glow: undefined
                },
                {
                  label: 'Saldo a receber',
                  value: formatCurrency(balance.total),
                  helper: `A vencer: ${formatCurrency(balance.due)} · Vencido: ${formatCurrency(balance.overdue)}`,
                  icon: <Receipt weight="duotone" className="h-5 w-5" />,
                  card: geoGreenSurfaceClass,
                  accent: geoGreenIconClass,
                  valueClass: geoGreenValueClass,
                  glow: undefined
                },
                {
                  label: 'Resultado de caixa',
                  value: formatCurrency(Number(clientFinancialKpis.resultadoCaixa) || 0),
                  helper: 'Recebido menos despesas pagas',
                  icon: <CheckCircle weight="duotone" className="h-5 w-5" />,
                  card: geoGreenSurfaceClass,
                  accent: geoGreenIconClass,
                  valueClass: geoGreenValueClass,
                  glow: undefined
                }
              ].map((metric) => (
                <article
                  key={metric.label}
                  className={cn(
                    'relative flex min-h-[118px] overflow-hidden rounded-2xl border p-5 text-white shadow-sm ring-1 transition-[border-color,box-shadow,filter] duration-200 hover:brightness-110 hover:shadow-[0_18px_36px_-28px_rgba(0,0,0,0.8)]',
                    metric.card
                  )}
                  style={metric.glow ? { background: metric.glow } : undefined}
                >
                  <div className="relative flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1', metric.accent)}>
                        {metric.icon}
                      </span>
                      <p className={cn('min-w-0 text-sm font-bold uppercase tracking-wide', metric.card === geoGreenSurfaceClass ? geoGreenLabelClass : 'text-zinc-400')}>
                        {metric.label}
                      </p>
                    </div>
                    <div>
                      <p className={cn('break-words text-2xl font-bold tracking-tight', metric.valueClass)}>
                        {metric.value}
                      </p>
                      <p className={cn('mt-1.5 text-sm font-medium leading-4', metric.card === geoGreenSurfaceClass ? 'text-emerald-100' : 'text-zinc-400')}>
                        {metric.helper}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"><summary className="geo-focus-ring min-h-11 cursor-pointer rounded py-2 font-semibold text-zinc-800 dark:text-zinc-200">Detalhar indicadores financeiros</summary><div className="client-finance-grid mt-4">
              {[
                ['Valor orçado', formatCurrency(Number(clientFinancialKpis.valorOrcado) || 0)],
                ['Valor executado informado', clientFinancialKpis.execucaoInformada
                  ? formatCurrency(Number(clientFinancialKpis.valorExecutadoInformado) || 0)
                  : 'Não informado'],
                ['Documentos fiscais informados', formatCurrency(Number(clientFinancialKpis.valorFaturado) || 0)],
                ['Saldo vencido', formatCurrency(Number(clientFinancialKpis.valorVencido) || 0)],
                ['Despesas lançadas', formatCurrency(Number(clientFinancialKpis.despesasValor) || 0)],
                ['Despesas pagas', formatCurrency(Number(clientFinancialKpis.despesasPagas) || 0)],
                ['Despesas reembolsáveis', formatCurrency(Number(clientFinancialKpis.despesasReembolsaveis) || 0)],
                ['Impostos estimados', formatCurrency(Number(clientFinancialKpis.impostosEstimados) || 0)],
                ['Créditos registrados', formatCurrency(Number(clientFinancialKpis.creditos) || 0)],
                ['Devoluções registradas', formatCurrency(Number(clientFinancialKpis.devolucoes) || 0)]
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-zinc-950 dark:text-white">{value}</p>
                </div>
              ))}
            </div></details>

            {!clientOrcamentos.length && <p className="text-sm text-zinc-600 dark:text-zinc-300">Não há orçamentos vinculados. <Link className="geo-focus-ring inline-flex min-h-11 items-center rounded underline" to={buildBudgetEditorPath({ clientId: id })}>Criar orçamento</Link></p>}
            <div className="client-property-grid">
              <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-800/75">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">Resumo por status</h3>
                  <span className="rounded-full bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-500 ring-1 ring-zinc-900/5 dark:bg-zinc-700/70 dark:text-zinc-200 dark:ring-white/10">
                    {clientOrcamentos.length} orçamento(s)
                  </span>
                </div>
                {clientOrcamentos.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
                    <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nenhum orçamento financeiro vinculado a este cliente.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(orcamentosPorStatus).map(([statusName, item]) => (
                      <div key={statusName} className="flex flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50/45 p-4 dark:border-zinc-700/70 dark:bg-zinc-900/45 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                            statusName === 'Pago' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-400/20' :
                            statusName === 'Aprovado' ? 'bg-blue-50 text-blue-700 ring-blue-600/10 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-400/20' :
                            statusName === 'Rejeitado' ? 'bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-400/20' :
                            'bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-400/20'
                          }`}>
                            {getBudgetStatusLabel(statusName)}
                          </span>
                          <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">{item.count} registro(s)</p>
                        </div>
                        <p className="text-lg font-bold text-zinc-950 dark:text-white">{formatCurrency(item.total)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-800/75">
                <h3 className="mb-4 text-lg font-semibold text-zinc-950 dark:text-white">Últimos orçamentos</h3>
                <div className="space-y-3">
                  {clientOrcamentos.slice(0, 5).map((orc) => (
                    <div key={orc.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700/60 dark:bg-zinc-900/55">
                      <div className="flex items-center justify-between gap-3">
                        <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">{orc.codigoOrcamento || 'Orçamento'}</p>
                        <p className="text-sm font-bold text-zinc-950 dark:text-white">{formatCurrency(orc.valorTotal ?? 0)}</p>
                      </div>
                      <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{getBudgetStatusLabel(orc.status)}</p>
                    </div>
                  ))}
                  {clientOrcamentos.length === 0 && (
                    <p className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm font-medium text-zinc-500 dark:border-zinc-700/60 dark:bg-zinc-900/55 dark:text-zinc-300">
                      Sem movimentação financeira para exibir.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'arquivos' && (
  <ClienteDocumentosTab
    clienteId={id!}
    focusedDocumentId={focusedDocumentId}
    initialSearchTerm={initialDocumentSearch}
    onPreviewFile={onPreviewFile}
  />
        )}
      </div>
      )}

    </>
  );
}
