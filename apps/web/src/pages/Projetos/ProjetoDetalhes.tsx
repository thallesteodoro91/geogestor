import { toast } from 'sonner';
import { APP_ROUTES, appLinks } from '@geogestor/contracts';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SharedDataNotice } from '../../components/SharedDataNotice';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckboxField, DatePickerField, FormSelect } from '../../components/Form';
import { apiFetch, apiClient, getDownloadUrl } from '../../services/apiClient';
import { openManagedFolder } from '../../services/projectFolders';
import { getTaskPriorityTone } from '../../utils/taskPriority';
import { geoViewTransition } from '../../utils/motion';
import { primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { cn } from '../../utils/cn';
import { geoFieldClass, geoPurpleSurfaceClass, geoTabButtonClass, geoTabIconClass, geoTabListClass } from '../../utils/geoTheme';
import { invalidateFinancialQueries } from '../../utils/invalidateFinancialQueries';
import { ProjectFormModal, type ProjectFormSavedRecord } from './ProjectFormModal';
import {
  formatCoordinate,
  formatFileSize,
  formatProjectArea,
  formatProjectDate,
  formatProjectLocation,
  getDeadlinePresentation,
  isTaskOverdue
} from './projectDetailsPresentation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  ArrowLeft, 
  ArrowRight,
  Folder, 
  MapPin, 
  FileText, 
  CheckSquare, 
  CurrencyDollar, 
  FolderOpen, 
  DownloadSimple, 
  Trash, 
  Plus, 
  CloudArrowUp, 
  Files, 
  FilePdf, 
  FileDoc, 
  FileDashed, 
  Info,
  ArrowSquareOut,
  CalendarBlank,
  ChartLineUp,
  Copy,
  ListChecks,
  PencilSimple,
  MagnifyingGlass,
  WarningCircle
} from '@phosphor-icons/react';

interface Projeto extends ProjectFormSavedRecord {
  id: string;
  nome: string;
  clienteNome?: string;
}

interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string;
  prioridade: string;
  status: string;
  dataLimite?: string;
}

interface ArquivoItem {
  name: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  path: string;
}

const emptyProjectFilesData: { files: ArquivoItem[]; path: string } = { files: [], path: '' };

interface Despesa {
  id: string;
  projetoId: string;
  descricao: string;
  valor: number;
  categoria: string;
  data: string;
  observacoes?: string;
  status?: string;
  canceladaEm?: string | null;
  estornadaEm?: string | null;
}

type ProjectFinancialDecision =
  | 'manter_sem_alteracao'
  | 'cancelar_parcelas_futuras'
  | 'cobranca_parcial'
  | 'registrar_devolucao'
  | 'registrar_credito';

type ProjectDetailTab = 'tarefas' | 'arquivos' | 'financeiro';

const projectDetailTabOrder: ProjectDetailTab[] = ['tarefas', 'arquivos', 'financeiro'];
const projectDetailTabQuery: Record<ProjectDetailTab, string> = {
  tarefas: 'checklist',
  arquivos: 'documentos',
  financeiro: 'financeiro'
};

const projectDetailTabByQuery: Record<string, ProjectDetailTab> = {
  checklist: 'tarefas',
  documentos: 'arquivos',
  financeiro: 'financeiro'
};

interface ProjectFinancialContext {
  valorOrcado: number;
  valorContratado: number;
  valorFaturado: number;
  valorExecutadoInformado: number | null;
  valorRecebido: number;
  saldoAberto: number;
  parcelasConfiguradas: number;
  despesasLancadas: number;
  despesasPagas: number;
  custoPrevisto: number;
  custoRealizado: number;
  desvioCusto: number;
  percentualCustoConsumido: number | null;
  despesasSemPrevisao: boolean;
  decisaoFinanceiraPendente: boolean;
  eventosFinanceiros: Array<{
    id: string;
    tipo: string;
    entidade: string;
    entidadeId: string;
    valor: number;
    dataEvento: string;
    motivo?: string | null;
    metadataJson?: string | null;
    usuarioId: string;
    createdAt: string;
  }>;
  ultimaDecisao?: {
    tipo: ProjectFinancialDecision;
    motivo: string;
    createdAt: string;
  } | null;
}

const projectDetailFieldClass = cn(geoFieldClass, 'w-full p-3 text-sm font-medium');
const projectDetailSelectClass = cn(projectDetailFieldClass, 'font-semibold');
const projectDetailCardClass = 'geo-card p-6';
const financialEventLabels: Record<string, string> = {
  recebimento: 'Recebimento',
  estorno_recebimento: 'Estorno de recebimento',
  cancelamento_despesa: 'Cancelamento de despesa',
  estorno_despesa: 'Estorno de despesa',
  decisao_financeira_projeto: 'Decisão financeira',
  cancelamento_projeto_pendente: 'Cancelamento aguardando decisão',
  suspensao_projeto_pendente: 'Suspensão aguardando decisão'
};

const normalizeProjectSearch = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

function ProjectPanelError({
  message,
  onRetry,
  retrying,
  compact = false
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
  compact?: boolean;
}) {
  return (
    <div role="alert" className={cn('rounded-xl border border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100', compact ? 'flex flex-wrap items-center justify-between gap-3 p-3' : 'flex flex-col items-center px-6 py-10 text-center')}>
      <div className={cn('flex gap-3', compact ? 'items-center' : 'flex-col items-center')}>
        <WarningCircle aria-hidden="true" weight="duotone" className="h-6 w-6 shrink-0 text-amber-700 dark:text-amber-200" />
        <p className="text-sm font-medium">{message}</p>
      </div>
      <button type="button" onClick={onRetry} disabled={retrying} className={cn(secondarySmallActionButtonClass, compact ? 'min-h-11 px-3 text-xs' : 'mt-4 min-h-11 px-4', 'disabled:cursor-wait disabled:opacity-60')}>
        {retrying ? 'Tentando novamente…' : 'Tentar novamente'}
      </button>
    </div>
  );
}

