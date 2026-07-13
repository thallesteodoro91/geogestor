import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
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
import { primaryActionButtonClass, primaryActionIconClass, primarySmallActionButtonClass, primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { geoFieldClass, geoGreenIconClass, geoGreenLabelClass, geoGreenSurfaceWithAccentClass, geoGreenValueClass, geoKickerClass, geoOrangeIconClass, geoOrangeLabelClass, geoOrangeSurfaceWithAccentClass, geoOrangeValueClass, geoPurpleSurfaceClass, geoTabButtonClass, geoTabListClass } from '../../utils/geoTheme';

import { CustomSelect } from '../../components/CustomSelect';
import { MetricCard } from '../../components/MetricCard';
import {
  filterBarClass,
  filterControlClass,
  filterSearchInputClass
} from '../../utils/filterStyles';
import editIcon from '../../assets/magnific-icons/writing_3215063.svg';
import trashIcon from '../../assets/magnific-icons/trash-bin_5510130.svg';
import pdfIcon from '../../assets/magnific-icons/notes_8079875.svg';
import folderIcon from '../../assets/magnific-icons/project_folder.svg';
import clockIcon from '../../assets/magnific-icons/clock_2924574.svg';
import warningIcon from '../../assets/magnific-icons/warning-sign_11318030.svg';
import checkIcon from '../../assets/magnific-icons/good-review_4820567.svg';
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
}

interface ProjetoPayload {
  nome: string;
  descricao?: string | null;
  clienteId: string;
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
}

interface ProjetoArquivo {
  name: string;
  extension: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
}

const projectFieldClass = cn(geoFieldClass, 'w-full h-12 px-4 font-medium');
const projectSelectClass = cn(projectFieldClass, 'cursor-pointer');
const projectTextareaClass = cn(geoFieldClass, 'w-full min-h-[100px] resize-none px-4 py-3 font-medium leading-relaxed');
const projectMetricPanelClass = 'geo-card flex flex-col justify-between p-6';
const projectIconButtonClass = 'geo-focus-ring rounded-lg p-1 transition-[background-color,transform] duration-150 hover:bg-brand-surface-subtle hover:scale-110 active:scale-95 dark:hover:bg-brand-surface-muted';

