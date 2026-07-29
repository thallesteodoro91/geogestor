import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { DatePickerField, FormSelect } from '../../components/Form';
import { FileUploadModal } from '../../components/FileUploadModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { apiClient, getDownloadUrl } from '../../services/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowUpRight, FolderOpen, Folder, PresentationChart, Files, FilePdf, FileDoc, FileText, FileDashed, Trash, MapPin, Compass, SquaresFour, MapTrifold, DownloadSimple, MagnifyingGlass, ChartBar, Clock, CheckCircle, TrendUp, Warning } from '@phosphor-icons/react';
import { ProjetosMap } from './ProjetosMap';
import { BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie } from 'recharts';
import { chartTextColor, chartBorder, chartLegendStyle, chartCursor, responsiveChartProps } from '../../utils/chartHelpers';
import { chartColors } from '../../data/chart-colors';
import { DynamicTooltip } from '../../components/charts/DynamicTooltip';
import { RichTooltip } from '../../components/charts/RichTooltip';
import { cn } from '../../utils/cn';
import { useDebounce } from '../../hooks/useDebounce';
import { primaryActionButtonClass, primaryActionIconClass, primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { geoFieldClass, geoKickerClass, geoTabButtonClass, geoTabIconClass, geoTabListClass } from '../../utils/geoTheme';
import { isApprovedBudgetStatus } from '../../utils/budgetStatus';
import { ProjectFormModal } from './ProjectFormModal';
import { resolveProjectFormCopy, type ProjectModalContext, type ProjectModalTab } from './projectForm';

import { CustomSelect } from '../../components/CustomSelect';
import {
  filterBarClass,
  filterControlClass,
  filterSearchInputClass
} from '../../utils/filterStyles';
import editIcon from '../../assets/magnific-icons/writing_3215063.svg';
import trashIcon from '../../assets/magnific-icons/trash-bin_5510130.svg';
import pdfIcon from '../../assets/magnific-icons/notes_8079875.svg';
import folderIcon from '../../assets/magnific-icons/project_folder.svg';
import windowsIcon from '../../assets/magnific-icons/laptop_5938907.svg';
import filterIcon from '../../assets/magnific-icons/filter_9757817.svg';

interface Cliente {
  id: string;
  nome: string;
}

interface OrcamentoInfo {
  clienteId: string;
  status: string;
  valorTotal: number;
}

interface DespesaInfo {
  projetoId?: string | null;
  valor: number;
}

interface Projeto {
  id: string;
  nome: string;
  descricao?: string | null;
  clienteId: string;
  clienteNome: string;
  status: string;
  dataInicio?: string | null;
  dataEntrega?: string | null;
  areaHa?: number | null;
  matricula?: string | null;
  car?: string | null;
  ccir?: string | null;
  itr?: string | null;
  cidade?: string | null;
  municipio?: string | null;
  situacaoImovel?: string | null;
  tipo?: string | null;
  averbacao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  possuiMemorialDescritivo?: string | null;
  observacoes?: string | null;
  orgaoAmbiental?: string | null;
  tipoDemanda?: string | null;
  tipoLicenca?: string | null;
  protocolo?: string | null;
  numeroProcesso?: string | null;
  tipoPericia?: string | null;
  dataVistoria?: string | null;
}

interface ProjetoArquivo {
  name: string;
  extension: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
}

const projectSelectClass = cn(geoFieldClass, 'h-12 w-full cursor-pointer px-4 font-medium');
const projectIconButtonClass = 'geo-focus-ring rounded-lg p-1 transition-[background-color,transform] duration-150 hover:bg-brand-surface-subtle hover:scale-110 active:scale-95 disabled:cursor-wait disabled:opacity-50 disabled:hover:scale-100 dark:hover:bg-brand-surface-muted';

const numberFormatter = new Intl.NumberFormat('pt-BR');
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const formatBRL = (cents: number) => currencyFormatter.format(cents / 100);
const formatProjectCount = (count: number) => `${numberFormatter.format(count)} ${count === 1 ? 'projeto' : 'projetos'}`;

type ProjectMetricTone = 'brand' | 'neutral' | 'positive' | 'warning' | 'danger';

const projectMetricToneClasses: Record<ProjectMetricTone, { accent: string; icon: string }> = {
  brand: {
    accent: 'bg-brand-primary-500',
    icon: 'bg-brand-primary-400/10 text-brand-primary-700 ring-brand-primary-300/30 dark:text-brand-primary-200'
  },
  neutral: {
    accent: 'bg-brand-blue-500',
    icon: 'bg-brand-blue-400/10 text-brand-blue-700 ring-brand-blue-300/30 dark:text-brand-blue-200'
  },
  positive: {
    accent: 'bg-emerald-500',
    icon: 'bg-emerald-400/10 text-emerald-700 ring-emerald-300/30 dark:text-emerald-200'
  },
  warning: {
    accent: 'bg-amber-500',
    icon: 'bg-amber-400/10 text-amber-700 ring-amber-300/30 dark:text-amber-200'
  },
  danger: {
    accent: 'bg-red-500',
    icon: 'bg-red-400/10 text-red-700 ring-red-300/30 dark:text-red-200'
  }
};

function ProjectMetricCard({
  label,
  value,
  helper,
  icon,
  tone = 'neutral'
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  icon: ReactNode;
  tone?: ProjectMetricTone;
}) {
  const toneClasses = projectMetricToneClasses[tone];

  return (
    <article className="geo-card relative flex min-h-[132px] min-w-0 flex-col justify-between overflow-hidden p-5">
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', toneClasses.accent)} />
      <div className="flex items-start justify-between gap-4">
        <h3 className="min-w-0 text-xs font-semibold leading-5 text-zinc-600 dark:text-zinc-300">{label}</h3>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1', toneClasses.icon)}>
          {icon}
        </span>
      </div>
      <div className="mt-4 min-w-0">
        <p className="break-words text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums dark:text-white">{value}</p>
        {helper && <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{helper}</p>}
      </div>
    </article>
  );
}

function ProjectsPageSkeleton() {
  return (
    <div aria-label="Carregando projetos" aria-busy="true" className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="geo-card h-[132px] animate-pulse bg-brand-surface-subtle motion-reduce:animate-none" />
        ))}
      </div>
      <div className="geo-surface h-16 animate-pulse rounded-lg bg-brand-surface-subtle motion-reduce:animate-none" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="geo-card h-[320px] animate-pulse bg-brand-surface-subtle motion-reduce:animate-none" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