export function ProjetoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = projectDetailTabByQuery[searchParams.get('aba') || ''] || 'tarefas';
  const tabRefs = useRef<Partial<Record<ProjectDetailTab, HTMLButtonElement | null>>>({});
  const [showEditModal, setShowEditModal] = useState(false);
  
  // File upload state
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'task'; item: Tarefa }
    | { type: 'expense'; item: Despesa }
    | { type: 'file'; filePath: string; fileName: string }
    | null
  >(null);

  // New task form state
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [taskTitulo, setTaskTitulo] = useState('');
  const [taskDescricao, setTaskDescricao] = useState('');
  const [taskPrioridade, setTaskPrioridade] = useState('Média');
  const [taskDataLimite, setTaskDataLimite] = useState('');

  const [financialDecision, setFinancialDecision] = useState<ProjectFinancialDecision>('manter_sem_alteracao');
  const [financialDecisionReason, setFinancialDecisionReason] = useState('');
  const [executedPercentage, setExecutedPercentage] = useState('');
  const [executedValue, setExecutedValue] = useState('');
  const [showFinancialDecision, setShowFinancialDecision] = useState(() => searchParams.get('acao') === 'decisao-financeira');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('todas');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('todas');
  const [fileSearch, setFileSearch] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('todos');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('todas');
  const [expenseStartDate, setExpenseStartDate] = useState('');
  const [expenseEndDate, setExpenseEndDate] = useState('');

  const taskDraftDirty = Boolean(taskTitulo.trim() || taskDescricao.trim() || taskDataLimite || taskPrioridade !== 'Média');
  const financialDraftDirty = Boolean(financialDecision !== 'manter_sem_alteracao' || financialDecisionReason.trim() || executedPercentage.trim() || executedValue.trim());
  const dirtyDraftLabels = [taskDraftDirty && 'nova tarefa', financialDraftDirty && 'decisão financeira'].filter(Boolean) as string[];
  const hasUnsavedDraft = dirtyDraftLabels.length > 0;
  const navigationBlocker = useBlocker(({ currentLocation, nextLocation }) => (
    hasUnsavedDraft && currentLocation.pathname !== nextLocation.pathname
  ));
  const projectViewTransition = reducedMotion ? { duration: 0 } : geoViewTransition;

  useEffect(() => {
    const current = searchParams.get('aba');
    if (current && projectDetailTabByQuery[current]) return;
    const next = new URLSearchParams(searchParams);
    next.set('aba', 'checklist');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!hasUnsavedDraft) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedDraft]);

  useEffect(() => {
    if (searchParams.get('acao') !== 'decisao-financeira') return;
    if (activeTab === 'financeiro') return;
    const next = new URLSearchParams(searchParams);
    next.set('aba', 'financeiro');
    setSearchParams(next, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  const activateTab = (tab: ProjectDetailTab, moveFocus = false) => {
    const next = new URLSearchParams(searchParams);
    next.set('aba', projectDetailTabQuery[tab]);
    setSearchParams(next, { replace: true });
    if (moveFocus) window.setTimeout(() => tabRefs.current[tab]?.focus(), 0);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentTab: ProjectDetailTab) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = projectDetailTabOrder.indexOf(currentTab);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? projectDetailTabOrder.length - 1
        : event.key === 'ArrowRight'
          ? (currentIndex + 1) % projectDetailTabOrder.length
          : (currentIndex - 1 + projectDetailTabOrder.length) % projectDetailTabOrder.length;
    activateTab(projectDetailTabOrder[nextIndex], true);
  };

  // 1. Fetch Project Details (which includes clientNome)
  const { data: projeto, isLoading: loadingProjeto, isError: projetoError, refetch: refetchProjeto } = useQuery<Projeto>({
    queryKey: ['projeto', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/projetos/${id}`);
      if (!res.ok) throw new Error('Projeto não encontrado');
      return res.json();
    },
    enabled: !!id
  });

  // 2. Fetch Project Tasks
  const {
    data: taskPage,
    isLoading: loadingTarefas,
    isFetching: fetchingTarefas,
    isError: tarefasError,
    refetch: refetchTarefas
  } = useQuery<{
    items: Tarefa[];
    total: number;
    statusTotals: Record<'A Fazer' | 'Em Progresso' | 'Concluído' | 'outros', number>;
  }>({
    queryKey: ['projeto-tarefas', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/tarefas?mode=page&limit=100&projetoId=${id}`);
      if (!res.ok) throw new Error('Não foi possível carregar as tarefas.');
      return res.json();
    },
    enabled: !!id,
    placeholderData: (previousData) => previousData
  });
  const tarefas = useMemo(() => taskPage?.items ?? [], [taskPage?.items]);

  // 3. Fetch Project Files
  const {
    data: filesData = emptyProjectFilesData,
    isLoading: loadingFiles,
    isFetching: fetchingFiles,
    isError: filesError,
    refetch: refetchFiles
  } = useQuery<{ files: ArquivoItem[]; path: string }>({
    queryKey: ['projeto-arquivos', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/arquivos/projeto/${id}`);
      if (res.ok) {
        const data = await res.json();
        return { files: data.files || [], path: data.path || '' };
      }
      throw new Error('Não foi possível consultar os documentos desta pasta.');
    },
    enabled: !!id,
    placeholderData: (previousData) => previousData
  });

  const projetoFiles = filesData.files;
  const projetoFilesPasta = filesData.path;

  // 4. Busca somente as despesas vinculadas ao projeto.
  const {
    data: expensePage,
    isLoading: loadingDespesas,
    isFetching: fetchingDespesas,
    isError: despesasError,
    refetch: refetchDespesas
  } = useQuery<{ items: Despesa[] }>({
    queryKey: ['projeto-despesas', id],
    queryFn: () => apiClient.get<{ items: Despesa[] }>(`/api/financeiro/despesas?mode=page&limit=100&projetoId=${id}`),
    enabled: !!id,
    placeholderData: (previousData) => previousData
  });
  const projectDespesas = useMemo(() => expensePage?.items ?? [], [expensePage?.items]);

  const {
    data: financialContext,
    isLoading: loadingFinancialContext,
    isFetching: fetchingFinancialContext,
    isError: financialContextError,
    refetch: refetchFinancialContext
  } = useQuery<ProjectFinancialContext>({
    queryKey: ['projeto-contexto-financeiro', id],
    queryFn: () => apiClient.get<ProjectFinancialContext>(`/api/projetos/${id}/contexto-financeiro`),
    enabled: !!id,
    placeholderData: (previousData) => previousData
  });

  const financialDecisionMustStayOpen = (projeto?.status === 'Cancelado' || projeto?.status === 'Suspenso')
    && Boolean(financialContext?.decisaoFinanceiraPendente);
  const financialDecisionVisible = showFinancialDecision || financialDecisionMustStayOpen;

  // Mutations
  const addTaskMutation = useMutation({
    mutationFn: async (payload: Omit<Tarefa, 'id'> & { projetoId: string }) => {
      const res = await apiFetch('/api/tarefas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erro ao criar tarefa');
      return res.json();
    },
    onSuccess: () => {
      setTaskTitulo('');
      setTaskDescricao('');
      setTaskPrioridade('Média');
      setTaskDataLimite('');
      setShowNewTaskForm(false);
      queryClient.invalidateQueries({ queryKey: ['projeto-tarefas', id] });
    },
    onError: () => {
      toast.error('Erro ao criar tarefa.');
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string, status: string }) => {
      const res = await apiFetch(`/api/tarefas/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Erro ao atualizar status da tarefa');
      return res.json();
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['projeto-tarefas', id] });
    },
    onError: () => {
      toast.error('Erro ao atualizar tarefa.');
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiFetch(`/api/tarefas/${taskId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Erro ao excluir tarefa');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projeto-tarefas', id] });
    },
    onError: () => {
      toast.error('Erro ao excluir tarefa.');
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      const res = await apiFetch(`/api/financeiro/despesas/${expenseId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Erro ao excluir despesa');
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['projeto-despesas', id] });
    },
    onError: () => {
      toast.error('Erro ao excluir despesa.');
    }
  });

  const financialDecisionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(`/api/projetos/${id}/decisao-financeira`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: financialDecision,
          motivo: financialDecisionReason,
          percentualExecutado: financialDecision === 'cobranca_parcial' && executedPercentage
            ? Number(executedPercentage.replace(',', '.'))
            : null,
          valorExecutado: ['cobranca_parcial', 'registrar_devolucao', 'registrar_credito'].includes(financialDecision) && executedValue
            ? Math.round(Number(executedValue.replace(/\./g, '').replace(',', '.')) * 100)
            : null
        })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Não foi possível registrar a decisão financeira.');
      }
      return response.json();
    },
    onSuccess: async () => {
      setFinancialDecision('manter_sem_alteracao');
      setFinancialDecisionReason('');
      setExecutedPercentage('');
      setExecutedValue('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projeto-contexto-financeiro', id] }),
        queryClient.invalidateQueries({ queryKey: ['parcelas'] }),
        invalidateFinancialQueries(queryClient)
      ]);
      setShowFinancialDecision(false);
    },
    onError: (error: Error) => {
      setShowFinancialDecision(true);
      toast.error(error.message);
    }
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('projetoId', id!);
      formData.append('file', file);

      const res = await apiFetch('/api/arquivos/upload/stream', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro desconhecido');
      }
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['projeto-arquivos', id] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao enviar arquivo: ${err.message}`);
    },
    onSettled: () => {
      setUploading(false);
    }
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const res = await apiFetch(`/api/arquivos?path=${encodeURIComponent(filePath)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Erro ao excluir o arquivo');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projeto-arquivos', id] });
    },
    onError: () => {
      toast.error('Erro ao excluir o arquivo.');
    }
  });

  const openFolderMutation = useMutation({
    mutationFn: () => openManagedFolder(projetoFilesPasta),
    onSuccess: () => undefined,
    onError: () => {
      toast.error('Não foi possível abrir a pasta local automaticamente. Verifique se o caminho existe.');
    }
  });

  // Actions
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      uploadFileMutation.mutate(file);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar o arquivo.');
      setUploading(false);
    }
  };

  const handleFileUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUpload(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileDelete = (filePath: string, fileName: string) => {
    setDeleteTarget({ type: 'file', filePath, fileName });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitulo.trim()) return;
    addTaskMutation.mutate({
      projetoId: id || '',
      titulo: taskTitulo,
      descricao: taskDescricao,
      status: 'A Fazer',
      prioridade: taskPrioridade,
      dataLimite: taskDataLimite
    });
  };

  const handleOpenFolder = () => {
    openFolderMutation.mutate();
  };

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error('Não foi possível copiar. Selecione o conteúdo e copie manualmente.');
    }
  };

  const handleCopyCoordinates = () => {
    if (projeto?.latitude == null || projeto.longitude == null) return;
    void copyText(`${projeto.latitude}, ${projeto.longitude}`, 'Coordenadas copiadas.');
  };

  const handleOpenMap = () => {
    if (projeto?.latitude == null || projeto.longitude == null) return;
    const latitude = encodeURIComponent(String(projeto.latitude));
    const longitude = encodeURIComponent(String(projeto.longitude));
    window.open(`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`, '_blank', 'noopener,noreferrer');
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Concluído':
        return 'geo-badge-base geo-badge-success';
      case 'Em Andamento':
        return 'geo-badge-base geo-badge-primary';
      case 'Suspenso':
        return 'geo-badge-base geo-badge-warning';
      default:
        return 'geo-badge-base geo-badge-neutral';
    }
  };

  const totalProjectTasks = taskPage?.total ?? tarefas.length;
  const completedTasks = taskPage?.statusTotals?.['Concluído'] ?? tarefas.filter((task) => task.status === 'Concluído').length;
  const taskProgress = totalProjectTasks ? Math.round((completedTasks / totalProjectTasks) * 100) : 0;
  const overdueTasks = tarefas.filter((task) => isTaskOverdue(task.status, task.dataLimite));
  const openTasks = tarefas.filter((task) => task.status !== 'Concluído');
  const nextTask = [...openTasks].sort((left, right) => {
    if (!left.dataLimite) return 1;
    if (!right.dataLimite) return -1;
    return left.dataLimite.localeCompare(right.dataLimite);
  })[0];
  const filteredTasks = useMemo(() => {
    const search = normalizeProjectSearch(taskSearch);
    return tarefas.filter((task) => {
      const matchesSearch = !search || normalizeProjectSearch(`${task.titulo} ${task.descricao || ''}`).includes(search);
      const overdue = isTaskOverdue(task.status, task.dataLimite);
      const matchesStatus = taskStatusFilter === 'todas'
        || (taskStatusFilter === 'abertas' && task.status !== 'Concluído')
        || (taskStatusFilter === 'concluidas' && task.status === 'Concluído')
        || (taskStatusFilter === 'atrasadas' && overdue);
      const matchesPriority = taskPriorityFilter === 'todas' || task.prioridade === taskPriorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [taskPriorityFilter, taskSearch, taskStatusFilter, tarefas]);
  const fileTypeOptions = useMemo(() => Array.from(new Set(projetoFiles.map((file) => file.extension.toLocaleLowerCase('pt-BR')).filter(Boolean))).sort(), [projetoFiles]);
  const filteredFiles = useMemo(() => {
    const search = normalizeProjectSearch(fileSearch);
    return projetoFiles.filter((file) => (
      (!search || normalizeProjectSearch(file.name).includes(search))
      && (fileTypeFilter === 'todos' || file.extension.toLocaleLowerCase('pt-BR') === fileTypeFilter)
    ));
  }, [fileSearch, fileTypeFilter, projetoFiles]);
  const expenseCategoryOptions = useMemo(() => Array.from(new Set(projectDespesas.map((expense) => expense.categoria).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'pt-BR')), [projectDespesas]);
  const filteredExpenses = useMemo(() => {
    const search = normalizeProjectSearch(expenseSearch);
    return projectDespesas.filter((expense) => (
      (!search || normalizeProjectSearch(`${expense.descricao} ${expense.observacoes || ''}`).includes(search))
      && (expenseCategoryFilter === 'todas' || expense.categoria === expenseCategoryFilter)
      && (!expenseStartDate || expense.data.slice(0, 10) >= expenseStartDate)
      && (!expenseEndDate || expense.data.slice(0, 10) <= expenseEndDate)
    ));
  }, [expenseCategoryFilter, expenseEndDate, expenseSearch, expenseStartDate, projectDespesas]);
  const deadline = getDeadlinePresentation(projeto?.status, projeto?.dataEntrega);
  const coordinatesAvailable = projeto?.latitude != null && projeto.longitude != null;
  const financialPercentage = financialContext?.percentualCustoConsumido;
  const financialOverrun = financialPercentage != null && financialPercentage > 100;
  const financialNeedsPlanning = Boolean(financialContext?.despesasSemPrevisao);
  const financialSummary = financialContextError && !financialContext
    ? 'Indisponível'
    : loadingFinancialContext
    ? 'Carregando…'
    : financialPercentage == null
      ? financialContext?.despesasSemPrevisao ? 'Sem previsão' : 'Não informado'
      : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(financialPercentage)}%`;
  const financialSummaryHelper = financialContextError && !financialContext
    ? 'Abra para tentar novamente'
    : loadingFinancialContext
    ? 'Consultando contexto financeiro'
    : financialOverrun
      ? 'do custo previsto consumido'
      : financialNeedsPlanning
        ? 'Há despesas sem custo previsto'
        : financialPercentage == null
          ? 'Custo previsto não informado'
          : 'do custo previsto consumido';
  const technicalReferences = [projeto?.matricula, projeto?.car, projeto?.ccir, projeto?.itr, projeto?.averbacao]
    .filter((value) => Boolean(value)).length + (projeto?.possuiMemorialDescritivo === 'Sim' ? 1 : 0);
  const projectFolderName = projetoFilesPasta.split(/[\\/]/).filter(Boolean).at(-1) || 'Pasta do projeto';

  if (loadingProjeto) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center gap-3 py-24" role="status" aria-live="polite">
          <motion.div aria-hidden="true" animate={reducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }} transition={reducedMotion ? { duration: 0 } : { repeat: Infinity, duration: 1.5 }} className="h-8 w-8 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary-600 motion-reduce:animate-none" />
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Carregando detalhes do projeto…</p>
        </div>
      </Layout>
    );
  }

  if (projetoError) {
    return (
      <Layout>
        <section role="alert" className="geo-card mx-auto flex max-w-xl flex-col items-center px-6 py-12 text-center">
          <WarningCircle aria-hidden="true" weight="duotone" className="h-11 w-11 text-red-600 dark:text-red-300" />
          <h2 className="mt-4 text-2xl font-semibold text-zinc-950 dark:text-white">Não foi possível carregar o projeto</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Tente novamente. Se o problema continuar, volte para a lista de projetos.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => void refetchProjeto()} className={primarySmallActionButtonClass}>Tentar novamente</button>
            <Link to={APP_ROUTES.projects.path} className={secondarySmallActionButtonClass}>Voltar para projetos</Link>
          </div>
        </section>
      </Layout>
    );
  }

  if (!projeto) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Projeto não encontrado</h2>
          <button type="button" onClick={() => navigate('/projetos')} className={primarySmallActionButtonClass}>
            Voltar para lista de projetos
          </button>
        </div>
      </Layout>
    );
  }

  const totalDespesas = projectDespesas.reduce((acc: number, cur: Despesa) => {
    if (cur.canceladaEm || cur.estornadaEm || ['Cancelado', 'Estornado'].includes(cur.status || '')) return acc;
    return acc + (Number(cur.valor) || 0);
  }, 0);

  return (
    <Layout>
      <nav aria-label="Navegação estrutural" className="mb-8 flex min-w-0 items-center gap-4">
        <button 
          type="button"
          onClick={() => navigate('/projetos')}
          aria-label="Voltar para a lista de projetos"
          className="geo-focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface text-zinc-600 transition-[background-color,color,border-color,transform] hover:bg-brand-surface-subtle active:scale-95 dark:text-zinc-300"
        >
          <ArrowLeft aria-hidden="true" weight="bold" className="h-4 w-4" />
        </button>
        <div className="min-w-0 truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Link to={APP_ROUTES.projects.path} className="hover:text-zinc-900 dark:text-zinc-100 transition-colors">Projetos</Link>
          <span aria-hidden="true" className="mx-2 text-zinc-300">/</span>
          <span className="truncate text-zinc-950 dark:text-white">{projeto.nome}</span>
        </div>
      </nav>

      <header className="mb-8 flex flex-col items-start justify-between gap-5 lg:flex-row lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-words text-3xl font-semibold tracking-tighter text-zinc-950 sm:text-4xl dark:text-white">{projeto.nome}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider uppercase ${getStatusColor(projeto.status || 'Em Andamento')}`}>
              {projeto.status || 'Em Andamento'}
            </span>
          </div>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400 font-medium">
            Vinculado ao cliente:{' '}
            {projeto.clienteId ? (
              <Link to={`/clientes/${projeto.clienteId}`} className="geo-focus-ring rounded font-semibold text-zinc-950 underline underline-offset-2 hover:text-brand-primary-700 dark:text-white dark:hover:text-brand-primary-200">{projeto.clienteNome || 'Cliente'}</Link>
            ) : <span className="font-semibold text-zinc-700 dark:text-zinc-200">Cliente não informado</span>}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button type="button" onClick={() => setShowEditModal(true)} className={cn(primarySmallActionButtonClass, 'min-h-11 justify-center')}>
            <PencilSimple aria-hidden="true" weight="bold" className="h-4 w-4" />
            <span>Editar projeto</span>
          </button>
          <button 
            type="button"
            onClick={handleOpenFolder}
            disabled={openFolderMutation.isPending || !projetoFilesPasta}
            aria-busy={openFolderMutation.isPending}
            className={cn(secondarySmallActionButtonClass, 'min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-60')}
          >
            <FolderOpen aria-hidden="true" weight="bold" className="h-4 w-4 text-amber-500" />
            <span>{openFolderMutation.isPending ? 'Abrindo pasta…' : 'Abrir pasta'}</span>
          </button>
        </div>
      </header>

      <section aria-label="Resumo operacional do projeto" className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-live="polite">
        <button type="button" onClick={() => setShowEditModal(true)} className={cn('geo-card geo-focus-ring group min-h-32 w-full border-l-4 p-4 text-left transition-[border-color,background-color,box-shadow,transform] hover:bg-brand-surface-subtle hover:shadow-md active:translate-y-px', deadline.tone === 'danger' ? 'border-l-red-500' : deadline.tone === 'warning' ? 'border-l-amber-500' : deadline.tone === 'success' ? 'border-l-emerald-500' : 'border-l-zinc-400')}>
          <span className="flex h-full flex-col justify-between gap-3">
            <span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Prazo</span><span className="mt-1 block break-words text-base font-semibold text-zinc-950 dark:text-white">{deadline.label}</span><span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{deadline.helper}</span></span><CalendarBlank aria-hidden="true" className="h-6 w-6 shrink-0 text-zinc-400" weight="duotone" /></span>
            <span className="flex items-center gap-1 text-xs font-semibold text-brand-primary-700 dark:text-brand-primary-200">Editar prazo <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></span>
          </span>
        </button>
        <button type="button" onClick={() => activateTab('tarefas', true)} className="geo-card geo-focus-ring group min-h-32 w-full border-l-4 border-l-brand-primary-500 p-4 text-left transition-[border-color,background-color,box-shadow,transform] hover:bg-brand-surface-subtle hover:shadow-md active:translate-y-px">
          <span className="flex h-full flex-col justify-between gap-3"><span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Checklist</span><span className="mt-1 block text-base font-semibold tabular-nums text-zinc-950 dark:text-white">{loadingTarefas ? 'Carregando…' : tarefasError && !taskPage ? 'Indisponível' : totalProjectTasks ? `${completedTasks} de ${totalProjectTasks} concluídas` : 'Nenhuma tarefa'}</span><span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"><span className="block h-full rounded-full bg-brand-primary-600 transition-[width] motion-reduce:transition-none" style={{ width: `${loadingTarefas ? 0 : taskProgress}%` }} /></span></span><ListChecks aria-hidden="true" className="h-6 w-6 shrink-0 text-brand-primary-600 dark:text-brand-primary-200" weight="duotone" /></span><span className="flex items-center gap-1 text-xs font-semibold text-brand-primary-700 dark:text-brand-primary-200">Ver checklist <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></span></span>
        </button>
        <button type="button" onClick={() => activateTab('arquivos', true)} className="geo-card geo-focus-ring group min-h-32 w-full border-l-4 border-l-cyan-500 p-4 text-left transition-[border-color,background-color,box-shadow,transform] hover:bg-brand-surface-subtle hover:shadow-md active:translate-y-px">
          <span className="flex h-full flex-col justify-between gap-3"><span className="flex items-start justify-between gap-3"><span><span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Documentos</span><span className="mt-1 block text-base font-semibold tabular-nums text-zinc-950 dark:text-white">{loadingFiles ? 'Carregando…' : filesError && !filesData.path && !filesData.files.length ? 'Indisponível' : `${projetoFiles.length} ${projetoFiles.length === 1 ? 'documento' : 'documentos'}`}</span><span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">Pasta local do projeto</span></span><Files aria-hidden="true" className="h-6 w-6 shrink-0 text-cyan-600 dark:text-cyan-200" weight="duotone" /></span><span className="flex items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-200">Ver documentos <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></span></span>
        </button>
        <button type="button" onClick={() => activateTab('financeiro', true)} className={cn('geo-card geo-focus-ring group min-h-32 w-full border-l-4 p-4 text-left transition-[border-color,background-color,box-shadow,transform] hover:bg-brand-surface-subtle hover:shadow-md active:translate-y-px', financialOverrun ? 'border-l-red-500' : financialNeedsPlanning ? 'border-l-amber-500' : financialPercentage == null ? 'border-l-zinc-400' : 'border-l-emerald-500')}>
          <span className="flex h-full flex-col justify-between gap-3"><span className="flex items-start justify-between gap-3"><span><span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Financeiro</span><span className={cn('mt-1 block text-base font-semibold tabular-nums', financialOverrun ? 'text-red-700 dark:text-red-300' : financialNeedsPlanning ? 'text-amber-700 dark:text-amber-200' : 'text-zinc-950 dark:text-white')}>{financialSummary}</span><span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{financialSummaryHelper}</span></span><ChartLineUp aria-hidden="true" className={cn('h-6 w-6 shrink-0', financialOverrun ? 'text-red-600 dark:text-red-300' : financialNeedsPlanning ? 'text-amber-600 dark:text-amber-200' : financialPercentage == null ? 'text-zinc-400' : 'text-emerald-600 dark:text-emerald-200')} weight="duotone" /></span><span className="flex items-center gap-1 text-xs font-semibold text-brand-primary-700 dark:text-brand-primary-200">Ver financeiro <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" /></span></span>
        </button>
      </section>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        {/* Left Column: General & Property Details */}
        <div className="lg:col-span-1 space-y-6">
          {/* General info Card */}
          <section className={projectDetailCardClass} aria-labelledby="project-general-heading">
            <h2 id="project-general-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-950 dark:text-white">
              <Info aria-hidden="true" className="h-5 w-5 text-zinc-400" /> Detalhes gerais
            </h2>
            
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">Descrição</p>
                <p className="text-zinc-900 dark:text-zinc-100 font-medium mt-1 leading-relaxed">{projeto.descricao || 'Sem descrição cadastrada.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">Data de Início</p>
                  <time dateTime={projeto.dataInicio || undefined} className="mt-1 block font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatProjectDate(projeto.dataInicio)}</time>
                </div>
                <div>
                  <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">Prazo de Entrega</p>
                  <time dateTime={projeto.dataEntrega || undefined} className="mt-1 block font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatProjectDate(projeto.dataEntrega)}</time>
                </div>
              </div>
            </div>
          </section>

          {/* Technical / Property Card */}
          <section className={projectDetailCardClass} aria-labelledby="project-property-heading">
            <h2 id="project-property-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-950 dark:text-white">
              <MapPin aria-hidden="true" className="h-5 w-5 text-cyan-600 dark:text-cyan-300" /> Dados da propriedade
            </h2>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm text-zinc-600">
              {projeto.areaHa != null && (
                <div>
                  <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">Área (Hectares)</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatProjectArea(projeto.areaHa)}</p>
                </div>
              )}
              {projeto.tipo && (
                <div>
                  <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">Tipo</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-0.5">{projeto.tipo}</p>
                </div>
              )}
              {projeto.matricula && (
                <div>
                  <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">Matrícula</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-0.5">{projeto.matricula}</p>
                </div>
              )}
              {projeto.car && (
                <div>
                  <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">CAR</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-0.5">{projeto.car}</p>
                </div>
              )}
              {projeto.ccir && (
                <div>
                  <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">CCIR</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-0.5">{projeto.ccir}</p>
                </div>
              )}
              {projeto.itr && (
                <div>
                  <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">ITR</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-0.5">{projeto.itr}</p>
                </div>
              )}
              {projeto.situacaoImovel && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">Situação do Imóvel</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-medium mt-0.5">{projeto.situacaoImovel}</p>
                </div>
              )}
              {(projeto.cidade || projeto.municipio) && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">Localidade</p>
                  <p className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{formatProjectLocation(projeto.cidade, projeto.municipio)}</p>
                </div>
              )}
              {projeto.averbacao && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">Averbação</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-medium mt-0.5">{projeto.averbacao}</p>
                </div>
              )}
            </div>

            {/* Coordinates and memorial description */}
            {coordinatesAvailable && (
              <div className="mt-4 border-t border-brand-border pt-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">Latitude</p>
                  <p className="mt-0.5 font-mono tabular-nums text-zinc-800 dark:text-zinc-200">{formatCoordinate(projeto.latitude)}</p>
                </div>
                <div>
                  <p className="text-zinc-600 font-semibold uppercase tracking-wider dark:text-zinc-400">Longitude</p>
                  <p className="mt-0.5 font-mono tabular-nums text-zinc-800 dark:text-zinc-200">{formatCoordinate(projeto.longitude)}</p>
                </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={handleCopyCoordinates} className={cn(secondarySmallActionButtonClass, 'min-h-11 px-3 py-2 text-xs')}>
                    <Copy aria-hidden="true" className="h-4 w-4" /> Copiar coordenadas
                  </button>
                  <button type="button" onClick={handleOpenMap} className={cn(secondarySmallActionButtonClass, 'min-h-11 px-3 py-2 text-xs')}>
                    <ArrowSquareOut aria-hidden="true" className="h-4 w-4" /> Ver no mapa
                  </button>
                </div>
              </div>
            )}
            
            {projeto.possuiMemorialDescritivo && (
              <div className="mt-4 flex items-center justify-between border-t border-brand-border pt-4 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">Memorial Descritivo:</span>
                <span className={`px-2 py-0.5 rounded font-semibold text-xs ${
                  projeto.possuiMemorialDescritivo === 'Sim' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                }`}>
                  {projeto.possuiMemorialDescritivo}
                </span>
              </div>
            )}
          </section>
        </div>

        <section className="geo-card flex flex-col p-6 lg:col-span-2" aria-labelledby="project-operational-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary-700 dark:text-brand-primary-200">Visão operacional</p>
              <h2 id="project-operational-heading" className="mt-1 text-xl font-semibold text-zinc-950 dark:text-white">Próxima ação e qualidade do cadastro</h2>
            </div>
            <button type="button" onClick={() => activateTab('tarefas', true)} className={cn(secondarySmallActionButtonClass, 'min-h-11 px-3 py-2 text-xs')}>Abrir checklist</button>
          </div>
          <div className="mt-6 grid flex-1 gap-4 sm:grid-cols-2">
            <div className={cn('rounded-xl border p-4', overdueTasks.length ? 'border-red-300 bg-red-50/70 dark:border-red-500/30 dark:bg-red-500/10' : 'border-brand-border bg-brand-surface-subtle')}>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Próxima ação</p>
              {tarefasError && !taskPage ? (
                <><p className="mt-2 font-semibold text-amber-800 dark:text-amber-200">Tarefas indisponíveis</p><p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Abra o checklist para tentar carregar novamente.</p></>
              ) : overdueTasks.length ? (
                <><p className="mt-2 font-semibold text-red-800 dark:text-red-200">Revisar {overdueTasks.length} {overdueTasks.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}</p><p className="mt-1 text-sm text-red-700 dark:text-red-300">A tarefa mais urgente é “{overdueTasks[0].titulo}”.</p></>
              ) : nextTask ? (
                <><p className="mt-2 font-semibold text-zinc-950 dark:text-white">{nextTask.titulo}</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{nextTask.dataLimite ? `Prazo em ${formatProjectDate(nextTask.dataLimite)}` : 'Sem data limite definida'}</p></>
              ) : tarefas.length ? (
                <><p className="mt-2 font-semibold text-emerald-700 dark:text-emerald-200">Checklist concluído</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Todas as tarefas cadastradas foram finalizadas.</p></>
              ) : (
                <><p className="mt-2 font-semibold text-zinc-950 dark:text-white">Criar a primeira tarefa</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Organize as etapas do trabalho e acompanhe os prazos.</p></>
              )}
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Cadastro técnico</p>
              <p className="mt-2 font-semibold tabular-nums text-zinc-950 dark:text-white">{technicalReferences} {technicalReferences === 1 ? 'referência informada' : 'referências informadas'}</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Matrícula, cadastros rurais, averbação e memorial, quando disponíveis.</p>
            </div>
            <div className="rounded-xl border border-brand-border bg-brand-surface-subtle p-4 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Localização</p><p className="mt-2 font-semibold text-zinc-950 dark:text-white">{formatProjectLocation(projeto.cidade, projeto.municipio)}</p><p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{coordinatesAvailable ? 'Coordenadas disponíveis para consulta e cópia.' : 'Adicione coordenadas para habilitar a consulta no mapa.'}</p></div>
                {coordinatesAvailable && <button type="button" onClick={handleOpenMap} className={cn(secondarySmallActionButtonClass, 'min-h-11 px-3 py-2 text-xs')}><MapPin aria-hidden="true" className="h-4 w-4" />Ver no mapa</button>}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="mb-4">
        <SharedDataNotice
          preferenceKey="project-shared-data"
          action={projeto.clienteId ? (
            <Link
              to={appLinks.client(projeto.clienteId)}
              className="geo-focus-ring inline-flex min-h-10 items-center rounded-xl border border-sky-300 bg-white px-3 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-zinc-900 dark:text-sky-200 dark:hover:bg-sky-400/10"
            >
              Ver consolidado de {projeto.clienteNome || 'cliente'}
            </Link>
          ) : undefined}
        >
          Tarefas, documentos e lançamentos deste projeto também aparecem nas visões consolidadas do GeoGestor. O dado é cadastrado uma única vez e atualizado em todas as áreas relacionadas.
        </SharedDataNotice>
      </div>

      <section className="geo-card mb-12 scroll-mt-20 rounded-2xl" aria-labelledby="project-workspace-heading">
        <h2 id="project-workspace-heading" className="sr-only">Área de trabalho do projeto</h2>
        <div className="sticky top-[65px] z-20 rounded-t-2xl border-b border-brand-border bg-brand-surface/95 p-3 shadow-sm backdrop-blur sm:p-4 md:top-0">
          <div className="relative">
          <div role="tablist" aria-label="Abas de detalhes do projeto" className={cn(geoTabListClass, 'hide-scrollbar flex gap-2 overflow-x-auto pr-8 sm:pr-0')}>
            <button 
              ref={(node) => { tabRefs.current.tarefas = node; }}
              id="project-detail-tab-tarefas"
              type="button"
              role="tab"
              aria-selected={activeTab === 'tarefas'}
              aria-controls="project-detail-panel-tarefas"
              tabIndex={activeTab === 'tarefas' ? 0 : -1}
              onClick={() => activateTab('tarefas')}
              onKeyDown={(event) => handleTabKeyDown(event, 'tarefas')}
              className={geoTabButtonClass(activeTab === 'tarefas', 'system', 'shrink-0 px-4 py-2.5')}
            >
              <span aria-hidden="true" className={geoTabIconClass(activeTab === 'tarefas', 'system')}><CheckSquare weight={activeTab === 'tarefas' ? 'fill' : 'regular'} className="h-4 w-4" /></span>
              Tarefas do projeto ({tarefas.length})
            </button>
            <button 
              ref={(node) => { tabRefs.current.arquivos = node; }}
              id="project-detail-tab-arquivos"
              type="button"
              role="tab"
              aria-selected={activeTab === 'arquivos'}
              aria-controls="project-detail-panel-arquivos"
              tabIndex={activeTab === 'arquivos' ? 0 : -1}
              onClick={() => activateTab('arquivos')}
              onKeyDown={(event) => handleTabKeyDown(event, 'arquivos')}
              className={geoTabButtonClass(activeTab === 'arquivos', 'field', 'shrink-0 px-4 py-2.5')}
            >
              <span aria-hidden="true" className={geoTabIconClass(activeTab === 'arquivos', 'field')}><Folder weight={activeTab === 'arquivos' ? 'fill' : 'regular'} className="h-4 w-4" /></span>
              Documentos ({projetoFiles.length})
            </button>
            <button 
              ref={(node) => { tabRefs.current.financeiro = node; }}
              id="project-detail-tab-financeiro"
              type="button"
              role="tab"
              aria-selected={activeTab === 'financeiro'}
              aria-controls="project-detail-panel-financeiro"
              tabIndex={activeTab === 'financeiro' ? 0 : -1}
              onClick={() => activateTab('financeiro')}
              onKeyDown={(event) => handleTabKeyDown(event, 'financeiro')}
              className={geoTabButtonClass(activeTab === 'financeiro', 'finance', 'shrink-0 px-4 py-2.5')}
            >
              <span aria-hidden="true" className={geoTabIconClass(activeTab === 'financeiro', 'finance')}><CurrencyDollar weight={activeTab === 'financeiro' ? 'fill' : 'regular'} className="h-4 w-4" /></span>
              Financeiro · {projectDespesas.length} {projectDespesas.length === 1 ? 'despesa' : 'despesas'}
            </button>
          </div>
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-brand-surface via-brand-surface/85 to-transparent sm:hidden" />
          </div>
        </div>

          <div className="p-4 sm:p-6">
            {activeTab === 'tarefas' && (
              <div id="project-detail-panel-tarefas" role="tabpanel" aria-labelledby="project-detail-tab-tarefas" className="space-y-4">
                {/* Form to add tasks */}
                <div>
                  <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                    <div><h3 className="text-lg font-semibold text-zinc-950 dark:text-white">Tarefas do projeto</h3>{totalProjectTasks > 0 && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">{completedTasks} de {totalProjectTasks} concluídas · {taskProgress}%{totalProjectTasks > tarefas.length ? ` · ${tarefas.length} exibidas nesta página` : ''}</p>}</div>
                    <button 
                      type="button"
                      onClick={() => setShowNewTaskForm(!showNewTaskForm)}
                      aria-expanded={showNewTaskForm}
                      aria-controls="project-new-task-form"
                      className={cn(tarefas.length ? secondarySmallActionButtonClass : primarySmallActionButtonClass, 'min-h-11 px-4 py-2.5 text-xs')}
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" /> Adicionar tarefa
                    </button>
                  </div>

                  {tarefasError && taskPage && (
                    <ProjectPanelError message="Não foi possível atualizar as tarefas. Os dados anteriores foram preservados." onRetry={() => { void refetchTarefas(); }} retrying={fetchingTarefas} compact />
                  )}

                  <AnimatePresence>
                    {showNewTaskForm && (
                      <motion.form 
                        id="project-new-task-form"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={projectViewTransition}
                        onSubmit={handleAddTask} 
                        className="mb-6 space-y-4 border-t border-brand-border pt-4 motion-gpu"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="col-span-1 md:col-span-2">
                            <label htmlFor="project-task-title" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Título</label>
                            <input 
                              id="project-task-title"
                              name="taskTitle"
                              type="text" 
                              autoComplete="off"
                              value={taskTitulo} 
                              onChange={(e) => setTaskTitulo(e.target.value)}
                              placeholder="Ex.: emitir memorial descritivo…"
                              className={projectDetailFieldClass}
                              required
                            />
                          </div>

                          <div>
                            <label htmlFor="project-task-priority" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Prioridade</label>
                            <FormSelect
                              id="project-task-priority"
                              name="taskPriority"
                              autoComplete="off"
                              value={taskPrioridade}
                              onChange={(e) => setTaskPrioridade(e.target.value)}
                              className={projectDetailSelectClass}
                            >
                              <option value="Baixa">Baixa</option>
                              <option value="Média">Média</option>
                              <option value="Alta">Alta</option>
                            </FormSelect>
                          </div>

                          <div>
                            <label htmlFor="project-task-due-date" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Data limite</label>
                            <DatePickerField
                              id="project-task-due-date"
                              name="taskDueDate"
                              value={taskDataLimite} 
                              onChange={(e) => setTaskDataLimite(e.target.value)}
                              className={projectDetailSelectClass}
                            />
                          </div>

                          <div className="col-span-1 md:col-span-2">
                            <label htmlFor="project-task-description" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Descrição (opcional)</label>
                            <textarea 
                              id="project-task-description"
                              name="taskDescription"
                              autoComplete="off"
                              value={taskDescricao} 
                              onChange={(e) => setTaskDescricao(e.target.value)}
                              placeholder="Observações ou subpassos…"
                              rows={2}
                              className={projectDetailFieldClass}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            type="submit" 
                            disabled={addTaskMutation.isPending}
                            aria-busy={addTaskMutation.isPending}
                            className={cn(primarySmallActionButtonClass, 'min-h-11 px-4 py-2.5 text-xs')}
                          >
                            {addTaskMutation.isPending ? 'Criando tarefa…' : 'Criar tarefa'}
                          </button>
                          <button 
                            type="button" 
                            onClick={() => {
                              setTaskTitulo('');
                              setTaskDescricao('');
                              setTaskPrioridade('Média');
                              setTaskDataLimite('');
                              setShowNewTaskForm(false);
                            }}
                            className={cn(secondarySmallActionButtonClass, 'min-h-11 px-4 py-2.5 text-xs')}
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {tarefas.length >= 10 && (
                    <div className="mb-4 grid gap-3 rounded-xl border border-brand-border bg-brand-surface-subtle p-3 md:grid-cols-[minmax(12rem,1fr)_auto_auto]" aria-label="Filtros do checklist">
                      <label className="relative min-w-0">
                        <span className="sr-only">Buscar tarefas</span>
                        <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input id="project-task-search" name="taskSearch" type="search" autoComplete="off" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="Buscar tarefas…" className={cn(projectDetailFieldClass, 'pl-9')} />
                      </label>
                      <label>
                        <span className="sr-only">Filtrar tarefas por situação</span>
                        <FormSelect id="project-task-status-filter" name="taskStatusFilter" value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)} className={projectDetailSelectClass}>
                          <option value="todas">Todas as situações</option>
                          <option value="abertas">Abertas</option>
                          <option value="concluidas">Concluídas</option>
                          <option value="atrasadas">Atrasadas</option>
                        </FormSelect>
                      </label>
                      <label>
                        <span className="sr-only">Filtrar tarefas por prioridade</span>
                        <FormSelect id="project-task-priority-filter" name="taskPriorityFilter" value={taskPriorityFilter} onChange={(event) => setTaskPriorityFilter(event.target.value)} className={projectDetailSelectClass}>
                          <option value="todas">Todas as prioridades</option>
                          <option value="Alta">Alta</option>
                          <option value="Média">Média</option>
                          <option value="Baixa">Baixa</option>
                        </FormSelect>
                      </label>
                    </div>
                  )}

                  {/* Tasks Checklist */}
                  {loadingTarefas ? (
                    <div className="flex items-center justify-center gap-3 py-8" role="status">
                      <motion.div aria-hidden="true" animate={reducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }} transition={reducedMotion ? { duration: 0 } : { repeat: Infinity, duration: 1.5 }} className="h-6 w-6 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary-600 motion-reduce:animate-none" />
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">Carregando tarefas…</span>
                    </div>
                  ) : tarefasError && !taskPage ? (
                    <ProjectPanelError message="Não foi possível carregar as tarefas. Tente novamente." onRetry={() => { void refetchTarefas(); }} retrying={fetchingTarefas} />
                  ) : tarefas.length === 0 ? (
                    <div className="geo-empty-state flex flex-col items-center px-6 py-10 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary-400/10 text-brand-primary-700 dark:text-brand-primary-200"><ListChecks aria-hidden="true" weight="duotone" className="h-6 w-6" /></span>
                      <h3 className="mt-4 text-base font-semibold text-zinc-950 dark:text-white">Nenhuma tarefa criada</h3>
                      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">Crie tarefas para acompanhar as etapas, prioridades e prazos deste trabalho.</p>
                      <button type="button" onClick={() => setShowNewTaskForm(true)} className={cn(primarySmallActionButtonClass, 'mt-5 min-h-11 px-4')}><Plus aria-hidden="true" className="h-4 w-4" />Criar primeira tarefa</button>
                    </div>
                  ) : filteredTasks.length === 0 ? (
                    <div className="geo-empty-state px-6 py-8 text-center"><p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Nenhuma tarefa corresponde aos filtros.</p><button type="button" onClick={() => { setTaskSearch(''); setTaskStatusFilter('todas'); setTaskPriorityFilter('todas'); }} className={cn(secondarySmallActionButtonClass, 'mt-4 min-h-11 px-4')}>Limpar filtros</button></div>
                  ) : (
                    <div className="space-y-3 pt-2" aria-busy={updateTaskMutation.isPending}>
                      {filteredTasks.map((task: Tarefa) => {
                        const priorityTone = getTaskPriorityTone(task.prioridade);
                        const overdue = isTaskOverdue(task.status, task.dataLimite);

                        return (
                        <div 
                          key={task.id}
                          className={cn('geo-card-interactive flex min-w-0 items-center justify-between gap-3 border-l-4 p-4 motion-gpu motion-standard', priorityTone.cardClass, overdue && 'border-red-400 bg-red-50/45 dark:bg-red-500/5')}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <CheckboxField
                              id={`project-task-${task.id}`}
                              label={`Marcar ${task.titulo} como concluída`}
                              checked={task.status === 'Concluído'}
                              onChange={(checked) => updateTaskMutation.mutate({ taskId: task.id, status: checked ? 'Concluído' : 'A Fazer' })}
                              compact
                              labelHidden
                            />
                            
                            <div className="min-w-0">
                              <span className={`block break-words text-sm font-semibold tracking-tight ${task.status === 'Concluído' ? 'line-through text-zinc-400 font-normal' : 'text-zinc-950 dark:text-white'}`}>
                                {task.titulo}
                              </span>
                              {task.descricao && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">{task.descricao}</p>
                              )}
                              
                              <div className="flex items-center gap-2 mt-1.5 text-xs uppercase tracking-wider font-semibold">
                                <span className={`rounded-full px-2 py-0.5 ring-1 ring-inset ${priorityTone.badgeClass}`}>
                                  {priorityTone.label}
                                </span>
                                {task.dataLimite && (
                                  <time dateTime={task.dataLimite} className={cn('tabular-nums', overdue ? 'text-red-700 dark:text-red-300' : 'text-zinc-500 dark:text-zinc-400')}>
                                    {overdue ? 'Atrasada · ' : 'Limite: '}{formatProjectDate(task.dataLimite)}
                                  </time>
                                )}
                              </div>
                            </div>
                          </div>

                          <button 
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'task', item: task })}
                            aria-label={`Excluir tarefa ${task.titulo}`}
                            className="geo-focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-[background-color,color,transform] hover:bg-brand-red-50 hover:text-brand-red-600 active:scale-95 dark:hover:bg-brand-red-400/10"
                          >
                            <Trash aria-hidden="true" className="h-4 w-4" />
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'arquivos' && (
              <div id="project-detail-panel-arquivos" role="tabpanel" aria-labelledby="project-detail-tab-arquivos" className="flex flex-col">
                <div className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-brand-border pb-4 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-zinc-950 dark:text-white">Documentos locais</h3>
                    <p className="mt-1 truncate text-sm text-zinc-500 dark:text-zinc-400" title={projetoFilesPasta}>{projectFolderName}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {projetoFilesPasta && <button type="button" onClick={() => void copyText(projetoFilesPasta, 'Caminho da pasta copiado.')} className={cn(secondarySmallActionButtonClass, 'min-h-11 px-3 py-2 text-xs')}><Copy aria-hidden="true" className="h-4 w-4" />Copiar caminho</button>}
                    <button type="button" onClick={handleOpenFolder} disabled={!projetoFilesPasta || openFolderMutation.isPending} className={cn(secondarySmallActionButtonClass, 'min-h-11 px-3 py-2 text-xs disabled:opacity-60')}><FolderOpen aria-hidden="true" className="h-4 w-4" />Abrir pasta</button>
                  </div>
                </div>

                {filesError && (filesData.files.length > 0 || Boolean(filesData.path)) && (
                  <div className="mb-5"><ProjectPanelError message="Não foi possível atualizar os documentos. A lista anterior foi preservada." onRetry={() => { void refetchFiles(); }} retrying={fetchingFiles} compact /></div>
                )}

                {/* Drag and Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`mb-6 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-[background-color,border-color,transform] duration-150 ${
                    dragActive 
                      ? 'border-brand-green-500 bg-brand-green-50/50 dark:bg-brand-green-400/10' 
                      : 'border-brand-border bg-brand-surface-subtle hover:border-brand-primary-300/70 hover:bg-brand-surface dark:bg-brand-surface-muted'
                  }`}
                >
                  <input 
                    type="file" 
                    id="file-upload" 
                    name="projectDocument"
                    className="hidden" 
                    onChange={handleFileUploadChange} 
                    disabled={uploading}
                  />
                  <label 
                    htmlFor="file-upload" 
                    className="cursor-pointer flex flex-col items-center gap-2 w-full text-center"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-zinc-500 shadow-sm dark:bg-brand-surface-muted dark:text-zinc-400">
                      <CloudArrowUp aria-hidden="true" weight="duotone" className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
                    </div>
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                      {uploading ? 'Processando…' : 'Arraste arquivos ou clique para adicionar documentos'}
                    </span>
                    <span className="text-xs text-zinc-400">
                      GPKG, SHP, KML, KMZ, DWG, PDF, imagens e outros arquivos locais · máximo de 50 MB
                    </span>
                  </label>
                </div>

                {projetoFiles.length >= 10 && (
                  <div className="mb-4 grid gap-3 rounded-xl border border-brand-border bg-brand-surface-subtle p-3 sm:grid-cols-[minmax(12rem,1fr)_auto]" aria-label="Filtros de documentos">
                    <label className="relative min-w-0">
                      <span className="sr-only">Buscar documentos</span>
                      <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input id="project-file-search" name="fileSearch" type="search" autoComplete="off" value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} placeholder="Buscar documentos…" className={cn(projectDetailFieldClass, 'pl-9')} />
                    </label>
                    <label>
                      <span className="sr-only">Filtrar documentos por tipo</span>
                      <FormSelect id="project-file-type-filter" name="fileTypeFilter" value={fileTypeFilter} onChange={(event) => setFileTypeFilter(event.target.value)} className={projectDetailSelectClass}>
                        <option value="todos">Todos os tipos</option>
                        {fileTypeOptions.map((extension) => <option key={extension} value={extension}>{extension.replace('.', '').toLocaleUpperCase('pt-BR')}</option>)}
                      </FormSelect>
                    </label>
                  </div>
                )}

                {/* Files List */}
                <div className="space-y-3">
                  {loadingFiles ? (
                    <div className="flex items-center justify-center gap-3 py-8" role="status">
                      <motion.div aria-hidden="true" animate={reducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }} transition={reducedMotion ? { duration: 0 } : { repeat: Infinity, duration: 1.5 }} className="h-6 w-6 animate-spin rounded-full border-2 border-brand-border border-t-brand-green-600 motion-reduce:animate-none" />
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">Carregando documentos…</span>
                    </div>
                  ) : filesError && !filesData.files.length && !filesData.path ? (
                    <ProjectPanelError message="Não foi possível consultar os documentos desta pasta." onRetry={() => { void refetchFiles(); }} retrying={fetchingFiles} />
                  ) : projetoFiles.length === 0 ? (
                    <div className="geo-empty-state flex flex-col items-center px-6 py-10 text-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-700 dark:text-cyan-200"><Files aria-hidden="true" weight="duotone" className="h-6 w-6" /></span>
                      <h3 className="mt-4 text-base font-semibold text-zinc-950 dark:text-white">Nenhum documento adicionado</h3>
                      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">Centralize arquivos técnicos, peças cartográficas e documentos administrativos nesta pasta.</p>
                      <button type="button" onClick={() => document.getElementById('file-upload')?.click()} className={cn(primarySmallActionButtonClass, 'mt-5 min-h-11 px-4')}><CloudArrowUp aria-hidden="true" className="h-4 w-4" />Adicionar documentos</button>
                    </div>
                  ) : filteredFiles.length === 0 ? (
                    <div className="geo-empty-state px-6 py-8 text-center"><p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Nenhum documento corresponde aos filtros.</p><button type="button" onClick={() => { setFileSearch(''); setFileTypeFilter('todos'); }} className={cn(secondarySmallActionButtonClass, 'mt-4 min-h-11 px-4')}>Limpar filtros</button></div>
                  ) : (
                    filteredFiles.map((file: ArquivoItem, idx: number) => {
                      let FileIcon = FileDashed;
                      let iconColor = "text-zinc-400";
                      let bgColor = "bg-zinc-50 dark:bg-zinc-950";

                      if (file.extension === '.pdf') { FileIcon = FilePdf; iconColor = "text-red-500 dark:text-red-300"; bgColor = "bg-red-50 dark:bg-red-500/10"; }
                      if (file.extension === '.docx') { FileIcon = FileDoc; iconColor = "text-blue-500 dark:text-blue-300"; bgColor = "bg-blue-50 dark:bg-blue-500/10"; }
                      if (file.extension === '.csv' || file.extension === '.xlsx') { FileIcon = FileText; iconColor = "text-emerald-500 dark:text-emerald-300"; bgColor = "bg-emerald-50 dark:bg-emerald-500/10"; }
                      if (file.extension === '.gpkg' || file.extension === '.shp' || file.extension === '.kml' || file.extension === '.kmz' || file.extension === '.geojson') { FileIcon = Files; iconColor = "text-indigo-500 dark:text-indigo-300"; bgColor = "bg-indigo-50 dark:bg-indigo-500/10"; }
                      if (file.extension === '.dwg') { FileIcon = Files; iconColor = "text-amber-500 dark:text-amber-300"; bgColor = "bg-amber-50 dark:bg-amber-500/10"; }

                      return (
                        <motion.div 
                          key={file.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={reducedMotion ? { duration: 0 } : { delay: idx * 0.03 }}
                          className="geo-card-interactive group flex items-center gap-4 p-4"
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColor} flex-shrink-0`}>
                            <FileIcon aria-hidden="true" weight="duotone" className={`h-5 w-5 ${iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-zinc-950 dark:text-white text-sm truncate" title={file.name}>{file.name}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold tracking-wider mt-0.5">
                              {formatFileSize(file.sizeBytes)} · <time dateTime={file.modifiedAt}>{formatProjectDate(file.modifiedAt)}</time>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => window.open(getDownloadUrl(file.path), '_blank', 'noopener,noreferrer')}
                              aria-label={`Baixar arquivo ${file.name}`}
                              className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-lg border border-brand-border bg-brand-surface-subtle text-zinc-600 transition-[background-color,color,border-color,transform] hover:border-brand-primary-300/60 hover:bg-brand-primary-50/70 hover:text-brand-primary-700 active:scale-95 dark:bg-brand-surface-muted dark:text-zinc-100 dark:hover:bg-brand-primary-400/10 dark:hover:text-brand-primary-100"
                            >
                              <DownloadSimple aria-hidden="true" weight="bold" className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFileDelete(file.path, file.name)}
                              aria-label={`Excluir arquivo ${file.name}`}
                              className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 transition-[background-color,color,transform] hover:bg-brand-red-50 hover:text-brand-red-600 active:scale-95 dark:hover:bg-brand-red-400/10"
                            >
                              <Trash aria-hidden="true" weight="bold" className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeTab === 'financeiro' && (
              <div id="project-detail-panel-financeiro" role="tabpanel" aria-labelledby="project-detail-tab-financeiro" aria-busy={loadingFinancialContext || fetchingFinancialContext} className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {loadingFinancialContext && !financialContext ? (
                  <div className="flex items-center justify-center gap-3 py-12 lg:col-span-3" role="status">
                    <motion.div aria-hidden="true" animate={reducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }} transition={reducedMotion ? { duration: 0 } : { repeat: Infinity, duration: 1.5 }} className="h-6 w-6 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary-600 motion-reduce:animate-none" />
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">Carregando dados financeiros…</span>
                  </div>
                ) : financialContextError && !financialContext ? (
                  <div className="lg:col-span-3"><ProjectPanelError message="Os dados financeiros estão temporariamente indisponíveis." onRetry={() => { void refetchFinancialContext(); }} retrying={fetchingFinancialContext} /></div>
                ) : (
                  <>
                {financialContextError && financialContext && (
                  <div className="lg:col-span-3"><ProjectPanelError message="Não foi possível atualizar o contexto financeiro. Os dados anteriores foram preservados." onRetry={() => { void refetchFinancialContext(); }} retrying={fetchingFinancialContext} compact /></div>
                )}
                {financialContext?.decisaoFinanceiraPendente && (
                  <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100 lg:col-span-3">
                    <p className="font-semibold">Decisão financeira pendente</p>
                    <p className="mt-1 leading-6">O tratamento das cobranças, créditos ou devoluções ainda não foi definido.</p>
                    {!financialDecisionVisible && <button type="button" onClick={() => setShowFinancialDecision(true)} className={cn(secondarySmallActionButtonClass, 'mt-3 min-h-11 border-amber-400 px-4 text-xs')}>Resolver pendência</button>}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:col-span-3 lg:grid-cols-4">
                  {[
                    ['Orçado', financialContext?.valorOrcado ?? 0],
                    ['Contratado', financialContext?.valorContratado || 0],
                    ['Executado informado', financialContext?.valorExecutadoInformado],
                    ['Faturado', financialContext?.valorFaturado || 0],
                    ['Recebido', financialContext?.valorRecebido || 0],
                    ['Saldo aberto', financialContext?.saldoAberto || 0],
                    ['Custo previsto', financialContext?.custoPrevisto || 0],
                    ['Custo realizado', financialContext?.custoRealizado || 0]
                  ].map(([label, value]) => (
                    <div key={String(label)} className="geo-card p-4">
                      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</p>
                      {label === 'Saldo aberto' && (financialContext?.valorContratado || 0) > 0 && financialContext?.parcelasConfiguradas === 0 ? (
                        <>
                          <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-200">Contas a receber ainda não configuradas</p>
                          <Link to={appLinks.finance({ tab: 'faturas', acao: 'parcela', projeto: projeto.id, cliente: projeto.clienteId })} className="geo-focus-ring mt-2 inline-flex rounded text-xs font-semibold text-brand-primary-700 underline underline-offset-2 dark:text-brand-primary-200">Configurar parcelas</Link>
                        </>
                      ) : (
                        <p className="mt-1 text-lg font-bold tabular-nums text-zinc-950 dark:text-white">
                          {value == null ? 'Não informado' : formatCurrency(Number(value))}
                        </p>
                      )}
                    </div>
                  ))}
                  <div className="col-span-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950 lg:col-span-4">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                      Desvio de custo: {formatCurrency(financialContext?.desvioCusto || 0)}
                    </span>
                    <span className="ml-3 text-zinc-500 dark:text-zinc-400">
                      {financialContext?.percentualCustoConsumido == null
                        ? financialContext?.despesasSemPrevisao
                          ? 'Há despesas sem custo previsto no orçamento.'
                          : 'Sem custo previsto informado.'
                        : `${financialContext.percentualCustoConsumido}% do custo previsto consumido.`}
                    </span>
                  </div>
                </div>

                <section className="geo-card p-6 lg:col-span-3" aria-labelledby="financial-decision-heading">
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 id="financial-decision-heading" className="text-lg font-semibold text-zinc-950 dark:text-white">Decisões financeiras</h3>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Registre ajustes comerciais somente quando este projeto exigir um tratamento específico.</p>
                    </div>
                    <button type="button" onClick={() => setShowFinancialDecision((current) => !current)} disabled={financialDecisionMutation.isPending || financialDecisionMustStayOpen} aria-expanded={financialDecisionVisible} aria-controls="project-financial-decision-form" className={cn(financialDecisionVisible ? secondarySmallActionButtonClass : primarySmallActionButtonClass, 'min-h-11 shrink-0 px-4 text-xs disabled:cursor-wait disabled:opacity-60')}>
                      {financialDecisionMustStayOpen ? 'Pendência em aberto' : financialDecisionVisible ? 'Recolher formulário' : 'Registrar decisão financeira'}
                    </button>
                  </div>
                  <AnimatePresence initial={false}>
                  {financialDecisionVisible && (
                  <motion.form
                    id="project-financial-decision-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={projectViewTransition}
                    className="mt-5 space-y-4 overflow-hidden border-t border-brand-border pt-5 motion-reduce:transition-none"
                    onSubmit={(event) => {
                      event.preventDefault();
                      financialDecisionMutation.mutate();
                    }}
                  >
                  <div>
                    <h4 className="font-semibold text-zinc-950 dark:text-white">Dados da decisão</h4>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">A decisão não apaga recebimentos, despesas ou eventos já registrados.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                      <span>Decisão</span>
                      <FormSelect
                        id="project-financial-decision"
                        name="projectFinancialDecision"
                        autoComplete="off"
                        value={financialDecision}
                        onChange={(event) => setFinancialDecision(event.target.value as ProjectFinancialDecision)}
                        className={projectDetailSelectClass}
                      >
                        <option value="manter_sem_alteracao">Manter cobranças sem alteração</option>
                        <option value="cancelar_parcelas_futuras">Cancelar parcelas futuras em aberto</option>
                        <option value="cobranca_parcial">Registrar cobrança parcial pelo executado</option>
                        <option value="registrar_devolucao">Registrar decisão de devolução</option>
                        <option value="registrar_credito">Registrar crédito ao cliente</option>
                      </FormSelect>
                    </label>
                    {['cobranca_parcial', 'registrar_devolucao', 'registrar_credito'].includes(financialDecision) && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {financialDecision === 'cobranca_parcial' && (
                          <label className="space-y-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            <span>Executado (%)</span>
                            <input
                              id="project-executed-percentage"
                              name="projectExecutedPercentage"
                              autoComplete="off"
                              inputMode="decimal"
                              value={executedPercentage}
                              onChange={(event) => setExecutedPercentage(event.target.value)}
                              className={projectDetailFieldClass}
                              placeholder="Ex.: 40"
                            />
                          </label>
                        )}
                        <label className="space-y-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          <span>{financialDecision === 'cobranca_parcial' ? 'Valor executado' : 'Valor'} (R$)</span>
                          <input
                            id="project-executed-value"
                            name="projectExecutedValue"
                            autoComplete="off"
                            inputMode="decimal"
                            value={executedValue}
                            onChange={(event) => setExecutedValue(event.target.value)}
                            className={projectDetailFieldClass}
                            placeholder="0,00"
                            required={financialDecision !== 'cobranca_parcial'}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                  <label className="block space-y-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <span>Motivo e memória da decisão</span>
                    <textarea
                      id="project-financial-decision-reason"
                      name="projectFinancialDecisionReason"
                      autoComplete="off"
                      value={financialDecisionReason}
                      onChange={(event) => setFinancialDecisionReason(event.target.value)}
                      rows={3}
                      minLength={5}
                      required
                      className={projectDetailFieldClass}
                      placeholder="Descreva o que foi executado e como o saldo deve ser tratado."
                    />
                  </label>
                  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {financialContext?.ultimaDecisao
                        ? `Última decisão: ${financialContext.ultimaDecisao.tipo}.`
                        : 'Nenhuma decisão financeira registrada para este projeto.'}
                    </p>
                    <button
                      type="submit"
                      disabled={financialDecisionMutation.isPending}
                      className={cn(primarySmallActionButtonClass, 'shrink-0 px-4 py-2.5')}
                    >
                      {financialDecisionMutation.isPending ? 'Registrando…' : 'Registrar decisão'}
                    </button>
                  </div>
                  </motion.form>
                  )}
                  </AnimatePresence>
                </section>

                <section className="geo-card p-6 lg:col-span-3" aria-labelledby="financial-timeline-heading">
                  <div>
                    <h3 id="financial-timeline-heading" className="text-lg font-semibold text-zinc-950 dark:text-white">Linha do tempo financeira</h3>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Recebimentos, estornos, cancelamentos e decisões registrados para este projeto.</p>
                  </div>
                  {!financialContext?.eventosFinanceiros?.length ? (
                    <div className="mt-5 rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
                      Nenhum evento financeiro registrado.
                    </div>
                  ) : (
                    <ol className="relative mt-6 space-y-5 border-l border-zinc-200 pl-6 dark:border-zinc-700">
                      {financialContext.eventosFinanceiros.map((event) => {
                        const isReversal = event.tipo.startsWith('estorno_');
                        const isPending = ['cancelamento_projeto_pendente', 'suspensao_projeto_pendente'].includes(event.tipo)
                          && financialContext.decisaoFinanceiraPendente;
                        return (
                          <li key={event.id} className="relative">
                            <span
                              aria-hidden="true"
                              className={cn(
                                'absolute -left-[30px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white dark:ring-zinc-900',
                                isPending ? 'bg-amber-500' : isReversal ? 'bg-rose-500' : 'bg-emerald-500'
                              )}
                            />
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-zinc-950 dark:text-white">
                                  {financialEventLabels[event.tipo] || event.tipo.replaceAll('_', ' ')}
                                </p>
                                {event.motivo && <p className="mt-1 break-words text-sm text-zinc-500 dark:text-zinc-400">{event.motivo}</p>}
                              </div>
                              <div className="shrink-0 text-right">
                                {event.valor !== 0 && (
                                  <p className={cn('font-semibold tabular-nums', event.valor < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                    {formatCurrency(event.valor)}
                                  </p>
                                )}
                                <time dateTime={event.dataEvento} className="text-xs text-zinc-500">
                                  {formatProjectDate(event.dataEvento)}
                                </time>
                              </div>
                            </div>
                            <p className="mt-1 text-[11px] text-zinc-400">
                              {isPending ? 'Pendente' : isReversal ? 'Reversão' : event.tipo === 'decisao_financeira_projeto' ? 'Informativo' : 'Ativo'}
                              {' · '}{event.usuarioId || 'Usuário local'}
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>

                <div className={cn(projectDetailCardClass, 'h-fit')}>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-950 dark:text-white">
                    <Plus aria-hidden="true" className="h-5 w-5 text-zinc-400" /> Registrar despesa
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Use o cadastro financeiro completo. O cliente e este projeto serão vinculados automaticamente ao mesmo lançamento.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(appLinks.finance({ tab: 'pagar', acao: 'despesa', projeto: id }))}
                    className={cn(primarySmallActionButtonClass, 'mt-5 min-h-11 w-full justify-center px-4 py-3')}
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" /> Abrir cadastro completo
                  </button>
                </div>

                {/* Expenses list and summary */}
                <div className="lg:col-span-2 space-y-6">
                  {despesasError && expensePage && (
                    <ProjectPanelError message="Não foi possível atualizar as despesas. Os dados anteriores foram preservados." onRetry={() => { void refetchDespesas(); }} retrying={fetchingDespesas} compact />
                  )}
                  {/* Summary card */}
                  <div className={cn(geoPurpleSurfaceClass, 'geo-card flex flex-col justify-between p-6 text-white')}>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-violet-100/85">Custo total executado no projeto</p>
                      <p className={cn('mt-1 text-3xl font-bold tabular-nums', financialOverrun ? 'text-red-300' : 'text-white')}>{loadingDespesas ? 'Carregando…' : despesasError && !expensePage ? 'Indisponível' : formatCurrency(totalDespesas)}</p>
                      <p className="mt-2 text-xs text-violet-100/75">{despesasError && !expensePage ? 'Tente novamente para consultar os custos.' : financialOverrun ? 'Atenção: custo acima da previsão informada.' : financialNeedsPlanning ? 'Cadastre o custo previsto para acompanhar o consumo.' : 'Valor realizado; sem indicação automática de erro.'}</p>
                    </div>
                  </div>

                  {/* List */}
                  <div className={projectDetailCardClass}>
                    <h3 className="mb-4 text-base font-semibold text-zinc-950 dark:text-white">Detalhamento de custos</h3>

                    {projectDespesas.length >= 10 && (
                      <div className="mb-4 grid gap-3 rounded-xl border border-brand-border bg-brand-surface-subtle p-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtros de despesas">
                        <label className="relative min-w-0 sm:col-span-2">
                          <span className="sr-only">Buscar despesas</span>
                          <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          <input id="project-expense-search" name="expenseSearch" type="search" autoComplete="off" value={expenseSearch} onChange={(event) => setExpenseSearch(event.target.value)} placeholder="Buscar despesas…" className={cn(projectDetailFieldClass, 'pl-9')} />
                        </label>
                        <label>
                          <span className="sr-only">Filtrar despesas por categoria</span>
                          <FormSelect id="project-expense-category-filter" name="expenseCategoryFilter" value={expenseCategoryFilter} onChange={(event) => setExpenseCategoryFilter(event.target.value)} className={projectDetailSelectClass}>
                            <option value="todas">Todas as categorias</option>
                            {expenseCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                          </FormSelect>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label><span className="sr-only">Despesas a partir de</span><DatePickerField id="project-expense-start-filter" name="expenseStartDate" value={expenseStartDate} onChange={(event) => setExpenseStartDate(event.target.value)} className={projectDetailSelectClass} /></label>
                          <label><span className="sr-only">Despesas até</span><DatePickerField id="project-expense-end-filter" name="expenseEndDate" value={expenseEndDate} onChange={(event) => setExpenseEndDate(event.target.value)} className={projectDetailSelectClass} /></label>
                        </div>
                      </div>
                    )}
                    
                    {loadingDespesas ? (
                      <div className="flex items-center justify-center gap-3 py-8" role="status">
                        <motion.div aria-hidden="true" animate={reducedMotion ? undefined : { opacity: [0.5, 1, 0.5] }} transition={reducedMotion ? { duration: 0 } : { repeat: Infinity, duration: 1.5 }} className="h-6 w-6 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary-600 motion-reduce:animate-none" />
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">Carregando despesas…</span>
                      </div>
                    ) : despesasError && !expensePage ? (
                      <ProjectPanelError message="Não foi possível carregar as despesas deste projeto." onRetry={() => { void refetchDespesas(); }} retrying={fetchingDespesas} />
                    ) : projectDespesas.length === 0 ? (
                      <div className="geo-empty-state py-6 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">Nenhuma despesa registrada para este projeto.</div>
                    ) : filteredExpenses.length === 0 ? (
                      <div className="geo-empty-state px-6 py-8 text-center"><p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Nenhuma despesa corresponde aos filtros.</p><button type="button" onClick={() => { setExpenseSearch(''); setExpenseCategoryFilter('todas'); setExpenseStartDate(''); setExpenseEndDate(''); }} className={cn(secondarySmallActionButtonClass, 'mt-4 min-h-11 px-4')}>Limpar filtros</button></div>
                    ) : (
                      <div className="space-y-3">
                        {filteredExpenses.map((exp: Despesa) => {
                          const expenseNeedsAttention = /atras|venc|inadimpl/i.test(exp.status || '');
                          return (
                          <div 
                            key={exp.id}
                            className="geo-card-interactive flex min-w-0 items-center justify-between gap-3 p-4"
                          >
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-zinc-950 dark:text-white">{exp.descricao}</p>
                              <p className="mt-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                                {exp.categoria} · <time dateTime={exp.data}>{formatProjectDate(exp.data)}</time>
                              </p>
                              {exp.observacoes && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 italic mt-1">{exp.observacoes}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={cn('whitespace-nowrap text-sm font-bold tabular-nums', expenseNeedsAttention ? 'text-red-700 dark:text-red-300' : 'text-zinc-950 dark:text-white')}>{formatCurrency(exp.valor)}</span>
                              <button 
                                type="button"
                                onClick={() => setDeleteTarget({ type: 'expense', item: exp })}
                                aria-label={`Excluir despesa ${exp.descricao}`}
                                className="geo-focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-[background-color,color,transform] hover:bg-brand-red-50 hover:text-brand-red-600 active:scale-95 dark:hover:bg-brand-red-400/10"
                              >
                                <Trash aria-hidden="true" className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                  </>
                )}
              </div>
            )}
          </div>
      </section>
      <ProjectFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        project={projeto}
        onSaved={(savedProject) => {
          queryClient.setQueryData<Projeto>(['projeto', id], (current) => current ? { ...current, ...savedProject, nome: savedProject.nome || current.nome } : current);
          void queryClient.invalidateQueries({ queryKey: ['projeto', id] });
          setShowEditModal(false);
        }}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === 'task') deleteTaskMutation.mutate(deleteTarget.item.id);
          if (deleteTarget?.type === 'expense') deleteExpenseMutation.mutate(deleteTarget.item.id);
          if (deleteTarget?.type === 'file') deleteFileMutation.mutate(deleteTarget.filePath);
        }}
        title={deleteTarget?.type === 'task'
          ? `Excluir tarefa “${deleteTarget.item.titulo}”?`
          : deleteTarget?.type === 'expense'
            ? `Excluir despesa “${deleteTarget.item.descricao}”?`
            : `Excluir arquivo${deleteTarget?.fileName ? ` “${deleteTarget.fileName}”` : ''}?`}
        description={deleteTarget?.type === 'task'
          ? 'A tarefa será removida deste projeto e deixará de aparecer nos demais contextos vinculados. O projeto será preservado. Esta ação não pode ser desfeita.'
          : deleteTarget?.type === 'expense'
            ? 'Somente despesas ainda não pagas podem ser excluídas. Despesas pagas exigem estorno para preservar o histórico do projeto.'
            : 'O arquivo será removido permanentemente do disco local e deixará de aparecer nos documentos do projeto. Esta ação não pode ser desfeita.'}
        confirmText={deleteTarget?.type === 'task' ? 'Excluir tarefa' : deleteTarget?.type === 'expense' ? 'Excluir despesa' : 'Excluir arquivo'}
        loading={deleteTaskMutation.isPending || deleteExpenseMutation.isPending || deleteFileMutation.isPending}
      />
      <ConfirmDialog
        isOpen={navigationBlocker.state === 'blocked'}
        onClose={() => {
          if (navigationBlocker.state === 'blocked') navigationBlocker.reset();
        }}
        onConfirm={() => {
          if (navigationBlocker.state === 'blocked') navigationBlocker.proceed();
        }}
        title="Descartar alterações não salvas?"
        description={`Você perderá o rascunho de ${dirtyDraftLabels.join(', ')} ao sair desta página. A troca entre as abas do projeto continua segura.`}
        confirmText="Descartar e sair"
      />
    </Layout>
  );
}
