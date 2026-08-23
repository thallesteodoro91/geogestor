import { useNavigate } from 'react-router-dom';
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
}

interface ClienteSecondaryTabsProps {
  activeTab: ClienteDetalhesTab;
  clienteId: string;
  clienteName: string;
  clientProperties: ClientePropriedade[];
  clientProjetos: ClienteProjeto[];
  clientAmbientalProjetos: ClienteProjeto[];
  clientOrcamentos: ClienteOrcamento[];
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

const formatOptionalDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

const isDone = (status?: string | null) => status === 'Concluído' || status === 'Finalizado';

export function ClienteSecondaryTabs({
  activeTab,
  clienteId: id,
  clienteName,
  clientProperties,
  clientProjetos,
  clientAmbientalProjetos,
  clientOrcamentos,
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
  const cliente = { nome: clienteName };

  return (
    <>
      {/* Tab Contents */}
      {activeTab !== 'visao-geral' && (
      <div
        id={`cliente-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`cliente-tab-${activeTab}`}
        className="min-h-[300px] xl:col-span-2 xl:col-start-1"
      >
        {activeTab === 'propriedades' && (
          <section className="space-y-5" aria-labelledby="properties-tab-title">
            <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="properties-tab-title" className="text-xl font-semibold text-zinc-950 dark:text-white">Propriedades do cliente</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Imóveis estruturados, sem confundir propriedade com serviço ou projeto.</p>
              </div>
              <button type="button" onClick={onCreateProperty} className={primarySmallActionButtonClass}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Cadastrar propriedade
              </button>
            </div>
            {clientProperties.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
                <Buildings className="mx-auto h-10 w-10 text-zinc-500" aria-hidden="true" />
                <h3 className="mt-3 text-base font-semibold text-zinc-950 dark:text-white">Nenhuma propriedade cadastrada</h3>
                <p className="mx-auto mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">Cadastre o primeiro imóvel para relacionar serviços, mapas e registros fundiários corretamente.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {clientProperties.map((property) => (
                  <article key={property.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-semibold text-zinc-950 dark:text-white">{property.nome}</h3>
                        <p className="mt-1 break-words text-sm text-zinc-600 dark:text-zinc-300">{[property.cidade, property.municipio, property.uf].filter(Boolean).join(' / ') || 'Município/UF não informados'}</p>
                      </div>
                      {property.situacaoImovel && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">{property.situacaoImovel}</span>}
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-zinc-500 dark:text-zinc-400">Área</dt><dd className="font-semibold tabular-nums text-zinc-950 dark:text-white">{property.areaHa != null ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(property.areaHa)} ha` : 'Não informada'}</dd></div>
                      {[['Matrícula', property.matricula], ['CAR', property.car], ['CCIR', property.ccir], ['ITR', property.itr]].map(([label, value]) => <div key={label}><dt className="text-zinc-500 dark:text-zinc-400">{label}</dt><dd className="break-words font-semibold text-zinc-950 dark:text-white">{value || 'Não informado'}</dd></div>)}
                    </dl>
                    <button type="button" onClick={() => onOpenProperty(property.id)} className={cn(secondarySmallActionButtonClass, 'mt-4')}>Abrir propriedade</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {activeTab === 'ambiental' && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                    <Leaf weight="duotone" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Gestão ambiental do cliente</h2>
                    <p className="mt-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Demandas, perícias e licenciamentos vinculados exclusivamente a {cliente.nome}.
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCreateEnvironmentalProject}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition-[background-color,box-shadow] duration-200 hover:bg-emerald-500 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
              >
                <Plus weight="bold" className="h-4 w-4" aria-hidden="true" />
                Nova demanda ambiental
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                ['Demandas vinculadas', clientAmbientalProjetos.length],
                ['Em andamento', clientAmbientalProjetos.filter((project) => !isDone(project.status)).length],
                ['Concluídas', clientAmbientalProjetos.filter((project) => isDone(project.status)).length]
              ].map(([label, value]) => (
                <div key={label} className={cn(geoGreenSurfaceClass, 'rounded-2xl p-5 shadow-sm')}>
                  <p className={cn('text-xs font-semibold', geoGreenLabelClass)}>{label}</p>
                  <p className={cn('mt-2 text-2xl font-bold tabular-nums', geoGreenValueClass)}>{value}</p>
                </div>
              ))}
            </div>

            {clientAmbientalProjetos.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
                <Leaf weight="duotone" className="mb-3 h-10 w-10 text-emerald-500" />
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Nenhuma demanda ambiental vinculada</h3>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Cadastre a primeira demanda, licença ou perícia ambiental deste cliente.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {clientAmbientalProjetos.map((project) => (
                  <article key={project.id} className="flex min-w-0 flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-emerald-400/60 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-300">{project.tipo || 'Ambiental'}</p>
                        <h3 className="mt-1 truncate text-base font-semibold text-zinc-950 dark:text-white">{project.nome}</h3>
                      </div>
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {project.status || 'Em andamento'}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {project.descricao || 'Sem descrição cadastrada.'}
                    </p>
                    <div className="mt-5 flex items-center justify-between gap-4 border-t border-zinc-100 pt-4 text-xs dark:border-zinc-800">
                      <span className="text-zinc-500 dark:text-zinc-400">
                        Prazo: {project.dataEntrega ? formatOptionalDate(project.dataEntrega) : 'Não definido'}
                      </span>
                      {renderEnvironmentalProjectLink(project)}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'servicos' && (
          <div className="space-y-4">
            {clientProjetos.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
                <FolderSimple weight="duotone" className="mb-3 h-10 w-10 text-indigo-500" />
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Nenhum serviço vinculado</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Cadastre o primeiro serviço deste cliente.</p>
                <button
                  type="button"
                  onClick={onCreateService}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Novo serviço
                </button>
              </div>
            ) : (
              clientProjetos.map((proj) => (
                <div 
                  key={proj.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 rounded-2xl p-6 shadow-sm transition-[background-color,border-color,box-shadow,transform] flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="flex items-start gap-4">
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
                    <div>
                      <h4 className="text-lg font-semibold text-zinc-950 dark:text-white hover:underline">
                        {renderProjectTitleLink(proj)}
                      </h4>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5 line-clamp-1">{proj.descricao || 'Sem descrição cadastrada.'}</p>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-zinc-400">
                        {proj.areaHa && (
                          <span className="font-semibold text-zinc-600 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded">
                            {proj.areaHa} ha
                          </span>
                        )}
                        {proj.cidade && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" /> {proj.cidade} - {proj.municipio || ''}
                          </span>
                        )}
                        {proj.dataInicio && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> Início: {new Date(proj.dataInicio).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${
                      proj.status === 'Concluído' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/10' :
                      proj.status === 'Em Andamento' ? 'bg-blue-50 text-blue-700 ring-blue-600/10' :
                      'bg-amber-50 text-amber-700 ring-amber-600/10'
                    }`}>
                      {proj.status}
                    </span>
                    {renderProjectDetailsLink(proj)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'orcamentos' && (
          <div className="space-y-4">
            {clientOrcamentos.length === 0 ? (
              <div className="text-center py-16 bg-zinc-50/50 dark:bg-zinc-900/50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                <p className="text-zinc-500 dark:text-zinc-400 font-medium">Nenhum orçamento emitido para este cliente.</p>
                <button 
                  onClick={() => navigate(buildBudgetEditorPath({ clientId: id }))}
                  className="mt-4 px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950 rounded-xl text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform]"
                >
                  Gerar Orçamento
                </button>
              </div>
            ) : (
              clientOrcamentos.map((orc) => {
                const isFocusedOrcamento = focusedOrcamentoId === orc.id;
                return (
                <div 
                  key={orc.id}
                  className={`bg-white dark:bg-[radial-gradient(circle_at_0%_0%,rgba(245,158,11,0.12),rgba(39,39,42,0.96)_42%,rgba(24,24,27,0.98)_100%)] border hover:border-amber-300/60 rounded-2xl p-6 shadow-sm transition-[border-color,box-shadow,filter] duration-200 flex flex-col md:flex-row md:items-center justify-between gap-6 ${
                    isFocusedOrcamento
                      ? 'border-amber-300 ring-2 ring-amber-400/20 dark:border-amber-400/50'
                      : 'border-zinc-100 dark:border-amber-300/15'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 flex items-center justify-center flex-shrink-0">
                      <FilePdf weight="duotone" className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold text-zinc-950 dark:text-white">
                          {orc.codigoOrcamento || 'Orçamento'}
                        </h4>
                        <span className="text-zinc-400 text-xs">•</span>
                        <span className="font-bold text-amber-700 dark:text-amber-300">{formatCurrency(orc.valorTotal ?? 0)}</span>
                      </div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">{orc.descricao || 'Sem descrição.'}</p>
                      <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                        {orc.projetoNome ? `Propriedade: ${orc.projetoNome}` : 'Orcamento geral do cliente'}
                      </p>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-zinc-400">
                        {orc.formaDePagamento && (
                          <span>Pagt: <strong className="text-zinc-500 dark:text-zinc-400 font-semibold">{orc.formaDePagamento}</strong></span>
                        )}
                        {typeof orc.desconto === 'number' && orc.desconto > 0 && (
                          <span className="text-emerald-600 font-medium">Desconto: {formatCurrency(orc.desconto)}</span>
                        )}
                        <span>Emitido em: {orc.createdAt ? new Date(orc.createdAt).toLocaleDateString('pt-BR') : 'Sem data'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${
                      isApprovedBudgetStatus(orc.status) ? 'bg-blue-50 text-blue-700 ring-blue-600/10' :
                      orc.status === 'Rejeitado' ? 'bg-red-50 text-red-700 ring-red-600/10' :
                      'bg-amber-50 text-amber-700 ring-amber-600/10'
                    }`}>
                      {getBudgetStatusLabel(orc.status)}
                    </span>
                    
                    {/* Local PDF generation could go here, or simple alert/download */}
                    <button 
                      onClick={() => navigate(buildBudgetEditorPath({ clientId: id }))}
                      className="p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950 rounded-xl text-zinc-600 transition-[background-color,border-color,color,box-shadow,transform] flex items-center justify-center gap-1.5 text-xs font-semibold"
                      title="Gerenciar Orçamentos"
                    >
                      <Plus className="w-4 h-4" /> Gerenciar
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  value: formatCurrency(Number(clientFinancialKpis.valorPendente) || 0),
                  helper: 'Principal ainda não liquidado',
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
                      <p className={cn('min-w-0 truncate text-[11px] font-bold uppercase tracking-wide', metric.card === geoGreenSurfaceClass ? geoGreenLabelClass : 'text-zinc-400')}>
                        {metric.label}
                      </p>
                    </div>
                    <div>
                      <p className={cn('truncate text-2xl font-bold tracking-tight', metric.valueClass)}>
                        {metric.value}
                      </p>
                      <p className={cn('mt-1.5 line-clamp-2 text-xs font-medium leading-4', metric.card === geoGreenSurfaceClass ? 'text-emerald-100/70' : 'text-zinc-400')}>
                        {metric.helper}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-800/75 sm:grid-cols-2 xl:grid-cols-4">
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
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-800/75 lg:col-span-2">
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
                            {statusName}
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
                        <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{orc.codigoOrcamento || 'Orçamento'}</p>
                        <p className="text-sm font-bold text-zinc-950 dark:text-white">{formatCurrency(orc.valorTotal ?? 0)}</p>
                      </div>
                      <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{orc.status || 'Sem status'}</p>
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