export function ListagemProjetos() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const handledRouteActionRef = useRef(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);
  const [modalContext, setModalContext] = useState<string>('projeto');
  const [activeTab, setActiveTab] = useState<'projeto' | 'propriedade' | 'geoloc'>('projeto');
  const [viewMode, setViewMode] = useState<'grid' | 'map' | 'operacional'>('grid');
  const [categoriaFilter, setCategoriaFilter] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [tipoFilter, setTipoFilter] = useState('Todos');
  const [dataInicioFilter, setDataInicioFilter] = useState('');
  const [dataFimFilter, setDataFimFilter] = useState('');

  // Form states
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [status, setStatus] = useState('Em Andamento');
  const [dataInicio, setDataInicio] = useState('');
  const [dataEntrega, setDataEntrega] = useState('');

  // Audited property states
  const [areaHa, setAreaHa] = useState('');
  
  // Ambiental & Licenciamento specific fields
  const [tipoServicoLicenca, setTipoServicoLicenca] = useState('');
  const [orgaoAmbiental, setOrgaoAmbiental] = useState('');
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [matricula, setMatricula] = useState('');
  const [car, setCar] = useState('');
  const [ccir, setCcir] = useState('');
  const [itr, setItr] = useState('');
  const [cidade, setCidade] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [situacaoImovel, setSituacaoImovel] = useState('');
  const [tipo, setTipo] = useState('Rural');
  const [averbacao, setAverbacao] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [possuiMemorialDescritivo, setPossuiMemorialDescritivo] = useState('Não');
  const [observacoes, setObservacoes] = useState('');

  // Local files preview states
  const [showArquivosModal, setShowArquivosModal] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // Queries
  const { data: projetos = [], isLoading: projectsLoading } = useQuery<Projeto[]>({
    queryKey: ['projetos'],
    queryFn: () => apiClient.get<Projeto[]>('/api/projetos')
  });

  const { data: clientes = [], isLoading: clientsLoading } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: () => apiClient.get<Cliente[]>('/api/clientes')
  });

  const loading = projectsLoading || clientsLoading;

  const { data: orcamentos = [] } = useQuery<OrcamentoInfo[]>({
    queryKey: ['orcamentos-financeiro'],
    queryFn: () => apiClient.get<OrcamentoInfo[]>('/api/financeiro/orcamentos'),
    enabled: viewMode === 'operacional'
  });

  const { data: despesas = [] } = useQuery<DespesaInfo[]>({
    queryKey: ['despesas-financeiro'],
    queryFn: () => apiClient.get<DespesaInfo[]>('/api/financeiro/despesas'),
    enabled: viewMode === 'operacional'
  });

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
  const avgCompletionTime = countConcluidos > 0 ? Math.round(totalDays / countConcluidos) : 0;
  const productivityRate = totalProjetos > 0 ? Math.round((projetosConcluidos / totalProjetos) * 100) : 0;

  const approvedBudgets = orcamentos.filter((o) => o.status === 'Pago' || o.status === 'Aprovado');
  const avgTicket = approvedBudgets.length > 0 
    ? Math.round(approvedBudgets.reduce((acc: number, curr) => acc + curr.valorTotal, 0) / approvedBudgets.length) 
    : 0;

  const projectComparisonData = projetos.map((proj) => {
    const relatedBudgets = orcamentos.filter((o) => o.clienteId === proj.clienteId);
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
    .sort((a, b) => b.Receita - a.Receita)
    .slice(0, 5);

  const formatBRL = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

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
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
      queryClient.invalidateQueries({ queryKey: ['stats-geral'] });
      queryClient.invalidateQueries({ queryKey: ['projetos-notificacoes'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir projeto';
      alert(msg);
    }
  });

  const submitProjectMutation = useMutation({
    mutationFn: async (payload: ProjetoPayload) => {
      if (selectedProjeto) {
        return await apiClient.patch(`/api/projetos/${selectedProjeto.id}`, payload);
      }
      return await apiClient.post('/api/projetos', payload);
    },
    onSuccess: () => {
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['projetos'] });
      queryClient.invalidateQueries({ queryKey: ['stats-geral'] });
      queryClient.invalidateQueries({ queryKey: ['projetos-notificacoes'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : (selectedProjeto ? 'Erro ao atualizar projeto' : 'Erro ao criar projeto');
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
  const openCreateModal = useCallback((initialClienteId?: string, initialTab: 'projeto' | 'propriedade' | 'geoloc' = 'projeto', contexto: string = 'projeto') => {
    setSelectedProjeto(null);
    setModalContext(contexto);
    setNome('');
    setDescricao('');
    setTipoServicoLicenca('');
    setOrgaoAmbiental('');
    setNumeroProcesso('');
    const nextClienteId = initialClienteId && clientes.some((cliente) => cliente.id === initialClienteId)
      ? initialClienteId
      : clientes[0]?.id || '';
    setClienteId(nextClienteId);
    setStatus('Em Andamento');
    setDataInicio('');
    setDataEntrega('');
    setAreaHa('');
    setMatricula('');
    setCar('');
    setCcir('');
    setItr('');
    setCidade('');
    setMunicipio('');
    setSituacaoImovel('Regularizado');
    setTipo(contexto === 'licenciamento' ? 'Licenciamento' : contexto === 'ambiental' ? 'Ambiental' : 'Rural');
    setAverbacao('');
    setLatitude('');
    setLongitude('');
    setPossuiMemorialDescritivo('Não');
    setObservacoes('');
    setActiveTab(initialTab);
    setShowModal(true);
  }, [clientes]);

  const openEditModal = (proj: Projeto) => {
    setDescricao(proj.descricao || '');
    setClienteId(proj.clienteId || '');
    setStatus(proj.status || 'Em Andamento');
    setDataInicio(proj.dataInicio || '');
    setDataEntrega(proj.dataEntrega || '');
    setAreaHa(proj.areaHa !== null && proj.areaHa !== undefined ? proj.areaHa.toString() : '');
    setMatricula(proj.matricula || '');
    setCar(proj.car || '');
    setCcir(proj.ccir || '');
    setItr(proj.itr || '');
    setCidade(proj.cidade || '');
    setMunicipio(proj.municipio || '');
    setSituacaoImovel(proj.situacaoImovel || 'Regularizado');
    setTipo(proj.tipo || 'Rural');
    setAverbacao(proj.averbacao || '');
    setLatitude(proj.latitude !== null && proj.latitude !== undefined ? proj.latitude.toString() : '');
    setLongitude(proj.longitude !== null && proj.longitude !== undefined ? proj.longitude.toString() : '');
    setPossuiMemorialDescritivo(proj.possuiMemorialDescritivo || 'Não');
    setObservacoes(proj.observacoes || '');
    setActiveTab('projeto');
    setShowModal(true);
  };

  useEffect(() => {
    const routeState = location.state as { createForClienteId?: string; modalTab?: 'projeto' | 'propriedade' | 'geoloc'; openCreateModal?: boolean; contexto?: string } | null;
    if (handledRouteActionRef.current || (!routeState?.createForClienteId && !routeState?.openCreateModal) || clientsLoading) return;

    handledRouteActionRef.current = true;
    openCreateModal(routeState.createForClienteId, routeState.modalTab || 'projeto', routeState.contexto);
  }, [clientsLoading, clientes, location.state, openCreateModal]);

  const handleDelete = (id: string, name: string) => {
    setConfirmData({
      isOpen: true,
      title: 'Excluir Projeto',
      description: `Tem certeza que deseja excluir o projeto "${name}"? Esta ação não poderá ser desfeita.`,
      onConfirm: () => {
        deleteProjectMutation.mutate(id);
        setConfirmData(prev => ({ ...prev, isOpen: false }));
      }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId) {
      alert('Por favor, cadastre ou selecione um cliente primeiro.');
      return;
    }

    const payload = {
      nome,
      clienteId,
      descricao: descricao || null,
      status: status || 'Em Andamento',
      dataInicio: dataInicio || null,
      dataEntrega: dataEntrega || null,
      areaHa: areaHa ? parseFloat(areaHa) : null,
      matricula: matricula || null,
      car: car || null,
      ccir: ccir || null,
      itr: itr || null,
      cidade: cidade || null,
      municipio: municipio || null,
      situacaoImovel: situacaoImovel || null,
      tipo: tipo || null,
      averbacao: averbacao || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      possuiMemorialDescritivo: possuiMemorialDescritivo || null,
      observacoes: observacoes || null,
      orgaoAmbiental: orgaoAmbiental || null,
      tipoDemanda: modalContext === 'ambiental' ? tipoServicoLicenca || null : null,
      tipoLicenca: modalContext === 'licenciamento' ? tipoServicoLicenca || null : null,
      numeroProcesso: numeroProcesso || null,
      protocolo: numeroProcesso || null
    };

    // Zod Validation
    const schema = z.object({
      nome: z.string().min(1, 'Nome do projeto é obrigatório'),
      clienteId: z.string().min(1, 'Selecione um cliente'),
      latitude: z.number().nullable().optional(),
      longitude: z.number().nullable().optional(),
      areaHa: z.number().nullable().optional()
    });

    const validation = schema.safeParse(payload);
    if (!validation.success) {
      alert(validation.error.issues[0].message);
      return;
    }

    submitProjectMutation.mutate(payload);
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
      title: 'Excluir Arquivo',
      description: 'Tem certeza que deseja excluir permanentemente este arquivo do disco local?',
      onConfirm: () => {
        deleteFileMutation.mutate(filePath);
        setConfirmData(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div>
          <span className={cn(geoKickerClass, 'mb-4')}>
            Operações
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
            Projetos
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Monitoramento de processos ambientais, georreferenciamento e topografia.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn(geoTabListClass, 'flex rounded-full')}>
            <button 
              onClick={() => setViewMode('grid')}
              className={geoTabButtonClass(viewMode === 'grid', 'system', 'min-h-10 rounded-full px-5 py-2 text-sm')}
            >
              <SquaresFour weight={viewMode === 'grid' ? 'fill' : 'regular'} className="w-4.5 h-4.5" />
              <span>Cards</span>
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={geoTabButtonClass(viewMode === 'map', 'field', 'min-h-10 rounded-full px-5 py-2 text-sm')}
            >
              <MapTrifold weight={viewMode === 'map' ? 'fill' : 'regular'} className="w-4.5 h-4.5" />
              <span>Mapa</span>
            </button>
            <button 
              onClick={() => setViewMode('operacional')}
              className={geoTabButtonClass(viewMode === 'operacional', 'finance', 'min-h-10 rounded-full px-5 py-2 text-sm')}
            >
              <ChartBar weight={viewMode === 'operacional' ? 'fill' : 'regular'} className="w-4.5 h-4.5" />
              <span>Estatísticas</span>
            </button>
          </div>
          <button 
            onClick={() => openCreateModal()}
            className={cn(primaryActionButtonClass, 'gap-2.5 px-6 py-3 text-sm font-bold shrink-0')}
          >
            <span>Novo Projeto</span>
            <div className={cn(primaryActionIconClass, 'h-5 w-5 group-hover:translate-x-0.5')}>
              <Plus weight="bold" className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </div>

      {/* Top Metrics Row */}
      {viewMode !== 'operacional' && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total de Projetos" value={totalProjetos} tone="geral" icon={<img src={folderIcon} alt="" width={28} height={28} className="h-7 w-7 object-contain" />} />
          <MetricCard label="Em Andamento" value={projetosEmAndamento} tone="topografia" delay={0.05} icon={<img src={clockIcon} alt="" width={28} height={28} className="h-7 w-7 object-contain" />} />
          <MetricCard label="Atrasados" value={projetosAtrasados} tone="danger" delay={0.1} icon={<img src={warningIcon} alt="" width={28} height={28} className="h-7 w-7 object-contain" />} />
          <MetricCard label="Concluídos" value={projetosConcluidos} tone="ambiental" surfaceTone="success" delay={0.15} icon={<img src={checkIcon} alt="" width={28} height={28} className="h-7 w-7 object-contain" />} />
        </div>
      )}

      <div className={cn('mb-6', filterBarClass)}>
        <div className="flex flex-col items-center gap-3 xl:flex-row">
          {/* Search bar */}
          <div className="relative w-full xl:max-w-md shrink-0">
            <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por projeto, cliente, cidade, matrícula, CAR..."
              className={filterSearchInputClass}
            />
          </div>

          {/* Filters */}
          <div className="flex w-full flex-wrap items-center gap-3 xl:ml-auto xl:w-auto xl:flex-nowrap">
            <CustomSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Status (Todos)"
              options={[
                { label: 'Status (Todos)', value: 'Todos' },
                ...projectStatuses.map(s => ({ label: s, value: s }))
              ]}
            />
            
            <CustomSelect
              value={tipoFilter}
              onChange={setTipoFilter}
              placeholder="Tipos (Todos)"
              options={[
                { label: 'Tipos (Todos)', value: 'Todos' },
                ...projectTypes.map(t => ({ label: t, value: t }))
              ]}
            />

            <div className={cn(filterControlClass, 'flex flex-1 items-center gap-3 pl-4 pr-5 sm:flex-initial min-w-[290px]')}>
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 shrink-0">Período:</span>
              <input
                type="date"
                value={dataInicioFilter}
                onChange={(event) => setDataInicioFilter(event.target.value)}
                className="w-full !bg-transparent text-xs font-semibold text-zinc-700 dark:text-zinc-200 outline-none [&::-webkit-calendar-picker-indicator]:dark:invert cursor-pointer pr-1"
                aria-label="Data inicial"
              />
              <span className="text-zinc-300 dark:text-zinc-600">-</span>
              <input
                type="date"
                value={dataFimFilter}
                onChange={(event) => setDataFimFilter(event.target.value)}
                className="w-full !bg-transparent text-xs font-semibold text-zinc-700 dark:text-zinc-200 outline-none [&::-webkit-calendar-picker-indicator]:dark:invert cursor-pointer pr-1"
                aria-label="Data final"
              />
            </div>

            {hasProjectFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('Todos');
                  setTipoFilter('Todos');
                  setDataInicioFilter('');
                  setDataFimFilter('');
                }}
                className="geo-focus-ring flex h-10 shrink-0 items-center gap-2 rounded-lg border border-brand-red-200 bg-brand-red-50 px-4 text-xs font-semibold text-brand-red-700 shadow-sm transition-[background-color,color,border-color,transform] hover:bg-brand-red-100 hover:text-brand-red-800 active:scale-95 dark:border-brand-red-400/20 dark:bg-brand-red-400/10 dark:text-brand-red-100"
              >
                <Trash weight="bold" className="w-3.5 h-3.5" />
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="px-6 mb-6 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        {filteredProjetos.length} de {projetos.length} projeto(s) exibidos
      </p>

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
          {/* Top Bento Cards row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className={cn(projectMetricPanelClass, geoOrangeSurfaceWithAccentClass)}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn('text-xs font-semibold uppercase tracking-wider', geoOrangeLabelClass)}>Total Projetos</span>
                <div className={cn(geoOrangeIconClass, 'flex h-10 w-10 items-center justify-center rounded-xl')}>
                  <Folder className="w-5 h-5" />
                </div>
              </div>
              <div>
                <span className={cn('text-3xl font-bold tracking-tight tabular-nums', geoOrangeValueClass)}>
                  {totalProjetos}
                </span>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-100/70">CADASTRADOS NO SISTEMA</p>
              </div>
            </div>

            <div className={cn(projectMetricPanelClass, geoOrangeSurfaceWithAccentClass)}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn('text-xs font-semibold uppercase tracking-wider', geoOrangeLabelClass)}>Tempo de Entrega</span>
                <div className={cn(geoOrangeIconClass, 'flex h-10 w-10 items-center justify-center rounded-xl')}>
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div>
                <span className={cn('text-3xl font-bold tracking-tight tabular-nums', geoOrangeValueClass)}>
                  {avgCompletionTime} dias
                </span>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-100/70">MÉDIA DE CONCLUSÃO</p>
              </div>
            </div>

            <div className={cn(projectMetricPanelClass, geoGreenSurfaceWithAccentClass)}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Produtividade</span>
                <div className={cn(geoGreenIconClass, 'flex h-10 w-10 items-center justify-center rounded-xl')}>
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
              <div>
                <span className={cn('text-3xl font-bold tracking-tight tabular-nums', geoGreenValueClass)}>
                  {productivityRate}%
                </span>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-100/70">TAXA DE CONCLUSÃO GERAL</p>
              </div>
            </div>

            <div className={cn(projectMetricPanelClass, geoGreenSurfaceWithAccentClass)}>
              <div className="flex items-center justify-between mb-4">
                <span className={cn('text-xs font-semibold uppercase tracking-wider', geoGreenLabelClass)}>Ticket Médio</span>
                <div className={cn(geoGreenIconClass, 'flex h-10 w-10 items-center justify-center rounded-lg')}>
                  <TrendUp className="w-5 h-5" />
                </div>
              </div>
              <div>
                <span className={cn('text-3xl font-bold tracking-tight tabular-nums', geoGreenValueClass)}>
                  {formatBRL(avgTicket)}
                </span>
                <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-100/70">POR ORÇAMENTO APROVADO</p>
              </div>
            </div>
          </div>

          {/* Productivity insights story card */}
          <div className={cn(geoPurpleSurfaceClass, 'geo-card relative overflow-hidden p-6 text-white')}>
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-zinc-100">
              <PresentationChart className="h-5 w-5 text-brand-primary-200" />
              <span>Visão Geral Operacional</span>
            </h3>
            <div className="text-sm text-zinc-300 space-y-2 leading-relaxed">
              <p>
                A produtividade das equipes está em <strong className="text-brand-primary-200 tabular-nums">{productivityRate}%</strong> neste período — <strong className="text-zinc-100 tabular-nums">{projetosConcluidos}</strong> de <strong className="text-zinc-100 tabular-nums">{totalProjetos}</strong> projetos foram concluídos, com tempo médio de <strong className="text-zinc-100 tabular-nums">{avgCompletionTime} dias</strong>.
              </p>
              <p>
                Atualmente, <strong className="text-zinc-100 tabular-nums">{projetosEmAndamento}</strong> projetos estão em andamento e <strong className="text-zinc-100 tabular-nums">{projetosOutros}</strong> aguardam início ou estão sob revisão.
              </p>
              {projectTypeStats.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {projectTypeStats.map((item) => (
                    <span
                      key={item.type}
                      className="geo-badge-base geo-badge-on-dark px-2.5 py-1 text-xs uppercase tracking-wider"
                    >
                      {item.type}: <span className="tabular-nums">{item.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Custo vs Receita por Projeto */}
            <div className="geo-card col-span-1 flex flex-col justify-between p-6 md:col-span-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Análise de Custos vs Receita Estimada (Top 5)</h3>
                  <p className="text-xs text-zinc-400 dark:text-zinc-505 font-medium mt-0.5">Comparação direta de faturamento e despesas associadas por projeto.</p>
                </div>
                
                <select 
                  value={categoriaFilter} 
                  onChange={e => setCategoriaFilter(e.target.value)} 
                  className={cn(projectSelectClass, 'h-10 w-auto px-3 py-2 text-xs')}
                >
                  <option value="todos">Todos os Tipos</option>
                  {projectTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1 w-full h-[280px]">
                {topProjectsData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-400 text-sm">
                    Nenhum projeto faturado ou com custos neste filtro.
                  </div>
                ) : (
                  <ResponsiveContainer {...responsiveChartProps}>
                    <BarChart data={topProjectsData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartBorder} />
                      <XAxis dataKey="name" tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: chartTextColor, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                      <RechartsTooltip cursor={chartCursor} content={<RichTooltip format="currency" />} />
                      <Legend wrapperStyle={chartLegendStyle} />
                      <Bar dataKey="Receita" fill={chartColors.positive} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Custo" fill={chartColors.negative} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Lucro" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Status dos Projetos Pie */}
            <div className="geo-card col-span-1 flex flex-col justify-between p-6 md:col-span-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">Distribuição por Status</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-505 font-medium mt-0.5">Situação dos projetos ativos e entregues.</p>
              </div>

              <div className="w-full h-[200px] relative flex items-center justify-center">
                {statusPieData.length === 0 ? (
                  <p className="text-zinc-400 text-sm">Sem projetos.</p>
                ) : (
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
                      <RechartsTooltip content={<DynamicTooltip formatter={(v) => `${v} projetos`} />} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-brand-border pt-4 text-center text-xs font-semibold text-zinc-600">
                {statusPieData.map(item => (
                  <div key={item.name} className="flex flex-col items-center">
                    <span className="w-2 h-2 rounded-full mb-1" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">{item.name}</span>
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
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
        {loading ? (
          <div className="col-span-full py-24 flex justify-center">
            <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-8 w-8 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary-600" />
          </div>
        ) : projetos.length === 0 ? (
          <div className="geo-empty-state col-span-full flex flex-col items-center justify-center p-20 text-center">
            <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-950 rounded-full flex items-center justify-center mb-6 ring-8 ring-zinc-50/50 dark:ring-zinc-950/50">
              <FolderOpen weight="duotone" className="w-10 h-10 text-zinc-400" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">Nenhum projeto encontrado</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-md mx-auto mb-8">Comece criando o seu primeiro projeto para gerenciar operações, mapas e estatísticas em um só lugar.</p>
            <button
              onClick={() => openCreateModal()}
              className={primarySmallActionButtonClass}
            >
              <Plus weight="bold" className="w-4 h-4" />
              Criar Primeiro Projeto
            </button>
          </div>
        ) : filteredProjetos.length === 0 ? (
          <div className="geo-empty-state col-span-full flex flex-col items-center justify-center p-16 text-center">
            <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-950 rounded-full flex items-center justify-center mb-6 ring-8 ring-zinc-50/50 dark:ring-zinc-950/50">
              <img src={filterIcon} alt="Vazio" className="w-10 h-10 object-contain opacity-40 grayscale" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">Nenhum resultado</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-md mx-auto mb-8">Sua busca não encontrou nenhum projeto correspondente. Tente ajustar os filtros ou os termos pesquisados.</p>
            <button 
              onClick={() => { setSearchTerm(''); setStatusFilter('Todos'); setTipoFilter('Todos'); setCategoriaFilter('todos'); }}
              className={secondarySmallActionButtonClass}
            >
              Limpar Filtros
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
                      title="Baixar Relatório PDF"
                    >
                      <img src={pdfIcon} alt="PDF" className="w-6 h-6 object-contain opacity-80" />
                    </button>
                    <button 
                      onClick={() => openEditModal(projeto)}
                      className={projectIconButtonClass}
                      title="Editar Projeto"
                    >
                      <img src={editIcon} alt="Editar" className="w-6 h-6 object-contain opacity-80" />
                    </button>
                    <button 
                      onClick={() => handleDelete(projeto.id, projeto.nome)}
                      className={projectIconButtonClass}
                      title="Excluir Projeto"
                    >
                      <img src={trashIcon} alt="Excluir" className="w-6 h-6 object-contain opacity-80" />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white mb-1 leading-tight hover:underline">
                  <Link to={`/projetos/${projeto.id}`}>{projeto.nome}</Link>
                </h3>
                <p className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
                  <Link to={`/clientes/${projeto.clienteId}`} className="hover:text-zinc-600 hover:underline">{projeto.clienteNome}</Link>
                </p>
                
                {projeto.descricao && (
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-4 line-clamp-2 leading-relaxed">{projeto.descricao}</p>
                )}

                {/* Property tags */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {projeto.areaHa && (
                    <span className="geo-badge-base geo-badge-neutral px-2.5 py-1 text-xs">
                      <Compass className="w-3.5 h-3.5 text-zinc-400" /> {projeto.areaHa} ha
                    </span>
                  )}
                  {projeto.car && (
                    <span className="geo-badge-base geo-badge-neutral px-2.5 py-1 text-xs" title={`CAR: ${projeto.car}`}>
                      CAR: {projeto.car.substring(0, 10)}...
                    </span>
                  )}
                  {projeto.matricula && (
                    <span className="geo-badge-base geo-badge-neutral px-2.5 py-1 text-xs">
                      Matrícula: {projeto.matricula}
                    </span>
                  )}
                  {projeto.municipio && (
                    <span className="geo-badge-base geo-badge-neutral px-2.5 py-1 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400" /> {projeto.municipio}
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
                    <img src={folderIcon} alt="Folder" className="w-5 h-5 object-contain invert opacity-90" /> Acessar Projeto
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:translate-x-1">
                    <ArrowUpRight weight="bold" className="w-3.5 h-3.5 text-white" />
                  </div>
                </Link>
                <button 
                  onClick={() => handleAbrirPasta(projeto.id)}
                  className={cn(secondarySmallActionButtonClass, 'group w-full justify-between px-4 py-3')}
                >
                  <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-3">
                    <img src={windowsIcon} alt="Windows" className="w-5 h-5 object-contain opacity-70" /> Abrir no Windows
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5 dark:bg-zinc-900">
                    <ArrowUpRight weight="bold" className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100" />
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
            <ProjetosMap projetos={filteredProjetos} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Morphing Modal Expansion */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedProjeto ? 'Editar Projeto' : (modalContext === 'ambiental' || modalContext === 'licenciamento') ? 'Nova Demanda Ambiental' : 'Novo Projeto'}
        maxWidth="max-w-5xl w-full min-h-[660px]"
      >
        {/* Tabs Navigation */}
        <div role="tablist" aria-label="Abas do projeto" className={cn(geoTabListClass, 'mb-6 flex shrink-0 gap-2 overflow-x-auto')}>
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === 'projeto'}
            onClick={() => setActiveTab('projeto')}
            className={geoTabButtonClass(activeTab === 'projeto', 'system', 'px-4 py-2')}
          >
            <PresentationChart className="w-4 h-4" /> Dados do Projeto
          </button>
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === 'propriedade'}
            onClick={() => setActiveTab('propriedade')}
            className={geoTabButtonClass(activeTab === 'propriedade', 'field', 'px-4 py-2')}
          >
            <Compass className="w-4 h-4" /> Propriedade
          </button>
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === 'geoloc'}
            onClick={() => setActiveTab('geoloc')}
            className={geoTabButtonClass(activeTab === 'geoloc', 'success', 'px-4 py-2')}
          >
            <MapPin className="w-4 h-4" /> Geoloc & Notas
          </button>
        </div>

        {(() => {
          const inputClass = projectFieldClass;
          const selectClass = projectSelectClass;
          const textareaClass = projectTextareaClass;

          return (
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 h-full">
              <div className="flex-1 space-y-5 pb-6">
                {activeTab === 'projeto' && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <label htmlFor="projeto-nome" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Nome do Projeto</label>
                      <input id="projeto-nome" type="text" required value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Levantamento Lote 5" className={inputClass} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="projeto-cliente" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Cliente Vinculado</label>
                        <select id="projeto-cliente" required value={clienteId} onChange={e => setClienteId(e.target.value)} className={selectClass}>
                          <option value="">Selecione um cliente...</option>
                          {clientes.map((c: Cliente) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="projeto-status" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Status do Projeto</label>
                        <select id="projeto-status" value={status} onChange={e => setStatus(e.target.value)} className={selectClass}>
                          <option value="Em Análise">Em Análise</option>
                          <option value="Em Andamento">Em Andamento</option>
                          <option value="Aguardando Órgão">Aguardando Órgão</option>
                          <option value="Finalizado">Finalizado</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      </div>
                    </div>

                    {(modalContext === 'ambiental' || modalContext === 'licenciamento') && (
                      <div className="geo-card grid grid-cols-1 gap-5 bg-brand-green-50/50 p-4 dark:bg-brand-green-400/10 md:grid-cols-3">
                        <div>
                          <label htmlFor="ambiental-tipo" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Tipo de Serviço/Licença</label>
                          <select id="ambiental-tipo" value={tipoServicoLicenca} onChange={e => setTipoServicoLicenca(e.target.value)} className={selectClass}>
                            <option value="">Selecione...</option>
                            <option value="LP">Licença Prévia - LP</option>
                            <option value="LI">Licença de Instalação - LI</option>
                            <option value="LO">Licença de Operação - LO</option>
                            <option value="Renovação">Renovação</option>
                            <option value="Laudo Pericial">Laudo Pericial</option>
                            <option value="Outros">Outros</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="ambiental-orgao" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Órgão Ambiental Destino</label>
                          <input id="ambiental-orgao" type="text" value={orgaoAmbiental} onChange={e => setOrgaoAmbiental(e.target.value)} placeholder="Ex: IBAMA, SEMA, etc." className={inputClass} />
                        </div>
                        <div>
                          <label htmlFor="ambiental-processo" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Processo / Protocolo</label>
                          <input id="ambiental-processo" type="text" value={numeroProcesso} onChange={e => setNumeroProcesso(e.target.value)} placeholder="Opcional" className={inputClass} />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="projeto-data-inicio" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Data de Início</label>
                        <input id="projeto-data-inicio" type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="projeto-data-entrega" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Previsão de Entrega</label>
                        <input id="projeto-data-entrega" type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} className={inputClass} />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="projeto-descricao" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Descrição Curta</label>
                      <textarea id="projeto-descricao" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Breve resumo da finalidade do projeto..." rows={3} className={textareaClass} />
                    </div>
                  </div>
                )}

                {activeTab === 'propriedade' && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label htmlFor="projeto-tipo" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Tipo de Área / Empreendimento</label>
                        <select id="projeto-tipo" value={tipo} onChange={e => setTipo(e.target.value)} className={selectClass}>
                          <option value="Rural">Rural</option>
                          <option value="Urbano">Urbano</option>
                          <option value="Comercial">Comercial</option>
                          <option value="Industrial">Industrial</option>
                          <option value="Ambiental">Ambiental</option>
                          <option value="Institucional">Institucional</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="projeto-area" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Área (hectares)</label>
                        <input id="projeto-area" type="number" step="0.0001" value={areaHa} onChange={e => setAreaHa(e.target.value)} placeholder="Ex: 120.4500" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="projeto-situacao" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Situação Fundiária</label>
                        <select id="projeto-situacao" value={situacaoImovel} onChange={e => setSituacaoImovel(e.target.value)} className={selectClass}>
                          <option value="Regularizado">Regularizado</option>
                          <option value="Pendente">Pendente</option>
                          <option value="Posse">Posse</option>
                          <option value="Arrendado">Arrendado</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="projeto-matricula" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Número da Matrícula</label>
                        <input id="projeto-matricula" type="text" value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="Ex: Matrícula 12.345" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="projeto-averbacao" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Averbação</label>
                        <input id="projeto-averbacao" type="text" value={averbacao} onChange={e => setAverbacao(e.target.value)} placeholder="Ex: AV-3-12.345" className={inputClass} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label htmlFor="projeto-car" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">CAR (Cadastro Ambiental)</label>
                        <input id="projeto-car" type="text" value={car} onChange={e => setCar(e.target.value)} placeholder="Código CAR" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="projeto-ccir" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">CCIR</label>
                        <input id="projeto-ccir" type="text" value={ccir} onChange={e => setCcir(e.target.value)} placeholder="Código CCIR" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="projeto-itr" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">ITR (Nirf)</label>
                        <input id="projeto-itr" type="text" value={itr} onChange={e => setItr(e.target.value)} placeholder="Código ITR" className={inputClass} />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'geoloc' && (
                  <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="projeto-municipio" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Município</label>
                        <input id="projeto-municipio" type="text" value={municipio} onChange={e => setMunicipio(e.target.value)} placeholder="Nome do município" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="projeto-cidade" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Cidade / UF</label>
                        <input id="projeto-cidade" type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: Curitiba - PR" className={inputClass} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label htmlFor="projeto-latitude" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Latitude</label>
                        <input id="projeto-latitude" type="number" step="0.000000000000001" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="Latitude DD" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="projeto-longitude" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Longitude</label>
                        <input id="projeto-longitude" type="number" step="0.000000000000001" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="Longitude DD" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="projeto-memorial" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Possui Memorial Descritivo?</label>
                        <select id="projeto-memorial" value={possuiMemorialDescritivo} onChange={e => setPossuiMemorialDescritivo(e.target.value)} className={selectClass}>
                          <option value="Sim">Sim</option>
                          <option value="Não">Não</option>
                          <option value="Em Confecção">Em Confecção</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="projeto-observacoes" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Anotações / Observações Adicionais</label>
                      <textarea id="projeto-observacoes" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Escreva observações técnicas sobre o imóvel, limites, marcos ou trâmites de cartório..." rows={4} className={textareaClass} />
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 z-10 mt-auto flex items-center justify-end gap-3 border-t border-brand-border bg-brand-surface pt-4 pb-2 dark:bg-brand-surface-muted">
                <button type="button" onClick={() => setShowModal(false)} className={secondarySmallActionButtonClass}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitProjectMutation.isPending} className={cn(primarySubmitButtonClass, 'px-6 py-3 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed')}>
                  {submitProjectMutation.isPending && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {selectedProjeto ? 'Salvar Alterações' : modalContext === 'ambiental' || modalContext === 'licenciamento' ? 'Criar Demanda' : 'Criar Projeto'}
                </button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* Modal Arquivos Locais */}
      <Modal
        isOpen={!!showArquivosModal}
        onClose={() => setShowArquivosModal(null)}
        title="Arquivos do Projeto"
        maxWidth="max-w-5xl"
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-sm -mt-4 mb-6" title={arquivosPasta}>
          {arquivosPasta || 'Buscando no disco local...'}
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
        loading={deleteProjectMutation.isPending || deleteFileMutation.isPending}
      />
    </Layout>
  );
}