export function ListagemProjetos() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledRouteActionRef = useRef(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [modalContext, setModalContext] = useState<ProjectModalContext>('projeto');
  const [initialProjectTab, setInitialProjectTab] = useState<ProjectModalTab>('projeto');
  const [initialProjectClientId, setInitialProjectClientId] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('todos');
  const [projectSuccessMessage, setProjectSuccessMessage] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const viewParam = searchParams.get('visualizacao');
  const viewMode: 'grid' | 'map' | 'operacional' = viewParam === 'mapa'
    ? 'map'
    : viewParam === 'estatisticas'
      ? 'operacional'
      : 'grid';
  const searchTerm = searchParams.get('busca') || '';
  const statusFilter = searchParams.get('status') || 'Todos';
  const tipoFilter = searchParams.get('tipo') || 'Todos';
  const dataInicioFilter = searchParams.get('inicio') || '';
  const dataFimFilter = searchParams.get('fim') || '';

  const updateProjectQuery = useCallback((key: string, value: string, defaultValue = '') => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === defaultValue) next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setViewMode = useCallback((mode: 'grid' | 'map' | 'operacional') => {
    const urlValue = mode === 'map' ? 'mapa' : mode === 'operacional' ? 'estatisticas' : '';
    updateProjectQuery('visualizacao', urlValue);
  }, [updateProjectQuery]);
  const setSearchTerm = useCallback((value: string) => updateProjectQuery('busca', value), [updateProjectQuery]);
  const setStatusFilter = useCallback((value: string) => updateProjectQuery('status', value, 'Todos'), [updateProjectQuery]);
  const setTipoFilter = useCallback((value: string) => updateProjectQuery('tipo', value, 'Todos'), [updateProjectQuery]);
  const setDataInicioFilter = useCallback((value: string) => updateProjectQuery('inicio', value), [updateProjectQuery]);
  const setDataFimFilter = useCallback((value: string) => updateProjectQuery('fim', value), [updateProjectQuery]);
  const clearProjectFilters = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      ['busca', 'status', 'tipo', 'inicio', 'fim'].forEach((key) => next.delete(key));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Local files preview states
  const [showArquivosModal, setShowArquivosModal] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Excluir',
    onConfirm: () => {}
  });

  // Queries
  const {
    data: projetos = [],
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectsErrorDetails,
    refetch: refetchProjects
  } = useQuery<Projeto[]>({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get<Projeto[]>('/api/projetos')
  });

  const {
    data: clientes = [],
    isLoading: clientsLoading,
    isError: clientsError,
    refetch: refetchClients
  } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: () => apiClient.get<Cliente[]>('/api/clientes')
  });

  const loading = projectsLoading || clientsLoading;
  const pageError = projectsError || clientsError;

  const {
    data: orcamentos = [],
    isLoading: budgetsLoading,
    isError: budgetsError,
    refetch: refetchBudgets
  } = useQuery<OrcamentoInfo[]>({
    queryKey: ['orcamentos-financeiro'],
    queryFn: () => apiClient.get<OrcamentoInfo[]>('/api/financeiro/orcamentos'),
    enabled: viewMode === 'operacional'
  });

  const {
    data: despesas = [],
    isLoading: expensesLoading,
    isError: expensesError,
    refetch: refetchExpenses
  } = useQuery<DespesaInfo[]>({
    queryKey: ['despesas-financeiro'],
    queryFn: () => apiClient.get<DespesaInfo[]>('/api/financeiro/despesas'),
    enabled: viewMode === 'operacional'
  });
  const operationalLoading = budgetsLoading || expensesLoading;
  const operationalError = budgetsError || expensesError;

  // Calculate Operational Stats
  const totalProjetos = projetos.length;
  const projetosConcluidos = projetos.filter((p) => p.status === 'Concluído' || p.status === 'Finalizado').length;
  const projetosEmAndamento = projetos.filter((p) => p.status === 'Em Andamento').length;
  const projetosAtrasados = projetos.filter(p => {
    if (p.status === 'Finalizado' || p.status === 'Concluído' || p.status === 'Cancelado') return false;
    if (p.status === 'Atrasado') return true;
    if (p.dataEntrega) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const delivery = new Date(p.dataEntrega);
      return delivery < today;
    }
    return false;
  }).length;
  const projetosOutros = totalProjetos - projetosConcluidos - projetosEmAndamento - projetosAtrasados;

  const statusPieData = [
    { name: 'Concluído', value: projetosConcluidos, color: chartColors.positive },
    { name: 'Em Andamento', value: projetosEmAndamento, color: chartColors.primary },
    { name: 'Outros', value: projetosOutros, color: chartColors.warning }
  ].filter(d => d.value > 0);

  const getProjectStatusBadge = (projeto: Projeto) => {
    const isDelayed = projeto.status !== 'Finalizado' && projeto.status !== 'Concluído' && projeto.status !== 'Cancelado' && (
      projeto.status === 'Atrasado' || (projeto.dataEntrega && new Date(projeto.dataEntrega) < new Date())
    );

    const statusValue = isDelayed ? 'Atrasado' : projeto.status;

    switch (statusValue) {
      case 'Em Andamento':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Em Andamento</span>
          </span>
        );
      case 'Atrasado':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-600 dark:text-red-400">
            <Warning className="w-3.5 h-3.5" />
            <span>Atrasado</span>
          </span>
        );
      case 'Finalizado':
      case 'Concluído':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Concluído</span>
          </span>
        );
      case 'Em Análise':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Em Análise</span>
          </span>
        );
      case 'Aguardando Órgão':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Aguardando Órgão</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            <span>{projeto.status}</span>
          </span>
        );
    }
  };

  let totalDays = 0;
  let countConcluidos = 0;
  projetos.forEach((p) => {
    if ((p.status === 'Concluído' || p.status === 'Finalizado') && p.dataInicio && p.dataEntrega) {
      const start = new Date(p.dataInicio);
      const end = new Date(p.dataEntrega);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      totalDays += diffDays;
      countConcluidos++;
    }
  });
  const avgCompletionTime = countConcluidos > 0 ? Math.round(totalDays / countConcluidos) : null;
  const productivityRate = totalProjetos > 0 ? Math.round((projetosConcluidos / totalProjetos) * 100) : null;

  const approvedBudgets = orcamentos.filter((o) => isApprovedBudgetStatus(o.status));
  const avgTicket = approvedBudgets.length > 0
    ? Math.round(approvedBudgets.reduce((acc: number, curr) => acc + curr.valorTotal, 0) / approvedBudgets.length) 
    : null;

  const projectComparisonData = projetos.map((proj) => {
    const relatedBudgets = orcamentos.filter((o) => o.clienteId === proj.clienteId && isApprovedBudgetStatus(o.status));
    const clientProjects = projetos.filter((p) => p.clienteId === proj.clienteId).length;
    const estimatedReceita = relatedBudgets.reduce((acc: number, o) => acc + o.valorTotal, 0) / (clientProjects || 1);

    const projectExpenses = despesas.filter((d) => d.projetoId === proj.id);
    const totalExpenses = projectExpenses.reduce((acc: number, d) => acc + d.valor, 0);

    return {
      name: proj.nome,
      Receita: estimatedReceita / 100,
      Custo: totalExpenses / 100,
      Lucro: (estimatedReceita - totalExpenses) / 100,
      tipo: proj.tipo || 'Rural'
    };
  });

  const filteredComparisonData = categoriaFilter === 'todos'
    ? projectComparisonData
    : projectComparisonData.filter((d) => d.tipo === categoriaFilter);

  const topProjectsData = filteredComparisonData
    .filter((item) => item.Receita !== 0 || item.Custo !== 0 || item.Lucro !== 0)
    .sort((a, b) => b.Receita - a.Receita)
    .slice(0, 5);

  const projectTypes = Array.from(new Set(projetos.map((projeto) => projeto.tipo || 'Rural'))).sort();
  const projectTypeStats = projectTypes
    .map((type) => ({
      type,
      count: projetos.filter((projeto) => (projeto.tipo || 'Rural') === type).length
    }))
    .filter((item) => item.count > 0);
  const projectStatuses = Array.from(new Set(projetos.map((projeto) => projeto.status).filter(Boolean))) as string[];
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredProjetos = projetos.filter((projeto) => {
    const query = debouncedSearchTerm.trim().toLowerCase();
    const searchable = [
      projeto.nome,
      projeto.clienteNome,
      projeto.descricao,
      projeto.status,
      projeto.tipo,
      projeto.cidade,
      projeto.municipio,
      projeto.matricula,
      projeto.car,
      projeto.ccir,
      projeto.itr
    ].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesStatus = statusFilter === 'Todos' || projeto.status === statusFilter;
    const matchesTipo = tipoFilter === 'Todos' || projeto.tipo === tipoFilter;
    const matchesStart = !dataInicioFilter || (projeto.dataInicio && projeto.dataInicio >= dataInicioFilter);
    const matchesEnd = !dataFimFilter || (projeto.dataInicio && projeto.dataInicio <= dataFimFilter);
    return matchesSearch && matchesStatus && matchesTipo && matchesStart && matchesEnd;
  });
  const hasProjectFilters = Boolean(searchTerm || statusFilter !== 'Todos' || tipoFilter !== 'Todos' || dataInicioFilter || dataFimFilter);
  const filteredProjectsLabel = filteredProjetos.length === 0
    ? 'Nenhum projeto exibido'
    : `${numberFormatter.format(filteredProjetos.length)} ${filteredProjetos.length === 1 ? 'projeto exibido' : 'projetos exibidos'}`;

  const { data: filesData = { files: [], path: '' }, isLoading: arquivosLoading } = useQuery<{ files: ProjetoArquivo[], path: string }>({
    queryKey: ['projeto-arquivos', showArquivosModal],
    queryFn: async () => {
      if (!showArquivosModal) return { files: [], path: '' };
      try {
        const data = await apiClient.get<{ files?: ProjetoArquivo[], path?: string }>(`/api/arquivos/projeto/${showArquivosModal}`);
        return { files: data.files || [], path: data.path || '' };
      } catch {
        return { files: [], path: '' };
      }
    },
    enabled: !!showArquivosModal
  });

  const projetoArquivos = filesData.files;
  const arquivosPasta = filesData.path;

  // Mutations
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/projetos/${id}`);
    },
    onSuccess: () => {
      setConfirmData(prev => ({ ...prev, isOpen: false }));
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
      queryClient.invalidateQueries({ queryKey: ['stats-geral'] });
      queryClient.invalidateQueries({ queryKey: ['projetos-notificacoes'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir projeto';
      alert(msg);
    }
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!showArquivosModal) return;
      const formData = new FormData();
      formData.append('projetoId', showArquivosModal);
      formData.append('file', file);

      await apiClient.post('/api/arquivos/upload/stream', formData);
    },
    onSuccess: () => {
      setConfirmData(prev => ({ ...prev, isOpen: false }));
      queryClient.invalidateQueries({ queryKey: ['projeto-arquivos', showArquivosModal] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      alert(`Erro ao enviar arquivo: ${msg}`);
    },
    onSettled: () => {
      setUploading(false);
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (filePath: string) => {
      await apiClient.delete(`/api/arquivos?path=${encodeURIComponent(filePath)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projeto-arquivos', showArquivosModal] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir o arquivo.';
      alert(msg);
    }
  });

  // Action methods
  const openCreateModal = useCallback((initialClienteId?: string, initialTab: ProjectModalTab = 'projeto', contexto: ProjectModalContext = 'projeto') => {
    const nextClienteId = initialClienteId && clientes.some((cliente) => cliente.id === initialClienteId)
      ? initialClienteId
      : '';
    setSelectedProjeto(null);
    setModalContext(contexto);
    setInitialProjectClientId(nextClienteId);
    setInitialProjectTab(initialTab);
    setShowModal(true);
  }, [clientes]);

  const openEditModal = async (proj: Projeto) => {
    setEditingProjectId(proj.id);
    try {
      const detailedProject = await apiClient.get<Projeto>(`/api/projetos/${proj.id}`);
      const nextContext: ProjectModalContext = detailedProject.tipo === 'Ambiental'
        ? 'ambiental'
        : detailedProject.tipo === 'Licenciamento'
          ? 'licenciamento'
          : 'projeto';
      setSelectedProjeto(detailedProject);
      setModalContext(nextContext);
      setInitialProjectClientId('');
      setInitialProjectTab('projeto');
      setShowModal(true);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar os dados completos do projeto.');
    } finally {
      setEditingProjectId(null);
    }
  };

  useEffect(() => {
    const routeState = location.state as { createForClienteId?: string; modalTab?: ProjectModalTab; openCreateModal?: boolean; contexto?: string } | null;
    if (handledRouteActionRef.current || (!routeState?.createForClienteId && !routeState?.openCreateModal) || clientsLoading) return;

    handledRouteActionRef.current = true;
    const routeContext: ProjectModalContext = routeState.contexto === 'ambiental' || routeState.contexto === 'licenciamento'
      ? routeState.contexto
      : 'projeto';
    openCreateModal(routeState.createForClienteId, routeState.modalTab || 'projeto', routeContext);
  }, [clientsLoading, clientes, location.state, openCreateModal]);

  const handleDelete = (id: string, name: string) => {
    setConfirmData({
      isOpen: true,
      title: `Excluir projeto “${name}”?`,
      description: `O projeto “${name}” será removido do GeoGestor. Revise seus vínculos e documentos antes de continuar. Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir projeto',
      onConfirm: () => deleteProjectMutation.mutate(id)
    });
  };

  const handleGenerateProjectPdf = async (projeto: Projeto) => {
    try {
      const { gerarRelatorioProjeto } = await import('../../utils/pdfGenerator');
      gerarRelatorioProjeto(projeto);
    } catch {
      alert('Erro ao gerar o PDF do projeto.');
    }
  };

  const handleAbrirPasta = async (id: string) => {
    try {
      await apiClient.post(`/api/projetos/${id}/abrir-pasta`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao tentar abrir a pasta.';
      alert(msg);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      uploadFileMutation.mutate(file);
    } catch {
      alert('Erro ao processar o arquivo.');
      setUploading(false);
    }
  };

  const handleFileDelete = (filePath: string) => {
    setConfirmData({
      isOpen: true,
      title: `Excluir arquivo “${filePath.split(/[\\/]/).pop() || 'arquivo'}”?`,
      description: 'O arquivo será removido permanentemente do disco local e deixará de aparecer nos documentos do projeto. Esta ação não pode ser desfeita.',
      confirmText: 'Excluir arquivo',
      onConfirm: () => deleteFileMutation.mutate(filePath)
    });
  };

  return (
    <Layout>
      <header className="mb-8 min-w-0 max-w-full">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className={cn(geoKickerClass, 'mb-2')}>Operações</span>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">Projetos</h1>
          </div>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className={cn(primaryActionButtonClass, 'min-h-11 shrink-0 gap-2.5 px-5 py-2.5 text-sm font-bold')}
          >
            <span>Novo Projeto</span>
            <span aria-hidden="true" className={cn(primaryActionIconClass, 'h-5 w-5 group-hover:translate-x-0.5')}>
              <Plus weight="bold" className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
        <div className="mt-3 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="min-w-0 max-w-2xl break-words text-sm font-medium leading-6 text-zinc-500 dark:text-zinc-400 sm:text-base">
            Monitoramento de processos ambientais, georreferenciamento e topografia.
          </p>
          <div aria-label="Selecionar visualização" className={cn(geoTabListClass, 'grid w-full min-w-0 max-w-full grid-cols-3 overflow-hidden rounded-lg sm:w-auto')}>
            <button
              type="button"
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
              className={geoTabButtonClass(viewMode === 'grid', 'system', 'min-h-10 w-full min-w-0 shrink justify-center rounded-md px-2 py-2 text-xs sm:px-3 sm:text-sm')}
            >
              <span aria-hidden="true" className={geoTabIconClass(viewMode === 'grid', 'system', 'h-6 w-6 rounded-md')}><SquaresFour weight={viewMode === 'grid' ? 'fill' : 'regular'} className="h-3.5 w-3.5" /></span>
              <span>Projetos</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'map'}
              onClick={() => setViewMode('map')}
              className={geoTabButtonClass(viewMode === 'map', 'field', 'min-h-10 w-full min-w-0 shrink justify-center rounded-md px-2 py-2 text-xs sm:px-3 sm:text-sm')}
            >
              <span aria-hidden="true" className={geoTabIconClass(viewMode === 'map', 'field', 'h-6 w-6 rounded-md')}><MapTrifold weight={viewMode === 'map' ? 'fill' : 'regular'} className="h-3.5 w-3.5" /></span>
              <span>Mapa</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'operacional'}
              onClick={() => setViewMode('operacional')}
              className={geoTabButtonClass(viewMode === 'operacional', 'finance', 'min-h-10 w-full min-w-0 shrink justify-center rounded-md px-2 py-2 text-xs sm:px-3 sm:text-sm')}
            >
              <span aria-hidden="true" className={geoTabIconClass(viewMode === 'operacional', 'finance', 'h-6 w-6 rounded-md')}><ChartBar weight={viewMode === 'operacional' ? 'fill' : 'regular'} className="h-3.5 w-3.5" /></span>
              <span>Estatísticas</span>
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <ProjectsPageSkeleton />
      ) : pageError ? (
        <section role="alert" className="geo-card flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-400/10 text-red-600 ring-1 ring-red-400/20 dark:text-red-300">
            <Warning aria-hidden="true" weight="duotone" className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-xl font-semibold text-zinc-950 dark:text-white">Não foi possível carregar os projetos</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Verifique se o serviço local está em execução e tente novamente.
            {projectsErrorDetails instanceof Error && <span className="sr-only"> {projectsErrorDetails.message}</span>}
          </p>
          <button
            type="button"
            onClick={() => void Promise.all([refetchProjects(), refetchClients()])}
            className={cn(secondarySmallActionButtonClass, 'mt-6 min-h-11 px-5')}
          >
            Tentar novamente
          </button>
        </section>
      ) : totalProjetos === 0 ? (
        <section className="geo-card flex min-h-[380px] min-w-0 max-w-full flex-col items-center justify-center px-6 py-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary-400/10 text-brand-primary-700 ring-1 ring-brand-primary-300/25 dark:text-brand-primary-200">
            <FolderOpen aria-hidden="true" weight="duotone" className="h-8 w-8" />
          </span>
          <h2 className="mt-6 max-w-full break-words text-xl font-semibold text-zinc-950 dark:text-white sm:text-2xl">Você ainda não possui projetos cadastrados</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400 sm:text-base">
            Crie seu primeiro projeto para acompanhar produtividade, custos, receitas e prazos.
          </p>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className={cn(primarySmallActionButtonClass, 'mt-7 min-h-11 px-5')}
          >
            <Plus aria-hidden="true" weight="bold" className="h-4 w-4" />
            Criar primeiro projeto
          </button>
        </section>
      ) : (
        <>
          {viewMode !== 'operacional' && (
            <>
              <section aria-label="Resumo dos projetos" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <ProjectMetricCard label="Total de projetos" value={numberFormatter.format(totalProjetos)} tone="brand" icon={<Folder aria-hidden="true" className="h-5 w-5" />} />
                <ProjectMetricCard label="Em andamento" value={numberFormatter.format(projetosEmAndamento)} tone="warning" icon={<Clock aria-hidden="true" className="h-5 w-5" />} />
                <ProjectMetricCard label="Atrasados" value={numberFormatter.format(projetosAtrasados)} tone={projetosAtrasados > 0 ? 'danger' : 'neutral'} icon={<Warning aria-hidden="true" className="h-5 w-5" />} />
                <ProjectMetricCard label="Concluídos" value={numberFormatter.format(projetosConcluidos)} tone="positive" icon={<CheckCircle aria-hidden="true" className="h-5 w-5" />} />
              </section>

              <section aria-labelledby="project-filters-title" className={cn('mb-3', filterBarClass)}>
                <h2 id="project-filters-title" className="sr-only">Filtros dos projetos</h2>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,1fr)_auto_auto_auto] xl:items-center">
                  <div className="relative min-w-0">
                    <label htmlFor="project-search" className="sr-only">Buscar projetos</label>
                    <MagnifyingGlass aria-hidden="true" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      id="project-search"
                      name="busca-projetos"
                      type="search"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Buscar projetos"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Buscar por projeto, cliente, cidade, matrícula ou CAR…"
                      className={filterSearchInputClass}
                    />
                  </div>

                  <div className="grid min-w-0 grid-cols-2 gap-3">
                    <CustomSelect
                      id="project-status-filter"
                      name="status-projeto"
                      ariaLabel="Filtrar por status"
                      className="min-w-0"
                      value={statusFilter}
                      onChange={setStatusFilter}
                      placeholder="Todos os status"
                      options={[
                        { label: 'Todos os status', value: 'Todos' },
                        ...projectStatuses.map((projectStatus) => ({ label: projectStatus, value: projectStatus }))
                      ]}
                    />
                    <CustomSelect
                      id="project-type-filter"
                      name="tipo-projeto"
                      ariaLabel="Filtrar por tipo"
                      className="min-w-0"
                      value={tipoFilter}
                      onChange={setTipoFilter}
                      placeholder="Todos os tipos"
                      options={[
                        { label: 'Todos os tipos', value: 'Todos' },
                        ...projectTypes.map((projectType) => ({ label: projectType, value: projectType }))
                      ]}
                    />
                  </div>

                  <div aria-label="Período do projeto" className="grid grid-cols-2 gap-3">
                    <label className={cn(filterControlClass, 'flex min-w-0 items-center gap-2 px-3 focus-within:border-brand-primary-400/70 focus-within:ring-4 focus-within:ring-brand-primary-400/15')}>
                      <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">Inicial</span>
                      <DatePickerField
                        name="data-inicial-projeto"
                        autoComplete="off"
                        value={dataInicioFilter}
                        onChange={(event) => setDataInicioFilter(event.target.value)}
                        className="min-w-0 flex-1 cursor-pointer bg-transparent text-xs font-semibold text-zinc-700 focus-visible:outline-none dark:text-zinc-200 [&::-webkit-calendar-picker-indicator]:dark:invert"
                        aria-label="Data inicial do projeto"
                      />
                    </label>
                    <label className={cn(filterControlClass, 'flex min-w-0 items-center gap-2 px-3 focus-within:border-brand-primary-400/70 focus-within:ring-4 focus-within:ring-brand-primary-400/15')}>
                      <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">Final</span>
                      <DatePickerField
                        name="data-final-projeto"
                        autoComplete="off"
                        value={dataFimFilter}
                        onChange={(event) => setDataFimFilter(event.target.value)}
                        className="min-w-0 flex-1 cursor-pointer bg-transparent text-xs font-semibold text-zinc-700 focus-visible:outline-none dark:text-zinc-200 [&::-webkit-calendar-picker-indicator]:dark:invert"
                        aria-label="Data final do projeto"
                      />
                    </label>
                  </div>

                  {hasProjectFilters && (
                    <button type="button" onClick={clearProjectFilters} className={cn(secondarySmallActionButtonClass, 'min-h-10 w-full px-4 text-xs xl:w-auto')}>
                      Limpar filtros
                    </button>
                  )}
                </div>
              </section>
              <p aria-live="polite" className="mb-6 px-1 text-xs font-semibold text-zinc-500 tabular-nums dark:text-zinc-400">{filteredProjectsLabel}</p>
            </>
          )}

          <AnimatePresence mode="wait">
        {viewMode === 'operacional' && (
          <motion.div
            key="operacional"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
          {operationalLoading ? (
            <ProjectsPageSkeleton />
          ) : operationalError ? (
            <section role="alert" className="geo-card flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
              <Warning aria-hidden="true" weight="duotone" className="h-8 w-8 text-red-500" />
              <h2 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">Não foi possível carregar os indicadores financeiros</h2>
              <p className="mt-2 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">Os projetos continuam disponíveis. Tente carregar novamente os dados de custos e receitas.</p>
              <button type="button" onClick={() => void Promise.all([refetchBudgets(), refetchExpenses()])} className={cn(secondarySmallActionButtonClass, 'mt-5 min-h-11 px-5')}>Tentar novamente</button>
            </section>
          ) : (
            <>
          <section aria-label="Indicadores operacionais" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ProjectMetricCard label="Total de projetos" value={numberFormatter.format(totalProjetos)} helper="Cadastrados no sistema" tone="brand" icon={<Folder aria-hidden="true" className="h-5 w-5" />} />
            <ProjectMetricCard
              label="Tempo médio de entrega"
              value={avgCompletionTime === null ? '—' : `${numberFormatter.format(avgCompletionTime)} ${avgCompletionTime === 1 ? 'dia' : 'dias'}`}
              helper={avgCompletionTime === null ? 'Sem dados suficientes' : 'Média dos projetos concluídos'}
              tone="neutral"
              icon={<Clock aria-hidden="true" className="h-5 w-5" />}
            />
            <ProjectMetricCard
              label="Produtividade"
              value={productivityRate === null ? '—' : `${numberFormatter.format(productivityRate)}%`}
              helper={productivityRate === null ? 'Sem dados suficientes' : 'Taxa geral de conclusão'}
              tone="positive"
              icon={<CheckCircle aria-hidden="true" className="h-5 w-5" />}
            />
            <ProjectMetricCard
              label="Valor médio dos projetos aprovados"
              value={avgTicket === null ? '—' : formatBRL(avgTicket)}
              helper={avgTicket === null ? 'Sem dados suficientes' : 'Com base em orçamentos aprovados'}
              tone="neutral"
              icon={<TrendUp aria-hidden="true" className="h-5 w-5" />}
            />
          </section>

          <section aria-labelledby="operational-overview-title" aria-live="polite" className="geo-card border-l-4 border-l-brand-primary-500 p-5 sm:p-6">
            <h2 id="operational-overview-title" className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-white">
              <PresentationChart aria-hidden="true" className="h-5 w-5 text-brand-primary-600 dark:text-brand-primary-200" />
              Visão Geral Operacional
            </h2>
            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              <p>
                A produtividade geral é de <strong className="text-zinc-950 tabular-nums dark:text-white">{numberFormatter.format(productivityRate ?? 0)}%</strong>.{' '}
                <strong className="text-zinc-950 tabular-nums dark:text-white">{formatProjectCount(projetosConcluidos)}</strong> {projetosConcluidos === 1 ? 'foi concluído' : 'foram concluídos'} e{' '}
                <strong className="text-zinc-950 tabular-nums dark:text-white">{formatProjectCount(projetosEmAndamento)}</strong> {projetosEmAndamento === 1 ? 'está em andamento' : 'estão em andamento'}.
              </p>
              <p>
                {avgCompletionTime === null
                  ? 'Ainda não há dados suficientes para calcular o tempo médio de entrega.'
                  : <>O tempo médio de entrega é de <strong className="text-zinc-950 tabular-nums dark:text-white">{numberFormatter.format(avgCompletionTime)} {avgCompletionTime === 1 ? 'dia' : 'dias'}</strong>.</>}
                {projetosOutros > 0 && <> Outros <strong className="text-zinc-950 tabular-nums dark:text-white">{formatProjectCount(projetosOutros)}</strong> aguardam início ou estão sob revisão.</>}
              </p>
              {projectTypeStats.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {projectTypeStats.map((item) => (
                    <span key={item.type} className="geo-badge-base geo-badge-neutral px-2.5 py-1 text-xs">
                      {item.type}: <span className="tabular-nums">{numberFormatter.format(item.count)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            
            {/* Custo vs Receita por Projeto */}
            <section aria-labelledby="cost-revenue-title" className="geo-card col-span-1 flex min-w-0 flex-col p-5 sm:p-6 md:col-span-8">
              <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 id="cost-revenue-title" className="text-base font-semibold text-zinc-950 dark:text-white">Custos versus receita estimada</h2>
                  <p className="mt-1 text-xs font-medium leading-5 text-zinc-500 dark:text-zinc-400">Comparação dos cinco projetos com maior receita estimada.</p>
                </div>
                <FormSelect
                  name="tipo-grafico-projetos"
                  aria-label="Filtrar gráfico por tipo de projeto"
                  autoComplete="off"
                  value={categoriaFilter}
                  onChange={(event) => setCategoriaFilter(event.target.value)}
                  className={cn(projectSelectClass, 'h-10 w-auto px-3 py-2 text-xs')}
                >
                  <option value="todos">Todos os tipos</option>
                  {projectTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </FormSelect>
              </div>

              {topProjectsData.length === 0 ? (
                <div className="geo-empty-state flex min-h-[180px] flex-col items-center justify-center px-5 py-7 text-center">
                  <ChartBar aria-hidden="true" weight="duotone" className="h-8 w-8 text-zinc-400" />
                  <h3 className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Sem dados financeiros para exibir</h3>
                  <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500 dark:text-zinc-400">Registre custos ou uma receita estimada para gerar esta comparação.</p>
                  {categoriaFilter !== 'todos' ? (
                    <button type="button" onClick={() => setCategoriaFilter('todos')} className={cn(secondarySmallActionButtonClass, 'mt-4 min-h-10 px-4 text-xs')}>Ver todos os tipos</button>
                  ) : (
                    <Link to="/financeiro" className={cn(secondarySmallActionButtonClass, 'mt-4 min-h-10 px-4 text-xs')}>Abrir Financeiro</Link>
                  )}
                </div>
              ) : (
                <div className="h-[280px] w-full min-w-0">
                  <ResponsiveContainer {...responsiveChartProps}>
                    <BarChart data={topProjectsData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartBorder} />
                      <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => currencyFormatter.format(Number(value))} />
                      <RechartsTooltip cursor={chartCursor} content={<RichTooltip format="currency" />} />
                      <Legend wrapperStyle={chartLegendStyle} />
                      <Bar dataKey="Receita" fill={chartColors.positive} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Custo" fill={chartColors.negative} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Lucro" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Status dos Projetos Pie */}
            <section aria-labelledby="project-status-title" className="geo-card col-span-1 flex min-w-0 flex-col justify-between p-5 sm:p-6 md:col-span-4">
              <div>
                <h2 id="project-status-title" className="text-base font-semibold text-zinc-950 dark:text-white">Distribuição por status</h2>
                <p className="mt-1 text-xs font-medium leading-5 text-zinc-500 dark:text-zinc-400">Situação dos projetos ativos e entregues.</p>
              </div>

              <div className="relative flex h-[220px] w-full items-center justify-center">
                  <ResponsiveContainer {...responsiveChartProps}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<DynamicTooltip formatter={(value) => formatProjectCount(Number(value))} />} />
                    </PieChart>
                  </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-brand-border pt-4 text-center text-xs font-semibold text-zinc-600">
                {statusPieData.map(item => (
                  <div key={item.name} className="flex flex-col items-center">
                    <span aria-hidden="true" className="mb-1 h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">{item.name}</span>
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>

          </div>
            </>
          )}
          </motion.div>
        )}
        
        {viewMode === 'grid' && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
        {filteredProjetos.length === 0 ? (
          <div className="geo-empty-state col-span-full flex flex-col items-center justify-center p-16 text-center">
            <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-950 rounded-full flex items-center justify-center mb-6 ring-8 ring-zinc-50/50 dark:ring-zinc-950/50">
              <img src={filterIcon} alt="" aria-hidden="true" className="w-10 h-10 object-contain opacity-40 grayscale" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">Nenhum resultado</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-md mx-auto mb-8">Sua busca não encontrou nenhum projeto correspondente. Tente ajustar os filtros ou os termos pesquisados.</p>
            <button
              type="button"
              onClick={clearProjectFilters}
              className={secondarySmallActionButtonClass}
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          filteredProjetos.map((projeto: Projeto, i: number) => (
            <motion.div 
              key={projeto.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 100, damping: 20 }}
              className="geo-card-interactive group motion-gpu content-auto flex min-h-[360px] flex-col justify-between p-6"
            >
              <div>
                <div className="flex items-start justify-between mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-brand-border bg-brand-surface-subtle transition-[background-color,border-color,transform] duration-200 group-hover:scale-105 group-hover:border-brand-primary-300/60 group-hover:bg-brand-primary-50/70 dark:bg-brand-surface-muted dark:group-hover:bg-brand-primary-400/10">
                    <PresentationChart weight="duotone" className="h-6 w-6 text-zinc-800 transition-colors duration-200 group-hover:text-brand-primary-600 dark:text-zinc-200 dark:group-hover:text-brand-primary-200" />
                  </div>
                  <div className="flex items-center gap-2">
                    {getProjectStatusBadge(projeto)}
                    <button
                      onClick={() => handleGenerateProjectPdf(projeto)}
                      className={projectIconButtonClass}
                      aria-label={`Baixar relatório PDF de ${projeto.nome}`}
                      title="Baixar relatório PDF"
                    >
                      <img src={pdfIcon} alt="" aria-hidden="true" className="w-6 h-6 object-contain opacity-80" />
                    </button>
                    <button 
                      onClick={() => openEditModal(projeto)}
                      disabled={editingProjectId === projeto.id}
                      aria-busy={editingProjectId === projeto.id}
                      className={projectIconButtonClass}
                      aria-label={`Editar ${projeto.nome}`}
                      title="Editar projeto"
                    >
                      <img src={editIcon} alt="" aria-hidden="true" className="w-6 h-6 object-contain opacity-80" />
                    </button>
                    <button 
                      onClick={() => handleDelete(projeto.id, projeto.nome)}
                      className={projectIconButtonClass}
                      aria-label={`Excluir ${projeto.nome}`}
                      title="Excluir projeto"
                    >
                      <img src={trashIcon} alt="" aria-hidden="true" className="w-6 h-6 object-contain opacity-80" />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white mb-1 leading-tight hover:underline">
                  <Link to={`/projetos/${projeto.id}`}>{projeto.nome}</Link>
                </h3>
                <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
                  <Link
                    to={`/clientes/${projeto.clienteId}`}
                    className="geo-focus-ring rounded text-zinc-700 underline-offset-2 hover:text-zinc-950 hover:underline dark:text-zinc-300 dark:hover:text-white"
                  >
                    {projeto.clienteNome}
                  </Link>
                </p>
                
                {projeto.descricao && (
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4 line-clamp-2 leading-relaxed">{projeto.descricao}</p>
                )}

                {/* Property tags */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {projeto.areaHa && (
                    <span className="geo-badge-base geo-badge-neutral px-2.5 py-1 text-xs">
                      <Compass aria-hidden="true" className="w-3.5 h-3.5 text-zinc-400" /> {numberFormatter.format(projeto.areaHa)} ha
                    </span>
                  )}
                  {projeto.car && (
                    <span className="geo-badge-base geo-badge-neutral px-2.5 py-1 text-xs" title={`CAR: ${projeto.car}`}>
                      CAR: {projeto.car.substring(0, 10)}…
                    </span>
                  )}
                  {projeto.matricula && (
                    <span className="geo-badge-base geo-badge-neutral px-2.5 py-1 text-xs">
                      Matrícula: {projeto.matricula}
                    </span>
                  )}
                  {projeto.municipio && (
                    <span className="geo-badge-base geo-badge-neutral px-2.5 py-1 text-xs">
                       <MapPin aria-hidden="true" className="w-3.5 h-3.5 text-zinc-400" /> {projeto.municipio}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex flex-col gap-2 border-t border-brand-border pt-6">
                <Link 
                  to={`/projetos/${projeto.id}`}
                  className={cn(primarySmallActionButtonClass, 'group w-full justify-between px-4 py-3')}
                >
                  <span className="text-sm font-semibold text-white flex items-center gap-3">
                    <img src={folderIcon} alt="" aria-hidden="true" className="w-5 h-5 object-contain invert opacity-90" /> Acessar projeto
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:translate-x-1">
                    <ArrowUpRight aria-hidden="true" weight="bold" className="w-3.5 h-3.5 text-white" />
                  </div>
                </Link>
                <button 
                  onClick={() => handleAbrirPasta(projeto.id)}
                  className={cn(secondarySmallActionButtonClass, 'group w-full justify-between px-4 py-3')}
                >
                  <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-3">
                    <img src={windowsIcon} alt="" aria-hidden="true" className="w-5 h-5 object-contain opacity-70" /> Abrir no Windows
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5 dark:bg-zinc-900">
                    <ArrowUpRight aria-hidden="true" weight="bold" className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
                  </div>
                </button>
              </div>
            </motion.div>
          ))
        )}
          </motion.div>
        )}

        {viewMode === 'map' && (
          <motion.div 
            key="map"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="w-full"
          >
            {filteredProjetos.length === 0 ? (
              <div className="geo-empty-state flex min-h-[300px] flex-col items-center justify-center p-10 text-center">
                <MapTrifold aria-hidden="true" weight="duotone" className="h-9 w-9 text-zinc-400" />
                <h2 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-white">Nenhum projeto para mostrar no mapa</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">Ajuste os filtros para voltar a exibir projetos.</p>
                <button type="button" onClick={clearProjectFilters} className={cn(secondarySmallActionButtonClass, 'mt-5 min-h-11 px-5')}>Limpar filtros</button>
              </div>
            ) : (
              <ProjetosMap projetos={filteredProjetos} />
            )}
          </motion.div>
        )}
          </AnimatePresence>
        </>
      )}

      {/* Cadastro e edição de projetos */}
      <ProjectFormModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        clientes={clientes}
        context={modalContext}
        project={selectedProjeto}
        initialClientId={initialProjectClientId}
        initialTab={initialProjectTab}
        onSaved={(savedProject, savedContext) => {
          const copy = resolveProjectFormCopy(savedContext, savedProject.tipo);
          setProjectSuccessMessage(selectedProjeto ? copy.updateSuccess : copy.createSuccess);
        }}
      />

      {/* Modal Arquivos Locais */}
      <Modal
        isOpen={!!showArquivosModal}
        onClose={() => setShowArquivosModal(null)}
        title="Arquivos do Projeto"
        maxWidth="max-w-5xl"
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-sm -mt-4 mb-6" title={arquivosPasta}>
          {arquivosPasta || 'Buscando no disco local…'}
        </p>

        {/* Drag and Drop Zone */}
        <div className="mb-6">
          <FileUploadModal
            onUpload={uploadFile}
            uploading={uploading}
            accept=".pdf,.gpkg,.kml,.dwg,.shp,.xlsx,.csv,.docx,.png,.jpg,.jpeg"
          />
        </div>

        <div className="space-y-3">
          {arquivosLoading ? (
            <div className="py-12 flex justify-center">
              <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-8 w-8 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary-600" />
            </div>
          ) : projetoArquivos.length === 0 ? (
            <div className="geo-empty-state py-12 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">Nenhum arquivo compatível encontrado nesta pasta.</p>
            </div>
          ) : (
            projetoArquivos.map((file: ProjetoArquivo, idx: number) => {
              let FileIcon = FileDashed;
              let iconColor = "text-zinc-400";
              let bgColor = "bg-zinc-50 dark:bg-zinc-950";


              if (file.extension === '.pdf') { FileIcon = FilePdf; iconColor = "text-red-500"; bgColor = "bg-red-50"; }
              if (file.extension === '.docx') { FileIcon = FileDoc; iconColor = "text-blue-500"; bgColor = "bg-blue-50"; }
              if (file.extension === '.csv' || file.extension === '.xlsx') { FileIcon = FileText; iconColor = "text-emerald-500"; bgColor = "bg-emerald-50"; }
              if (file.extension === '.gpkg' || file.extension === '.shp') { FileIcon = Files; iconColor = "text-indigo-500"; bgColor = "bg-indigo-50"; }
              if (file.extension === '.dwg') { FileIcon = Files; iconColor = "text-amber-500"; bgColor = "bg-amber-50"; }

              return (
                <motion.div 
                  key={file.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="geo-card-interactive group flex items-center gap-4 p-4"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bgColor} flex-shrink-0`}>
                    <FileIcon weight="duotone" className={`w-6 h-6 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-950 dark:text-white truncate" title={file.name}>{file.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      {(file.sizeBytes / 1024).toFixed(1)} KB • {new Date(file.modifiedAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => window.open(getDownloadUrl(file.path))}
                      className="geo-focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-brand-turquoise-200/80 bg-brand-turquoise-50 text-brand-turquoise-700 shadow-sm transition-[background-color,color,border-color,transform] hover:bg-brand-turquoise-100 active:scale-95 dark:border-brand-turquoise-300/20 dark:bg-brand-turquoise-400/10 dark:text-brand-turquoise-100"
                      title="Baixar Arquivo"
                    >
                      <DownloadSimple weight="bold" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleFileDelete(file.path)}
                      className="geo-focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-brand-red-200/80 bg-brand-red-50 text-brand-red-700 shadow-sm transition-[background-color,color,border-color,transform] hover:bg-brand-red-100 active:scale-95 dark:border-brand-red-300/20 dark:bg-brand-red-400/10 dark:text-brand-red-100"
                      title="Excluir Arquivo"
                    >
                      <Trash weight="bold" className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmData.isOpen}
        onClose={() => setConfirmData(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        description={confirmData.description}
        confirmText={confirmData.confirmText}
        loading={deleteProjectMutation.isPending || deleteFileMutation.isPending}
      />
      <div className="sr-only" aria-live="polite" aria-atomic="true">{projectSuccessMessage}</div>
    </Layout>
  );
}
