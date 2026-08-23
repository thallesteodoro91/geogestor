import { toast } from 'sonner';
import { DatePickerField, FormSelect, TimePickerField } from '../../components/Form';
import { PopoverSurface } from '../../components/form-controls/PopoverSurface';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  EnvelopeSimple, 
  Phone, 
  CopySimple,
  Trash, 
  Note, 
  Globe, 
  Tag, 
  IdentificationCard, 
  MapPin, 
  WhatsappLogo, 
  FolderSimple, 
  FileText, 
  Receipt,
  Files, 
  Plus, 
  Check, 
  Calendar,
  ListChecks,
  MapTrifold,
  X,
  ArrowSquareOut,
  Warning,
  Buildings,
  Handshake,
  CurrencyDollar,
  CalendarCheck,
  Briefcase,
  Minus,
  PencilSimple,
  CheckCircle,
  Leaf
} from '@phosphor-icons/react';
import { ClienteCentralControle } from './ClienteCentralControle';
import { ClienteMapaCard } from './ClienteDetalhes/ClienteMapaCard';
import { ClienteSecondaryTabs } from './ClienteDetalhes/ClienteSecondaryTabs';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  getClientCategoryTagClass,
  getClientOriginTagClass,
  getClientStatusTagClass,
  getClientServicoTagClass
} from '../../utils/clientTags';
import { getClientCategoryIcon, getClientCategoryColorClass } from '../../utils/clientIcons';
import { formatCnpj, formatCpf, formatPhoneBR } from '../../utils/formatters';
import { apiClient, apiFetch, getPreviewUrl } from '../../services/apiClient';
import { listBudgetSummaries } from '../../services/budgets';
import { primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { cn } from '../../utils/cn';
import { geoTabButtonClass, geoTabIconClass, geoTabListClass, type GeoTone } from '../../utils/geoTheme';
import { isApprovedBudgetStatus } from '../../utils/budgetStatus';
import { buildBudgetEditorPath } from '../Orcamentos/budgetNavigation';

interface ClienteArquivoItem {
  documentId?: string;
  name: string;
  extension: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  createdAt?: string;
  category?: string;
  categoryId?: string;
  categoryIcon?: string;
  categoryTone?: string;
  relativePath?: string;
  tags?: string[];
}

interface ClientePropriedade {
  id: string;
  nome: string;
  clienteId: string;
  areaHa?: number | null;
  matricula?: string | null;
  car?: string | null;
  ccir?: string | null;
  itr?: string | null;
  cidade?: string | null;
  municipio?: string | null;
  uf?: string | null;
  situacaoImovel?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

type ClienteDetalhesTab = 'visao-geral' | 'propriedades' | 'servicos' | 'ambiental' | 'orcamentos' | 'financeiro' | 'arquivos';
type AreaUnit = 'ha' | 'm2';
type TaskPriority = 'Baixa' | 'Média' | 'Alta';

interface ClienteTask {
  id: string;
  titulo: string;
  status: string;
  prioridade: TaskPriority;
  dataLimite?: string | null;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
}

interface ClienteCompromisso {
  id: string;
  titulo: string;
  data: string;
  hora?: string | null;
  tipo: string;
  descricao?: string | null;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string | null;
  isProjectDeadline?: boolean;
}

const CLIENT_DETAIL_TABS: ClienteDetalhesTab[] = ['visao-geral', 'propriedades', 'servicos', 'ambiental', 'orcamentos', 'financeiro', 'arquivos'];
const CLIENT_DETAIL_TAB_TONES: Record<ClienteDetalhesTab, GeoTone> = {
  'visao-geral': 'system',
  propriedades: 'success',
  servicos: 'field',
  ambiental: 'success',
  orcamentos: 'warning',
  financeiro: 'finance',
  arquivos: 'system'
};

const splitClientTags = (value?: string | null) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const formatOptionalDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
};

const PREVIEWABLE_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
const canPreviewFile = (file: ClienteArquivoItem) => PREVIEWABLE_EXTENSIONS.includes(file.extension.toLowerCase());

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(sizeBytes / 1024).toFixed(1)} KB`;
};

function formatAreaValue(areaM2: number, unit: AreaUnit) {
  const value = unit === 'ha' ? areaM2 / 10000 : areaM2;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: unit === 'ha' ? 2 : 0,
    maximumFractionDigits: unit === 'ha' ? 2 : 0
  }).format(value);
}

function isCompletedStatus(status?: string | null) {
  return status === 'Concluído' || status === 'Concluido';
}

export function ClienteDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const requestedTab = new URLSearchParams(location.search).get('tab') as ClienteDetalhesTab | null;
  const activeTab: ClienteDetalhesTab = requestedTab && CLIENT_DETAIL_TABS.includes(requestedTab)
    ? requestedTab
    : 'visao-geral';

  const [previewFile, setPreviewFile] = useState<ClienteArquivoItem | null>(null);
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('ha');
  const [copiedContactField, setCopiedContactField] = useState<string | null>(null);
  const [showAlertasPopover, setShowAlertasPopover] = useState(false);
  const [isQualityAlertPulsing, setIsQualityAlertPulsing] = useState(false);
  const [alertAnnouncement, setAlertAnnouncement] = useState('');
  const alertButtonRef = useRef<HTMLButtonElement>(null);
  const alertPopoverRef = useRef<HTMLDivElement>(null);
  const qualityAlertAcknowledgedRef = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'task'; item: ClienteTask }
    | { type: 'agenda'; item: ClienteCompromisso }
    | null
  >(null);

  const routeParams = new URLSearchParams(location.search);
  const focusedDocumentId = routeParams.get('documentId');
  const initialDocumentSearch = routeParams.get('arquivo') || '';
  const focusedOrcamentoId = routeParams.get('orcamentoId');

  const handleTabChange = (tab: ClienteDetalhesTab) => {
    const params = new URLSearchParams(location.search);

    if (tab === 'visao-geral') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }

    navigate({
      pathname: location.pathname,
      search: params.toString() ? `?${params.toString()}` : ''
    });
  };

  const handleTabKeyDown = (event: React.KeyboardEvent, currentTab: ClienteDetalhesTab) => {
    const currentIndex = CLIENT_DETAIL_TABS.indexOf(currentTab);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % CLIENT_DETAIL_TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + CLIENT_DETAIL_TABS.length) % CLIENT_DETAIL_TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = CLIENT_DETAIL_TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = CLIENT_DETAIL_TABS[nextIndex];
    handleTabChange(nextTab);
    window.requestAnimationFrame(() => document.getElementById(`cliente-tab-${nextTab}`)?.focus());
  };

  // 1. Fetch Client Dashboard Info (Consolidated Endpoint)
  const { data: dashboardData, isLoading: loadingCliente } = useQuery({
    queryKey: ['cliente-dashboard', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/clientes/${id}/dashboard`);
      if (!res.ok) throw new Error('Cliente não encontrado');
      return res.json();
    },
    enabled: !!id
  });

  const cliente = dashboardData?.cliente;

  useEffect(() => {
    if (!cliente?.nome) return undefined;
    const previousTitle = document.title;
    document.title = `${cliente.nome} — GeoGestor`;
    return () => { document.title = previousTitle; };
  }, [cliente?.nome]);

  // Prefetch tabs on load
  useEffect(() => {
    if (id) {
      queryClient.prefetchQuery({
        queryKey: ['projetos', id],
        queryFn: () => apiClient.getAllPages(`/api/projetos?clienteId=${id}`)
      });
      // Optionally prefetch other tabs based on priority
    }
  }, [id, queryClient]);

  useEffect(() => {
    if (loadingCliente) return;

    const activeTabElement = document.getElementById(`cliente-tab-${activeTab}`);
    const tabList = activeTabElement?.parentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!activeTabElement || !tabList) return;

    const targetLeft = activeTabElement.offsetLeft
      - Math.max(0, (tabList.clientWidth - activeTabElement.offsetWidth) / 2);

    tabList.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
  }, [activeTab, loadingCliente]);

  // 2. Fetch Client's CRM History
  const { data: historico = [], isLoading: loadingHistorico } = useQuery<Array<{
    id: string;
    tipo: string;
    titulo?: string | null;
    categoria?: string | null;
    projetoId?: string | null;
    orcamentoId?: string | null;
    manual?: boolean | null;
    data: string;
    descricao: string;
  }>>({
    queryKey: ['cliente-historico', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/clientes/${id}/historico`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  // 3. Fetch Projects (filtered by client in backend)
  const { data: projetos = [] } = useQuery<Array<{
    id: string;
    nome: string;
    clienteId?: string | null;
    descricao?: string | null;
    areaHa?: number | null;
    cidade?: string | null;
    municipio?: string | null;
    dataInicio?: string | null;
    dataEntrega?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    status?: string | null;
    matricula?: string | null;
    car?: string | null;
    ccir?: string | null;
    itr?: string | null;
    situacaoImovel?: string | null;
    tipo?: string | null;
    observacoes?: string | null;
  }>>({
    queryKey: ['projetos', id],
    queryFn: () => apiClient.getAllPages(`/api/projetos?clienteId=${id}`),
    enabled: !!id && (activeTab === 'servicos' || activeTab === 'ambiental' || activeTab === 'visao-geral')
  });

  const clientProjetos = projetos;

  const { data: propriedadesData } = useQuery<{ items: ClientePropriedade[] }>({
    queryKey: ['cliente-propriedades', id],
    queryFn: () => apiClient.get<{ items: ClientePropriedade[] }>(`/api/dados-operacionais/propriedades?clienteId=${id}&limit=100`),
    enabled: !!id && (activeTab === 'visao-geral' || activeTab === 'propriedades')
  });

  const clientProperties = propriedadesData?.items || [];
  const clientAmbientalProjetos = useMemo(
    () => clientProjetos.filter((project) => {
      const type = (project.tipo || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      return ['ambiental', 'licenciamento', 'pericia'].some((category) => type.includes(category));
    }),
    [clientProjetos]
  );

  // Task form state
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitulo, setTaskTitulo] = useState('');
  const [taskPrioridade, setTaskPrioridade] = useState<TaskPriority>('Média');
  const [taskDataLimite, setTaskDataLimite] = useState('');
  const [taskProjetoId, setTaskProjetoId] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Agenda form state
  const [showAgendaForm, setShowAgendaForm] = useState(false);
  const [agendaTitulo, setAgendaTitulo] = useState('');
  const [agendaData, setAgendaData] = useState(new Date().toISOString().split('T')[0]);
  const [agendaHora, setAgendaHora] = useState('14:00');
  const [agendaTipo, setAgendaTipo] = useState('Reunião');
  const [agendaProjetoId, setAgendaProjetoId] = useState('');
  const [agendaDescricao, setAgendaDescricao] = useState('');
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null);

  // 1. Fetch Checklist Tasks
  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery<ClienteTask[]>({
    queryKey: ['cliente-central-tarefas', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/tarefas?clienteId=${id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id && activeTab === 'visao-geral'
  });

  // 2. Fetch Agenda Compromissos
  const { data: compromissos = [], isLoading: loadingCompromissos } = useQuery<ClienteCompromisso[]>({
    queryKey: ['cliente-central-compromissos', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/compromissos?clienteId=${id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id && activeTab === 'visao-geral'
  });

  const projetoIds = useMemo(() => new Set(clientProjetos.map(p => p.id)), [clientProjetos]);

  const clienteTarefas = useMemo(
    () => tarefas.filter((tarefa) => tarefa.clienteId === id || (tarefa.projetoId && projetoIds.has(tarefa.projetoId))),
    [id, projetoIds, tarefas]
  );

  const clienteCompromissos = useMemo(
    () => compromissos.filter((compromisso) => compromisso.clienteId === id || (compromisso.projetoId && projetoIds.has(compromisso.projetoId))),
    [id, compromissos, projetoIds]
  );

  const isDone = (status?: string | null) => status === 'Concluído' || status === 'Finalizado';

  const tarefasPendentes = clienteTarefas.filter((tarefa) => !isDone(tarefa.status));
  const tarefasConcluidas = clienteTarefas.length - tarefasPendentes.length;
  const taskProgress = clienteTarefas.length > 0 ? Math.round((tarefasConcluidas / clienteTarefas.length) * 100) : 0;

  const nextCompromissos = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingCompromissos = clienteCompromissos
      .filter((item) => new Date(`${item.data}T00:00:00`).getTime() >= today.getTime())
      .map((item) => ({ ...item, isProjectDeadline: false as const }));

    const upcomingProjetos = clientProjetos
      .filter(p => p.dataEntrega && new Date(`${p.dataEntrega}T00:00:00`).getTime() >= today.getTime())
      .map(p => ({
        id: `proj-${p.id}`,
        titulo: `Entrega: ${p.nome}`,
        projetoNome: p.nome,
        clienteNome: '',
        data: p.dataEntrega!,
        hora: 'Dia todo',
        tipo: 'Projeto',
        isProjectDeadline: true as const
      }));

    return [...upcomingCompromissos, ...upcomingProjetos]
      .sort((a, b) => new Date(`${a.data}T00:00:00`).getTime() - new Date(`${b.data}T00:00:00`).getTime())
      .slice(0, 15);
  }, [clienteCompromissos, clientProjetos]);

  const formatDateShort = (dateStr: string, includeTime = false) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: includeTime ? '2-digit' : undefined,
        minute: includeTime ? '2-digit' : undefined
      });
    } catch {
      return dateStr;
    }
  };

  const getTaskPriorityTone = (priority: string) => {
    switch (priority) {
      case 'Alta':
        return {
          cardClass: 'border-l-rose-500 bg-rose-50/20 dark:bg-rose-950/10 dark:border-l-rose-500',
          badgeClass: 'bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-950/20 dark:text-rose-450 dark:ring-rose-500/20',
          label: 'Alta'
        };
      case 'Média':
        return {
          cardClass: 'border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/10 dark:border-l-amber-500',
          badgeClass: 'bg-amber-50 text-amber-700 ring-amber-600/10 dark:bg-amber-950/20 dark:text-amber-450 dark:ring-amber-500/20',
          label: 'Média'
        };
      default:
        return {
          cardClass: 'border-l-sky-500 bg-sky-50/20 dark:bg-sky-950/10 dark:border-l-sky-500',
          badgeClass: 'bg-sky-50 text-sky-700 ring-sky-600/10 dark:bg-sky-950/20 dark:text-sky-450 dark:ring-sky-500/20',
          label: 'Baixa'
        };
    }
  };

  const resetTaskForm = () => {
    setTaskTitulo('');
    setTaskPrioridade('Média');
    setTaskDataLimite('');
    setTaskProjetoId('');
    setEditingTaskId(null);
  };

  const handleEditTask = (task: ClienteTask) => {
    setEditingTaskId(task.id);
    setTaskTitulo(task.titulo);
    setTaskPrioridade(task.prioridade);
    setTaskDataLimite(task.dataLimite ? task.dataLimite.split('T')[0] : '');
    setTaskProjetoId(task.projetoId || '');
    setShowTaskForm(true);
  };

  const addTaskMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: taskTitulo.trim(),
        prioridade: taskPrioridade,
        dataLimite: taskDataLimite || null,
        projetoId: taskProjetoId || null,
        clienteId: id,
        status: 'A Fazer'
      };
      
      const endpoint = editingTaskId
        ? `/api/tarefas/${editingTaskId}`
        : '/api/tarefas';
        
      const res = await apiFetch(endpoint, {
        method: editingTaskId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erro ao salvar tarefa');
      return res.json();
    },
    onSuccess: () => {
      resetTaskForm();
      setShowTaskForm(false);
      queryClient.invalidateQueries({ queryKey: ['cliente-central-tarefas', id] });
    },
    onError: () => toast.error('Erro ao salvar tarefa.')
  });

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitulo.trim()) {
      toast.error('Por favor, informe o título da tarefa.');
      return;
    }
    addTaskMutation.mutate();
  };

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiFetch(`/api/tarefas/${taskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir tarefa');
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['cliente-central-tarefas', id] });
    },
    onError: () => toast.error('Erro ao excluir tarefa.')
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<ClienteTask> }) => {
      const res = await apiFetch(`/api/tarefas/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Erro ao atualizar tarefa');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-central-tarefas', id] });
    },
    onError: () => toast.error('Erro ao atualizar tarefa.')
  });

  // Agenda mutations
  const resetAgendaForm = () => {
    setAgendaTitulo('');
    setAgendaData(new Date().toISOString().split('T')[0]);
    setAgendaHora('14:00');
    setAgendaTipo('Reunião');
    setAgendaProjetoId('');
    setAgendaDescricao('');
    setEditingAgendaId(null);
  };

  const handleEditAgenda = (comp: ClienteCompromisso) => {
    setEditingAgendaId(comp.id);
    setAgendaTitulo(comp.titulo);
    setAgendaData(comp.data);
    setAgendaHora(comp.hora || '14:00');
    setAgendaTipo(comp.tipo);
    setAgendaProjetoId(comp.projetoId || '');
    setAgendaDescricao(comp.descricao || '');
    setShowAgendaForm(true);
  };

  const addAgendaMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: agendaTitulo.trim(),
        data: agendaData,
        hora: agendaHora || null,
        tipo: agendaTipo,
        descricao: agendaDescricao.trim() || null,
        projetoId: agendaProjetoId || null,
        clienteId: id
      };
      
      const endpoint = editingAgendaId
        ? `/api/compromissos/${editingAgendaId}`
        : '/api/compromissos';
        
      const res = await apiFetch(endpoint, {
        method: editingAgendaId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erro ao salvar compromisso');
      return res.json();
    },
    onSuccess: () => {
      resetAgendaForm();
      setShowAgendaForm(false);
      queryClient.invalidateQueries({ queryKey: ['cliente-central-compromissos', id] });
    },
    onError: () => toast.error('Erro ao salvar compromisso.')
  });

  const handleAddAgenda = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agendaTitulo.trim() || !agendaData) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }
    addAgendaMutation.mutate();
  };

  const deleteAgendaMutation = useMutation({
    mutationFn: async (compStatusId: string) => {
      const res = await apiFetch(`/api/compromissos/${compStatusId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir compromisso');
    },
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['cliente-central-compromissos', id] });
    },
    onError: () => toast.error('Erro ao excluir compromisso.')
  });

  // 4. Fetch Budgets (filtered by client)
  const { data: orcamentos = [] } = useQuery<Array<{
    id: string;
    clienteId?: string | null;
    projetoId?: string | null;
    projetoNome?: string | null;
    status?: string | null;
    valorTotal?: number | null;
    codigoOrcamento?: string | null;
    descricao?: string | null;
    formaDePagamento?: string | null;
    desconto?: number | null;
    createdAt?: string | null;
    dataOrcamento?: string | null;
  }>>({
    queryKey: ['orcamentos', id],
    queryFn: async () => (await listBudgetSummaries(id)).map((budget) => ({
      id: budget.id,
      clienteId: budget.clientId,
      projetoId: budget.projectId,
      projetoNome: budget.projectName,
      status: budget.status,
      valorTotal: budget.totalCents,
      codigoOrcamento: budget.number,
      descricao: budget.description,
      createdAt: budget.createdAt,
      dataOrcamento: budget.issueDate
    })),
    enabled: !!id && ['visao-geral', 'orcamentos', 'financeiro'].includes(activeTab)
  });

  const clientOrcamentos = orcamentos;

  // 5. Fetch Client Files
  const { data: filesData = { files: [], path: '' } } = useQuery<{
    files: ClienteArquivoItem[];
    path: string;
  }>({
    queryKey: ['cliente-arquivos', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/arquivos/cliente/${id}`);
      if (res.ok) {
        const data = await res.json();
        return { files: data.files || [], path: data.path || '' };
      }
      return { files: [], path: '' };
    },
    enabled: !!id && activeTab === 'visao-geral'
  });

  const clientFiles = filesData.files;
  const projectIdsForAlerts = clientProjetos.map((project) => project.id).join('|');
  const clientProjectIdSet = useMemo(() => new Set(clientProjetos.map((project) => project.id)), [clientProjetos]);

  const { data: clienteTarefasResumo = [] } = useQuery<Array<{
    id: string;
    clienteId?: string | null;
    projetoId?: string | null;
    status?: string | null;
    dataLimite?: string | null;
  }>>({
    queryKey: ['cliente-central-tarefas', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/tarefas?clienteId=${id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  const { data: arquivosResumoOperacional = { cliente: 0, projetos: {} as Record<string, number>, total: 0 } } = useQuery<{
    cliente: number;
    projetos: Record<string, number>;
    total: number;
  }>({
    queryKey: ['cliente-central-arquivos', id, projectIdsForAlerts],
    queryFn: async () => {
      const clienteFilesResumo = await apiFetch(`/api/arquivos/cliente/${id}`)
        .then((res) => (res.ok ? res.json() : { files: [] }))
        .catch(() => ({ files: [] }));

      const projetosFiles = await Promise.all(clientProjetos.map(async (project) => {
        const data = await apiFetch(`/api/arquivos/projeto/${project.id}`)
          .then((res) => (res.ok ? res.json() : { files: [] }))
          .catch(() => ({ files: [] }));
        return [project.id, Array.isArray(data.files) ? data.files.length : 0] as const;
      }));

      const projetosMap = Object.fromEntries(projetosFiles);
      const clienteCount = Array.isArray(clienteFilesResumo.files) ? clienteFilesResumo.files.length : 0;
      const projetosCount = Object.values(projetosMap).reduce((acc, count) => acc + count, 0);

      return {
        cliente: clienteCount,
        projetos: projetosMap,
        total: clienteCount + projetosCount
      };
    },
    enabled: !!id
  });

  const handleOpenFile = async (filePath: string) => {
    const res = await apiFetch('/api/arquivos/open-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath })
    });

    if (!res.ok) {
      toast.error('Não foi possível abrir o arquivo no aplicativo padrão.');
    }
  };

  const handlePreviewFile = (file: ClienteArquivoItem) => {
    if (canPreviewFile(file)) {
      setPreviewFile(file);
      return;
    }

    void handleOpenFile(file.path);
  };


  const tarefasClienteResumo = useMemo(() => {
    return clienteTarefasResumo.filter((task) => (
      task.clienteId === id || (task.projetoId ? clientProjectIdSet.has(task.projetoId) : false)
    ));
  }, [clienteTarefasResumo, id, clientProjectIdSet]);

  const tarefasVencidasResumo = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return tarefasClienteResumo.filter((task) => {
      if (!task.dataLimite || isCompletedStatus(task.status)) return false;
      const dueDate = new Date(`${task.dataLimite}T23:59:59`);
      return dueDate.getTime() < now;
    }).length;
  }, [tarefasClienteResumo]);

  const getStatusColor = (status: string) => {
    return getClientStatusTagClass(status);
  };

  const qualityIssues = useMemo(() => {
    if (!cliente) return [] as string[];

    const storedReviewReasons = (() => {
      try {
        return JSON.parse(cliente.revisaoMotivos || '[]') as string[];
      } catch {
        return [] as string[];
      }
    })();

    const propertyCount = activeTab === 'visao-geral' || activeTab === 'propriedades'
      ? clientProperties.length
      : Number(dashboardData?.kpis?.propriedades || 0);

    return [
      ...storedReviewReasons.map((reason) => ({
        cpf_invalido: 'CPF inválido',
        cnpj_invalido: 'CNPJ inválido',
        endereco_nao_estruturado: 'Endereço ainda não estruturado',
        categoria_tipo_pessoa_ambiguo: 'Categoria ou tipo de pessoa legado',
        tipo_pessoa_ausente: 'Tipo de pessoa não informado'
      }[reason] || 'Cadastro requer revisão')),
      ...(propertyCount === 0 ? ['Cliente sem propriedade'] : []),
      ...(Number(dashboardData?.quality?.documentReviewCount || 0) > 0 ? ['Documento ativo com arquivo ausente'] : [])
    ].filter((issue, index, values) => values.indexOf(issue) === index);
  }, [activeTab, clientProperties.length, cliente, dashboardData?.kpis?.propriedades, dashboardData?.quality?.documentReviewCount]);

  const qualityAlertSignature = useMemo(
    () => qualityIssues.slice().sort().join('\u001f'),
    [qualityIssues]
  );

  useEffect(() => {
    const storageKey = id ? `geogestor:client-quality-alert:${id}` : '';
    let ignored = false;

    if (storageKey && qualityAlertSignature) {
      try {
        ignored = window.sessionStorage.getItem(storageKey) === qualityAlertSignature;
      } catch {
        ignored = false;
      }
    }

    qualityAlertAcknowledgedRef.current = ignored || qualityIssues.length === 0;

    const initialPulse = window.setTimeout(() => {
      setIsQualityAlertPulsing(!qualityAlertAcknowledgedRef.current);
    }, 0);
    const initialStop = window.setTimeout(() => setIsQualityAlertPulsing(false), 1_400);
    const reminderPulse = window.setTimeout(() => {
      if (!qualityAlertAcknowledgedRef.current) setIsQualityAlertPulsing(true);
    }, 10_000);
    const reminderStop = window.setTimeout(() => setIsQualityAlertPulsing(false), 11_400);

    return () => {
      window.clearTimeout(initialPulse);
      window.clearTimeout(initialStop);
      window.clearTimeout(reminderPulse);
      window.clearTimeout(reminderStop);
    };
  }, [id, qualityAlertSignature, qualityIssues.length]);

  useEffect(() => {
    if (!showAlertasPopover) return undefined;

    const focusFrame = window.requestAnimationFrame(() => {
      alertPopoverRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    });
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (alertButtonRef.current?.contains(target) || alertPopoverRef.current?.contains(target)) return;
      setShowAlertasPopover(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setShowAlertasPopover(false);
      window.requestAnimationFrame(() => alertButtonRef.current?.focus());
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAlertasPopover]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  if (loadingCliente) {
    return (
      <Layout>
        <div className="py-24 flex justify-center">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!cliente) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Cliente não encontrado</h2>
          <button onClick={() => navigate('/clientes')} className="px-4 py-2 bg-zinc-950 text-white rounded-xl">
            Voltar para lista de clientes
          </button>
        </div>
      </Layout>
    );
  }

  // Calculate KPIs
  const totalAreaCadastroM2 = clientProperties.reduce((acc, property) => acc + ((Number(property.areaHa) || 0) * 10000), 0);
  const totalAreaMapeadaM2 = totalAreaCadastroM2;
  const areaSource = totalAreaCadastroM2 > 0 ? 'Soma das propriedades cadastradas' : 'Sem área informada';
  const featuredProperty = clientProperties[0] || null;
  const featuredProject = clientProjetos.find((project) => ['Ativo', 'Em Andamento'].includes(project.status || '')) || clientProjetos[0] || null;
  const addressNumber = cliente.semNumero ? 'S/N' : cliente.numero;
  const cityState = [cliente.municipio, cliente.uf].filter(Boolean).join(' / ');
  const fullAddressValue = [
    cliente.endereco,
    addressNumber,
    cliente.complemento,
    cliente.bairro,
    cityState,
    cliente.cep
  ].filter(Boolean).join(', ');
  const featuredProjectLocation = featuredProperty
    ? [featuredProperty.cidade, featuredProperty.municipio].filter(Boolean).join(' / ') || fullAddressValue || 'Localidade não informada'
    : fullAddressValue || 'Localidade não informada';
  const operationalProjectName = featuredProperty?.nome || 'Cliente sem propriedade vinculada';
  // A data pertence ao projeto; o campo do cliente é apenas um fallback para cadastros legados.
  const deliveryForecast = featuredProject?.dataEntrega || cliente.previsaoEntrega || '';
  const featuredProjectRegistries = featuredProperty
    ? [
        { label: 'CAR', value: featuredProperty.car },
        { label: 'Matrícula', value: featuredProperty.matricula },
        { label: 'CCIR', value: featuredProperty.ccir },
        { label: 'ITR', value: featuredProperty.itr }
      ].filter((registry) => Boolean(registry.value))
    : [];
  const clientServicos = splitClientTags(cliente.servicos);
  const featuredProjectTags = clientServicos.map((svc) => ({
    label: svc,
    className: getClientServicoTagClass(svc).replace('ring-1', 'border border-current/10')
  }));
  const totalReceita = clientOrcamentos
    .filter((o) => isApprovedBudgetStatus(o.status))
    .reduce((acc: number, cur) => acc + (Number(cur.valorTotal) || 0), 0);
  const clientFinancialKpis = dashboardData?.kpis || {};
  const orcamentosPorStatus = clientOrcamentos.reduce<Record<string, { count: number; total: number }>>((acc, orc) => {
    const status = orc.status || 'Sem status';
    if (!acc[status]) acc[status] = { count: 0, total: 0 };
    acc[status].count += 1;
    acc[status].total += Number(orc.valorTotal) || 0;
    return acc;
  }, {});
  const clientCategories = splitClientTags(cliente.categoria);
  const clientOrigins = splitClientTags(cliente.origem);
  const primaryPhoneValue = cliente.celular || cliente.telefone || '';
  const secondaryPhoneValue = cliente.celular && cliente.telefone ? cliente.telefone : '';
  const documentValue = cliente.cpf
    ? formatCpf(cliente.cpf)
    : cliente.cnpj
      ? formatCnpj(cliente.cnpj)
      : cliente.documento || '';
  const documentPrefix = cliente.cpf ? 'CPF' : cliente.cnpj ? 'CNPJ' : 'Documento';
  const whatsappDigits = (cliente.celular || '').replace(/\D/g, '');
  const whatsappUrl = whatsappDigits
    ? `https://wa.me/${whatsappDigits.startsWith('55') ? whatsappDigits : `55${whatsappDigits}`}`
    : '';
  const orcamentosSemPropriedadeResumo = clientOrcamentos.filter((orcamento) => !orcamento.projetoId).length;
  const propriedadesSemMapaResumo = clientProjetos.filter((project) => !project.latitude || !project.longitude).length;
  const alertasOperacionaisResumo = [
    tarefasVencidasResumo > 0 ? `${tarefasVencidasResumo} tarefa(s) vencida(s)` : null,
    orcamentosSemPropriedadeResumo > 0 ? `${orcamentosSemPropriedadeResumo} orçamento(s) sem propriedade vinculada` : null,
    propriedadesSemMapaResumo > 0 ? `${propriedadesSemMapaResumo} propriedade(s) sem coordenadas ou mapa` : null,
    arquivosResumoOperacional.total === 0 ? 'Nenhum documento encontrado nas pastas do cliente ou propriedades' : null
  ].filter(Boolean) as string[];

  const handleCopyContact = async (field: string, value?: string | null) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedContactField(field);
      window.setTimeout(() => setCopiedContactField((current) => (current === field ? null : current)), 1400);
    } catch {
      toast.error('Não foi possível copiar este dado automaticamente.');
    }
  };

  const closeAlertsPopover = (restoreFocus = false) => {
    setShowAlertasPopover(false);
    if (restoreFocus) window.requestAnimationFrame(() => alertButtonRef.current?.focus());
  };

  const handleAlertsToggle = () => {
    qualityAlertAcknowledgedRef.current = true;
    setIsQualityAlertPulsing(false);
    setAlertAnnouncement(qualityIssues.length === 1
      ? '1 pendência cadastral disponível nos alertas.'
      : qualityIssues.length > 1
        ? `${qualityIssues.length} pendências cadastrais disponíveis nos alertas.`
        : 'Alertas do cliente abertos.');
    setShowAlertasPopover((current) => !current);
  };

  const handleIgnoreQualityAlert = () => {
    if (id && qualityAlertSignature) {
      try {
        window.sessionStorage.setItem(`geogestor:client-quality-alert:${id}`, qualityAlertSignature);
      } catch {
        // A dispensa continua válida nesta visualização mesmo sem armazenamento de sessão.
      }
    }
    qualityAlertAcknowledgedRef.current = true;
    setIsQualityAlertPulsing(false);
    setAlertAnnouncement('Aviso cadastral ignorado por agora. As pendências continuam registradas no cadastro.');
    closeAlertsPopover(true);
  };

  const handleReviewCadastro = () => {
    setShowAlertasPopover(false);
    navigate('/clientes', { state: { editClienteId: id, returnToClienteId: id } });
  };

  const alertButtonLabel = qualityIssues.length === 1
    ? 'Alertas, 1 pendência cadastral'
    : qualityIssues.length > 1
      ? `Alertas, ${qualityIssues.length} pendências cadastrais`
      : 'Alertas do cliente';

  const quickActions = [
    {
      label: 'Editar',
      icon: <Note className="h-6 w-6 text-sky-600 dark:text-sky-300" />,
      onClick: () => navigate('/clientes', { state: { editClienteId: id, returnToClienteId: id } }),
      className: 'border-sky-200/70 bg-sky-50/80 text-sky-900 hover:border-sky-300 hover:bg-sky-100/80 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/15'
    },
    {
      label: 'Propriedade',
      icon: <Plus className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />,
      onClick: () => navigate('/projetos', { state: { createForClienteId: id, modalTab: 'propriedade' } }),
      className: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-100/80 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:bg-emerald-500/15'
    },
    {
      label: 'Serviço',
      icon: <FolderSimple className="h-6 w-6 text-violet-600 dark:text-violet-300" />,
      onClick: () => navigate('/projetos', { state: { createForClienteId: id, modalTab: 'projeto' } }),
      className: 'border-violet-200/70 bg-violet-50/80 text-violet-900 hover:border-violet-300 hover:bg-violet-100/80 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100 dark:hover:bg-violet-500/15'
    },
    {
      label: 'Orçamento',
      icon: <FileText className="h-6 w-6 text-sky-600 dark:text-sky-300" />,
      onClick: () => navigate(buildBudgetEditorPath({ clientId: id })),
      className: 'border-sky-200/80 bg-sky-50/90 text-sky-900 hover:border-sky-300 hover:bg-sky-100/90 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/20'
    }
  ];

  const clientWorkspaceTabs = [
    {
      id: 'visao-geral' as const,
      label: 'Visão Geral',
      tone: 'border-blue-300/30 bg-zinc-100/85 text-blue-700 ring-blue-300/20 shadow-[inset_0_-2px_0_rgba(37,99,235,0.55)] dark:bg-zinc-800/90 dark:text-blue-300 dark:ring-blue-300/20 dark:shadow-[inset_0_-2px_0_rgba(96,165,250,0.55)]',
      iconTone: 'text-blue-300',
      icon: <IdentificationCard weight="duotone" className="h-5 w-5" />
    },
    {
      id: 'propriedades' as const,
      label: 'Propriedades',
      count: activeTab === 'propriedades' || activeTab === 'visao-geral' ? clientProperties.length : Number(dashboardData?.kpis?.propriedades || 0),
      tone: 'border-emerald-300/30 bg-zinc-100/85 text-emerald-700 ring-emerald-300/20 dark:bg-zinc-800/90 dark:text-emerald-300',
      iconTone: 'text-emerald-300',
      icon: <Buildings weight="duotone" className="h-5 w-5" />
    },
    {
      id: 'servicos' as const,
      label: 'Serviços',
      count: clientProjetos.length || Number(dashboardData?.kpis?.projetos || 0),
      tone: 'border-orange-300/30 bg-zinc-100/85 text-orange-800 ring-orange-300/20 shadow-[inset_0_-2px_0_rgba(194,101,48,0.55)] dark:bg-zinc-800/90 dark:text-orange-300 dark:ring-orange-300/20 dark:shadow-[inset_0_-2px_0_rgba(253,186,116,0.52)]',
      iconTone: 'text-orange-300',
      icon: <FolderSimple weight="duotone" className="h-5 w-5" />
    },
    {
      id: 'ambiental' as const,
      label: 'Ambiental',
      count: clientAmbientalProjetos.length,
      tone: 'border-emerald-300/30 bg-zinc-100/85 text-emerald-700 ring-emerald-300/20 shadow-[inset_0_-2px_0_rgba(5,150,105,0.55)] dark:bg-zinc-800/90 dark:text-emerald-300 dark:ring-emerald-300/20 dark:shadow-[inset_0_-2px_0_rgba(110,231,183,0.55)]',
      iconTone: 'text-emerald-300',
      icon: <Leaf weight="duotone" className="h-5 w-5" />
    },
    {
      id: 'orcamentos' as const,
      label: 'Orçamentos',
      count: clientOrcamentos.length,
      tone: 'border-amber-300/30 bg-zinc-100/85 text-amber-700 ring-amber-300/20 shadow-[inset_0_-2px_0_rgba(217,119,6,0.55)] dark:bg-zinc-800/90 dark:text-amber-300 dark:ring-amber-300/20 dark:shadow-[inset_0_-2px_0_rgba(252,211,77,0.55)]',
      iconTone: 'text-amber-300',
      icon: <Receipt weight="duotone" className="h-5 w-5" />
    },
    {
      id: 'financeiro' as const,
      label: 'Financeiro',
      tone: 'border-violet-300/30 bg-zinc-100/85 text-violet-700 ring-violet-300/20 shadow-[inset_0_-2px_0_rgba(124,58,237,0.58)] dark:bg-zinc-800/90 dark:text-violet-300 dark:ring-violet-300/20 dark:shadow-[inset_0_-2px_0_rgba(167,139,250,0.58)]',
      iconTone: 'text-violet-300',
      icon: <CurrencyDollar weight="duotone" className="h-5 w-5" />
    },
    {
      id: 'arquivos' as const,
      label: 'Arquivos',
      count: activeTab === 'arquivos' ? clientFiles.length : Number(dashboardData?.kpis?.documentos || 0),
      tone: 'border-slate-300/30 bg-zinc-100/85 text-slate-700 ring-slate-300/20 shadow-[inset_0_-2px_0_rgba(148,163,184,0.55)] dark:bg-zinc-800/90 dark:text-slate-300 dark:ring-slate-300/20 dark:shadow-[inset_0_-2px_0_rgba(203,213,225,0.45)]',
      iconTone: 'text-slate-300',
      icon: <Files weight="duotone" className="h-5 w-5" />
    }
  ];

  return (
    <Layout contentClassName="max-w-none">
      {/* Top Bar with back button */}
      <div className="mb-6 flex items-center gap-4">
        <button 
          onClick={() => navigate('/clientes')}
          aria-label="Voltar para clientes"
          className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-950 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <ArrowLeft weight="bold" className="w-4 h-4" />
        </button>
        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Link to="/clientes" className="hover:text-zinc-900 dark:text-zinc-100 transition-colors">Clientes</Link>
          <span className="mx-2 text-zinc-300">/</span>
          <span className="text-zinc-950 dark:text-white">{cliente.nome}</span>
        </div>
      </div>

      {/* Page Header */}
      <div className="mb-6 flex items-start gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center ${getClientCategoryColorClass(cliente.categoria)}`}>
          {getClientCategoryIcon(cliente.categoria, "w-12 h-12")}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tighter text-zinc-950 dark:text-white md:text-[2.25rem]">{cliente.nome}</h1>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Classificação do cliente">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-500/30">
              {cliente.tipoPessoa === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-base xl:whitespace-nowrap">
            Perfil detalhado, propriedades, serviços, orçamentos, financeiro e central de controle do relacionamento.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 items-start gap-x-5 gap-y-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(310px,0.8fr)]">
        <div className={cn('flex w-full min-w-0 flex-col gap-4', activeTab === 'visao-geral' ? 'xl:col-start-1' : 'xl:col-span-2')}>
        <div
          className="grid w-full min-w-0 self-start gap-4 lg:grid-cols-[92px_minmax(0,1fr)] lg:grid-rows-[auto_auto]"
        >
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            <div className="flex min-w-max gap-2 rounded-2xl border border-zinc-200/80 bg-white/90 p-1.5 shadow-sm dark:border-zinc-700/70 dark:bg-zinc-800/80 lg:min-w-0 lg:flex-col">
              <p className="hidden w-full px-1 py-1.5 text-center text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:text-zinc-300 lg:block">
                AÇÕES
              </p>
              <p className="sr-only" aria-live="polite" aria-atomic="true">{alertAnnouncement}</p>
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={cn(
                    'relative inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-[11px] font-semibold shadow-sm transition-[transform,box-shadow,background-color,border-color] active:scale-[0.98] lg:h-auto lg:min-h-[50px] lg:flex-col lg:gap-1.5 lg:px-1 lg:py-2.5',
                    action.className
                  )}
                >
                  {action.icon}
                  <span className="max-w-full text-center text-[11px] leading-tight lg:text-[10px]">{action.label}</span>
                </button>
              ))}
              <button
                ref={alertButtonRef}
                type="button"
                onClick={handleAlertsToggle}
                aria-label={alertButtonLabel}
                aria-expanded={showAlertasPopover}
                aria-controls="client-alerts-popover"
                className={cn(
                  'relative inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 text-[11px] font-semibold text-amber-900 shadow-sm transition-[transform,box-shadow,background-color,border-color] hover:border-amber-300 hover:bg-amber-100/90 active:scale-[0.98] dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20 lg:h-auto lg:min-h-[50px] lg:flex-col lg:gap-1.5 lg:px-1 lg:py-2.5',
                  isQualityAlertPulsing && 'client-alert-attention'
                )}
              >
                <Warning aria-hidden="true" className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                <span className="max-w-full text-center text-[11px] leading-tight lg:text-[10px]">Alertas</span>
                {qualityIssues.length > 0 && (
                  <span aria-hidden="true" className="absolute right-1 top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1 text-[9px] font-bold leading-4 tabular-nums text-white shadow-sm ring-2 ring-amber-50 dark:bg-amber-400 dark:text-amber-950 dark:ring-zinc-900">
                    {qualityIssues.length > 99 ? '99+' : qualityIssues.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          {(activeTab === 'visao-geral' || activeTab === 'propriedades') && (
            <div className="w-full min-w-0 min-h-44">
              <ClienteMapaCard clienteId={id!} clienteNome={cliente.nome} className="w-full min-w-0" />
            </div>
          )}

        </div>

        <div className={cn(geoTabListClass, 'min-w-0 overflow-hidden')}>
          <div className="flex w-full items-stretch gap-1 overflow-x-auto" role="tablist" aria-label="Central do Cliente" aria-orientation="horizontal">
            {clientWorkspaceTabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  id={`cliente-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`cliente-panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                  onClick={() => handleTabChange(tab.id)}
                  className={geoTabButtonClass(
                    isActive,
                    CLIENT_DETAIL_TAB_TONES[tab.id],
                    'h-11 min-w-max flex-1 touch-manipulation justify-center gap-1.5 px-3 text-[11px] sm:h-12 sm:text-xs xl:min-w-0 2xl:text-[13px]'
                  )}
                >
                  <span aria-hidden="true" className={geoTabIconClass(isActive, CLIENT_DETAIL_TAB_TONES[tab.id], 'h-8 w-8')}>
                    {tab.icon}
                  </span>
                  <span className="whitespace-nowrap">{tab.label}</span>
                  {'count' in tab && (
                    <span className={`inline-flex min-w-5 shrink-0 justify-center rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums sm:text-[11px] ${
                      isActive ? 'bg-white/[0.07] text-current' : 'bg-zinc-200/80 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {clientWorkspaceTabs.filter((tab) => tab.id !== activeTab).map((tab) => (
            <div key={`inactive-${tab.id}`} id={`cliente-panel-${tab.id}`} role="tabpanel" aria-labelledby={`cliente-tab-${tab.id}`} hidden />
          ))}
        </div>

        {activeTab === 'visao-geral' && (
        <div
          id="cliente-panel-visao-geral"
          role="tabpanel"
          aria-labelledby="cliente-tab-visao-geral"
          className="h-full min-w-0"
        >
          <ClienteCentralControle
            clienteId={id!}
            projetos={clientProjetos}
            orcamentos={clientOrcamentos}
            historico={historico}
            loadingHistorico={loadingHistorico}
            onlyTimeline={true}
          />
        </div>
        )}
        </div>

      {/* Bento Grid layout for basic info and KPIs */}
      {activeTab === 'visao-geral' && (
      <div className="grid gap-4 content-start xl:col-start-2">
        <div className="grid gap-4 content-start">
        {/* Client details card */}
        <div className="client-contact-card rounded-3xl border border-zinc-200/70 bg-white p-4 shadow-sm ring-1 ring-zinc-950/[0.03] dark:border-zinc-800 dark:bg-zinc-900/90 dark:ring-white/[0.04]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2.5 text-lg font-semibold text-zinc-950 dark:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <IdentificationCard className="h-4 w-4" />
                </span>
                Contato do Cliente
              </h2>
              <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Canais principais, documento e origem do relacionamento.
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${getStatusColor(cliente.situacao)}`}>
              {cliente.situacao || 'Ativo'}
            </span>
          </div>

          <div className="client-contact-grid grid grid-cols-1 gap-2.5 text-xs text-zinc-600">
            <p className="sr-only" aria-live="polite">{copiedContactField ? 'Conteúdo copiado para a área de transferência.' : ''}</p>
            {cliente.email && (
              <div className="client-contact-full flex min-w-0 items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                  <EnvelopeSimple className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600 dark:text-zinc-300">E-mail</p>
                  <p className="break-words font-semibold leading-snug text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-100">{cliente.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyContact('email', cliente.email)}
                    className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 text-[11px] font-semibold text-zinc-500 transition-colors hover:border-sky-200 hover:text-sky-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-sky-500/30 dark:hover:text-sky-300"
                  title="Copiar e-mail"
                >
                  <CopySimple className="h-3.5 w-3.5" />
                  {copiedContactField === 'email' ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  type="button"
                  onClick={() => window.open(`mailto:${cliente.email}`)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-sky-200 hover:text-sky-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-sky-500/30 dark:hover:text-sky-300"
                  title="Abrir e-mail"
                  aria-label={`Enviar e-mail para ${cliente.email}`}
                >
                  <ArrowSquareOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {primaryPhoneValue && (
              <div className="client-contact-group grid grid-cols-1 gap-2.5">
                <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Phone className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600 dark:text-zinc-300">
                      {cliente.celular ? 'Celular' : 'Telefone'}
                    </p>
                    <p className="whitespace-nowrap font-semibold leading-snug tabular-nums text-zinc-900 dark:text-zinc-100">{formatPhoneBR(primaryPhoneValue)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyContact('telefone-principal', formatPhoneBR(primaryPhoneValue))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-emerald-200 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-500/30 dark:hover:text-emerald-300"
                    title="Copiar telefone"
                    aria-label="Copiar telefone principal"
                  >
                    <CopySimple className="h-3.5 w-3.5" />
                  </button>
                  {whatsappUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(whatsappUrl)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                      title="Abrir WhatsApp"
                      aria-label={`Abrir WhatsApp para ${formatPhoneBR(primaryPhoneValue)}`}
                    >
                      <WhatsappLogo className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {secondaryPhoneValue && (
                  <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-lime-50 text-lime-600 dark:bg-lime-500/10 dark:text-lime-300">
                      <Phone className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600 dark:text-zinc-300">Telefone</p>
                      <p className="whitespace-nowrap font-semibold leading-snug tabular-nums text-zinc-900 dark:text-zinc-100">{formatPhoneBR(secondaryPhoneValue)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyContact('telefone-secundario', formatPhoneBR(secondaryPhoneValue))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-lime-200 hover:text-lime-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-lime-500/30 dark:hover:text-lime-300"
                      title="Copiar telefone"
                      aria-label="Copiar telefone secundário"
                    >
                      <CopySimple className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {(documentValue || fullAddressValue) && (
              <div className="client-contact-group grid grid-cols-1 gap-2.5">
                {documentValue && (
                  <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                      <IdentificationCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600 dark:text-zinc-300">{documentPrefix}</p>
                      <p className="whitespace-nowrap font-semibold leading-snug tabular-nums text-zinc-900 dark:text-zinc-100">{documentValue}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyContact('documento', documentValue)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-amber-200 hover:text-amber-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-amber-500/30 dark:hover:text-amber-300"
                      title="Copiar documento"
                      aria-label={`Copiar ${cliente.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}`}
                    >
                      <CopySimple className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {fullAddressValue && (
                  <div className="client-contact-full flex min-w-0 items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600 dark:text-zinc-300">Endereço</p>
                      <p className="break-words font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{fullAddressValue}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyContact('endereco', fullAddressValue)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-rose-200 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-rose-500/30 dark:hover:text-rose-300"
                      title="Copiar endereço"
                      aria-label="Copiar endereço"
                    >
                      <CopySimple className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>


          {cliente.anotacoes && (
            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <Note className="h-3.5 w-3.5" /> Anotações Fixas
              </p>
              <p className="rounded-2xl bg-zinc-50 p-3 text-sm font-medium leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                {cliente.anotacoes}
              </p>
            </div>
          )}
        </div>

        {/* KPIs card */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-stone-950 via-stone-900 to-slate-800 p-6 text-white shadow-[0_24px_50px_-24px_rgba(15,23,42,0.75)]">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <h3 className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-300">
              <Briefcase weight="duotone" className="h-4 w-4 text-indigo-400" />
              Resumo Operacional
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                    <Buildings weight="duotone" className="h-3.5 w-3.5 text-sky-400" />
                    Propriedade / Negócio
                  </p>
                  <p className="mt-1 line-clamp-2 text-lg font-semibold leading-snug text-white">
                    {operationalProjectName}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                    <Tag weight="duotone" className="h-3.5 w-3.5 text-violet-400" />
                    Empreendimento
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {featuredProject?.tipo ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.07] px-2.5 py-1 text-xs font-semibold text-stone-200">
                        <Tag className="h-3.5 w-3.5" /> {featuredProject.tipo}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-stone-500">Não informado</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                    <MapPin weight="duotone" className="h-3.5 w-3.5 text-rose-400" />
                    Localidade
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold text-white">{featuredProjectLocation}</p>
                </div>
              </div>

              <div className="grid items-stretch gap-3 md:grid-cols-2">
                <div className="h-full rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3">
                  <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1 text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-emerald-200/80">
                      <MapTrifold weight="duotone" className="h-3 w-3 shrink-0 text-emerald-400" />
                      <span>Área Total Mapeada</span>
                    </p>
                    <FormSelect
                      aria-label="Unidade da área total"
                      value={areaUnit}
                      onChange={(event) => setAreaUnit(event.target.value as AreaUnit)}
                      wrapperClassName="w-16 shrink-0"
                      className="h-7 rounded-xl border border-emerald-400/20 bg-stone-900 px-2 text-[11px] font-semibold text-stone-100 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="ha">ha</option>
                      <option value="m2">m²</option>
                    </FormSelect>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-emerald-400">
                    {formatAreaValue(totalAreaMapeadaM2, areaUnit)} {areaUnit === 'ha' ? 'ha' : 'm²'}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold leading-snug text-emerald-100/50">{areaSource}</p>
                </div>

                <div className="h-full rounded-2xl border border-stone-700 bg-stone-900/70 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-stone-400">
                    <FileText weight="duotone" className="h-3 w-3 shrink-0 text-amber-400" />
                    <span>Registros Fundiários</span>
                  </p>
                  <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                    {featuredProjectRegistries.length > 0 ? (
                      featuredProjectRegistries.map((reg) => (
                        <span
                          key={reg.label}
                          className="max-w-full break-words rounded-full border border-stone-700 bg-stone-900 px-2 py-1 text-[11px] font-semibold leading-snug text-stone-300"
                        >
                          {reg.label}: {reg.value}
                        </span>
                      ))
                    ) : (
                      <span className="max-w-full break-words rounded-full border border-stone-700 bg-stone-900 px-2 py-1 text-[11px] font-semibold leading-snug text-stone-300">
                        Nenhum CAR, Matrícula ou CCIR
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-stone-700 pt-4">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                    <CalendarCheck weight="duotone" className="h-3.5 w-3.5 text-sky-400" />
                    Previsão de Entrega
                  </p>
                  <p className="mt-1 min-h-5 line-clamp-1 text-sm font-semibold text-white">
                    {formatOptionalDate(deliveryForecast)}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                    <CurrencyDollar weight="duotone" className="h-3.5 w-3.5 text-emerald-400" />
                    Faturamento
                  </p>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold text-white">
                    {formatCurrency(totalReceita)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 border-t border-stone-700 pt-4 sm:grid-cols-2">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                    <ListChecks weight="duotone" className="h-3.5 w-3.5 text-indigo-400" />
                    Serviços
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {featuredProjectTags.length > 0 ? (
                      featuredProjectTags.map((tag) => (
                        <span
                          key={tag.label}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tag.className}`}
                        >
                          {tag.label}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs font-semibold text-stone-300">
                        Nenhum serviço cadastrado
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                    <Tag weight="duotone" className="h-3.5 w-3.5 text-violet-400" />
                    Categoria
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {clientCategories.length > 0 ? (
                      clientCategories.map((category) => (
                        <span
                          key={category}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${getClientCategoryTagClass(category)}`}
                        >
                          <span aria-hidden="true" className="shrink-0 [&_img]:h-3.5 [&_img]:w-3.5 [&_img]:object-contain [&_svg]:h-3.5 [&_svg]:w-3.5">
                            {getClientCategoryIcon(category, 'h-3.5 w-3.5 object-contain')}
                          </span>
                          {category}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs font-semibold text-stone-500">
                        Sem categoria
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {clientOrigins.length > 0 && (
                <div className="border-t border-stone-700 pt-4">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                      <Handshake weight="duotone" className="h-3.5 w-3.5 text-amber-400" />
                      Indicação
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {clientOrigins.map((origin) => (
                        <span key={origin} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${getClientOriginTagClass(origin)}`}>
                          <Globe className="h-3.5 w-3.5" /> {origin}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="relative pt-4 mt-4 border-t border-stone-700 flex justify-between items-center text-xs text-stone-400 font-medium">
            <span>Cliente criado em:</span>
            <span>{new Date(cliente.createdAt).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
        </div>


        {activeTab === 'visao-geral' && (
        <div className="flex min-h-0 h-full flex-col gap-4">
        {/* Checklist Card */}
        <section className="flex flex-1 flex-col rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-lg font-semibold text-zinc-950 dark:text-white flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                Checklist
              </h3>
              <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">Progresso</p>
            </div>
            <span className="text-sm font-bold text-zinc-950 dark:text-white">{tarefasConcluidas}/{clienteTarefas.length} ({taskProgress}%)</span>
          </div>

          <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mb-4">
            <div className="h-full rounded-full bg-indigo-600 transition-[width]" style={{ width: `${taskProgress}%` }} />
          </div>

          <button
            type="button"
            onClick={() => setShowTaskForm(value => !value)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20 px-4 py-3 text-sm font-semibold text-indigo-700 transition-[background-color,color,box-shadow,transform] duration-200"
          >
            <Plus className="w-4 h-4" />
            Nova tarefa
          </button>

          {showTaskForm && (
            <form onSubmit={handleAddTask} className="mt-4 space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/90 p-4 shadow-sm">
              <FormSelect
                value={taskProjetoId}
                onChange={event => setTaskProjetoId(event.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              >
                <option value="">Cliente geral</option>
                {clientProjetos.map((projeto) => (
                  <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>
                ))}
              </FormSelect>
              <input
                value={taskTitulo}
                onChange={event => setTaskTitulo(event.target.value)}
                placeholder="Título da tarefa"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <FormSelect
                  value={taskPrioridade}
                  onChange={event => setTaskPrioridade(event.target.value as TaskPriority)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                </FormSelect>
                <DatePickerField
                  value={taskDataLimite}
                  onChange={event => setTaskDataLimite(event.target.value)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
              </div>
              <button type="submit" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-white transition-[background-color,color,box-shadow,transform] shadow-sm">
                Salvar tarefa
              </button>
            </form>
          )}

          <div className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
            {loadingTarefas ? (
              <p className="py-6 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">Carregando tarefas...</p>
            ) : clienteTarefas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-850 p-4 text-center mt-2">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Nenhuma tarefa neste cliente.</p>
              </div>
            ) : (
              clienteTarefas.map((tarefa) => {
                const priorityTone = getTaskPriorityTone(tarefa.prioridade);

                return (
                  <div key={tarefa.id} className={`group rounded-2xl border border-l-4 border-zinc-200/80 dark:border-zinc-700/70 p-3 hover:border-zinc-300 dark:hover:border-zinc-600 transition-[background-color,border-color,box-shadow,transform] duration-300 shadow-sm ${priorityTone.cardClass}`}>
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => updateTaskMutation.mutate({ taskId: tarefa.id, data: { status: isDone(tarefa.status) ? 'A Fazer' : 'Concluído' } })}
                        className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${isDone(tarefa.status) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'}`}
                        aria-label={isDone(tarefa.status) ? `Reabrir tarefa ${tarefa.titulo}` : `Concluir tarefa ${tarefa.titulo}`}
                      >
                        {isDone(tarefa.status) && <Check className="w-3 h-3" weight="bold" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditTask(tarefa)}
                        className="mt-0.5 w-5 h-5 rounded-md text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 flex items-center justify-center flex-shrink-0 transition-colors"
                        title="Editar tarefa"
                        aria-label={`Editar tarefa ${tarefa.titulo}`}
                      >
                        <PencilSimple className="w-3.5 h-3.5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold text-zinc-950 dark:text-white ${isDone(tarefa.status) ? 'line-through opacity-60' : ''}`}>{tarefa.titulo}</p>
                        <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">{tarefa.projetoNome || clientProjetos.find((projeto) => projeto.id === tarefa.projetoId)?.nome || tarefa.clienteNome || 'Cliente geral'}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${priorityTone.badgeClass}`}>
                            {priorityTone.label}
                          </span>
                          {tarefa.dataLimite && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatOptionalDate(tarefa.dataLimite)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ type: 'task', item: tarefa })}
                        disabled={deleteTaskMutation.isPending}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-[background-color,color,box-shadow,transform] disabled:cursor-wait disabled:opacity-50"
                        aria-label={`Excluir tarefa ${tarefa.titulo}`}
                        title="Excluir tarefa"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Agenda Card */}
        <section className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-zinc-950 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              Agenda
            </h3>
            <button
              type="button"
              onClick={() => setShowAgendaForm(value => !value)}
              className="w-9 h-9 rounded-full border border-zinc-200 dark:border-zinc-700 bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors shadow-sm"
              aria-label={showAgendaForm ? 'Fechar formulário de compromisso' : 'Adicionar compromisso'}
              aria-expanded={showAgendaForm}
            >
              {showAgendaForm ? <Minus className="w-4 h-4" weight="bold" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>

          {showAgendaForm && (
            <form onSubmit={handleAddAgenda} className="mb-4 space-y-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/90 p-4 shadow-sm">
              <input
                value={agendaTitulo}
                onChange={event => setAgendaTitulo(event.target.value)}
                placeholder="Título do compromisso"
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <DatePickerField
                  value={agendaData}
                  onChange={event => setAgendaData(event.target.value)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
                <TimePickerField
                  value={agendaHora}
                  onChange={event => setAgendaHora(event.target.value)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
                <FormSelect
                  value={agendaTipo}
                  onChange={event => setAgendaTipo(event.target.value)}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  <option value="Visita de Campo">Visita</option>
                  <option value="Reunião">Reunião</option>
                  <option value="Cartório">Cartório</option>
                  <option value="Entrega">Entrega</option>
                  <option value="Outro">Outro</option>
                </FormSelect>
              </div>
              <FormSelect
                value={agendaProjetoId}
                onChange={event => setAgendaProjetoId(event.target.value)}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              >
                <option value="">Cliente geral</option>
                {clientProjetos.map((projeto) => (
                  <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>
                ))}
              </FormSelect>
              <textarea
                value={agendaDescricao}
                onChange={event => setAgendaDescricao(event.target.value)}
                placeholder="Observações"
                rows={2}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
              <button type="submit" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-white transition-[background-color,color,box-shadow,transform] shadow-sm">
                Salvar compromisso
              </button>
            </form>
          )}

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
            {loadingCompromissos ? (
              <p className="py-5 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">Carregando agenda...</p>
            ) : nextCompromissos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700 p-5 text-center">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Nenhum compromisso futuro vinculado.</p>
              </div>
            ) : (
              nextCompromissos.map((compromisso) => (
                <div key={compromisso.id} className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/70 bg-zinc-50/80 dark:bg-zinc-800/70 p-3 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-600 transition-[background-color,border-color,box-shadow,transform] duration-300">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-950 dark:text-white">{compromisso.titulo}</p>
                      <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{compromisso.projetoNome || compromisso.clienteNome || 'Cliente geral'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold whitespace-nowrap ${compromisso.isProjectDeadline ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-300'}`}>
                        {formatDateShort(compromisso.data)} {compromisso.hora ? `- ${compromisso.hora}` : ''}
                      </span>
                      {!compromisso.isProjectDeadline && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditAgenda(compromisso)}
                            className="w-6 h-6 rounded-md text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 flex items-center justify-center flex-shrink-0 transition-colors"
                            title="Editar compromisso"
                            aria-label={`Editar compromisso ${compromisso.titulo}`}
                          >
                            <PencilSimple className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: 'agenda', item: compromisso })}
                            disabled={deleteAgendaMutation.isPending}
                            className="w-7 h-7 rounded-md text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center flex-shrink-0 transition-colors disabled:cursor-wait disabled:opacity-50"
                            title="Excluir compromisso"
                            aria-label={`Excluir compromisso ${compromisso.titulo}`}
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        </div>
        )}
      </div>
      )}

      <ClienteSecondaryTabs
        activeTab={activeTab}
        clienteId={id!}
        clienteName={cliente.nome}
        clientProperties={clientProperties}
        clientProjetos={clientProjetos}
        clientAmbientalProjetos={clientAmbientalProjetos}
        clientOrcamentos={clientOrcamentos}
        focusedOrcamentoId={focusedOrcamentoId}
        clientFinancialKpis={clientFinancialKpis}
        orcamentosPorStatus={orcamentosPorStatus}
        focusedDocumentId={focusedDocumentId}
        initialDocumentSearch={initialDocumentSearch}
        onPreviewFile={handlePreviewFile}
        onCreateProperty={() => navigate('/propriedades', { state: { createForClienteId: id, clientName: cliente.nome } })}
        onOpenProperty={(propertyId) => navigate('/propriedades', { state: { editPropertyId: propertyId, clientFilterId: id } })}
        onCreateEnvironmentalProject={() => navigate('/projetos', { state: { createForClienteId: id, openCreateModal: true, contexto: 'ambiental' } })}
        onCreateService={() => navigate('/projetos', { state: { createForClienteId: id, modalTab: 'projeto' } })}
        renderEnvironmentalProjectLink={(project) => (
          <Link to={`/ambiental/${project.id}`} className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300">
            Abrir demanda
            <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
        renderProjectTitleLink={(proj) => <Link to={`/projetos/${proj.id}`}>{proj.nome}</Link>}
        renderProjectDetailsLink={(proj) => (
          <Link to={`/projetos/${proj.id}`} className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950 rounded-xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform]">
            Detalhes
          </Link>
        )}
      />
      </div>

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm">
          <div className="flex h-[85vh] w-[92vw] max-w-5xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{previewFile.name}</p>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {formatFileSize(previewFile.sizeBytes)} • {previewFile.extension.toUpperCase().replace('.', '')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenFile(previewFile.path)}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-[background-color,border-color,color,box-shadow,transform] hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  <ArrowSquareOut className="h-4 w-4" />
                  Abrir fora
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition-[background-color,border-color,color,box-shadow,transform] hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  title="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-zinc-100 dark:bg-zinc-900">
              {previewFile.extension === '.pdf' ? (
                <iframe
                  title={previewFile.name}
                  src={getPreviewUrl(previewFile.path)}
                  className="h-full w-full bg-white"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4">
                  <img
                    src={getPreviewUrl(previewFile.path)}
                    alt={previewFile.name}
                    className="max-h-full max-w-full rounded-2xl object-contain shadow-lg"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <PopoverSurface
        ref={alertPopoverRef}
        open={showAlertasPopover}
        anchorRef={alertButtonRef}
        id="client-alerts-popover"
        role="dialog"
        ariaLabel="Alertas do cliente"
        minWidth={320}
        maxWidth={400}
        maxHeight={520}
        className="border border-amber-200/80 bg-white shadow-2xl dark:border-amber-500/25 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white">
              <Warning aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
              Alertas do cliente
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Pendências informativas que não bloqueiam seu trabalho.
            </p>
          </div>
          <button
            type="button"
            onClick={() => closeAlertsPopover(true)}
            aria-label="Fechar alertas"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(28rem,calc(100vh-8rem))] space-y-4 overflow-y-auto p-4">
          {qualityIssues.length > 0 && (
            <section aria-labelledby="client-quality-alert-title">
              <div className="flex items-center justify-between gap-3">
                <h3 id="client-quality-alert-title" className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-800 dark:text-amber-200">
                  Qualidade cadastral
                </h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
                  {qualityIssues.length}
                </span>
              </div>
              <ul className="mt-2 space-y-2">
                {qualityIssues.map((issue) => (
                  <li key={issue} className="flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-xs font-medium leading-relaxed text-amber-950 dark:border-amber-500/20 dark:bg-amber-500/[0.08] dark:text-amber-100">
                    <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span className="min-w-0 break-words">{issue}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={handleReviewCadastro} className={cn(primarySmallActionButtonClass, 'w-full justify-center')}>
                  Revisar cadastro
                </button>
                <button type="button" onClick={handleIgnoreQualityAlert} className={cn(secondarySmallActionButtonClass, 'w-full justify-center')}>
                  Ignorar por agora
                </button>
              </div>
            </section>
          )}

          {alertasOperacionaisResumo.length > 0 && (
            <section className={cn(qualityIssues.length > 0 && 'border-t border-zinc-200 pt-4 dark:border-zinc-800')} aria-labelledby="client-operational-alert-title">
              <h3 id="client-operational-alert-title" className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-600 dark:text-zinc-300">
                Alertas operacionais
              </h3>
              <ul className="mt-2 space-y-2">
                {alertasOperacionaisResumo.map((alerta) => (
                  <li key={alerta} className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium leading-relaxed text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
                    <Warning aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span className="min-w-0 break-words">{alerta}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {qualityIssues.length === 0 && alertasOperacionaisResumo.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-7 text-center dark:border-zinc-700 dark:bg-zinc-800/50">
              <CheckCircle aria-hidden="true" className="mb-2 h-9 w-9 text-emerald-500" />
              <p className="text-sm font-semibold text-zinc-950 dark:text-white">Tudo em ordem</p>
              <p className="mt-1 px-4 text-xs text-zinc-500 dark:text-zinc-400">Nenhum alerta para este cliente.</p>
            </div>
          )}
        </div>
      </PopoverSurface>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === 'task') deleteTaskMutation.mutate(deleteTarget.item.id);
          if (deleteTarget?.type === 'agenda') deleteAgendaMutation.mutate(deleteTarget.item.id);
        }}
        title={deleteTarget?.type === 'task'
          ? `Excluir tarefa “${deleteTarget.item.titulo}”?`
          : `Excluir compromisso “${deleteTarget?.item.titulo || ''}”?`}
        description={deleteTarget?.type === 'task'
          ? 'A tarefa será removida da central do cliente e do projeto vinculado, quando houver. Os cadastros relacionados serão preservados. Esta ação não pode ser desfeita.'
          : 'O compromisso será removido da agenda e da central do cliente. Os cadastros relacionados serão preservados. Esta ação não pode ser desfeita.'}
        confirmText={deleteTarget?.type === 'task' ? 'Excluir tarefa' : 'Excluir compromisso'}
        loading={deleteTaskMutation.isPending || deleteAgendaMutation.isPending}
      />

    </Layout>
  );
}
