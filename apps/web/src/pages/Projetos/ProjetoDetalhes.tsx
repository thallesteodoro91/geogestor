import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useState } from 'react';
import { CheckboxField, DatePickerField, FormSelect } from '../../components/Form';
import { apiFetch, apiClient, getDownloadUrl } from '../../services/apiClient';
import { getTaskPriorityTone } from '../../utils/taskPriority';
import { geoViewTransition } from '../../utils/motion';
import { primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { cn } from '../../utils/cn';
import { geoFieldClass, geoPurpleSurfaceClass, geoTabButtonClass, geoTabIconClass, geoTabListClass } from '../../utils/geoTheme';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
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
  Check, 
  Info
} from '@phosphor-icons/react';

interface Projeto {
  id: string;
  nome: string;
  descricao?: string;
  clienteId?: string;
  clienteNome?: string;
  status?: string;
  dataInicio?: string;
  dataEntrega?: string;
  areaHa?: number | string | null;
  matricula?: string;
  car?: string;
  ccir?: string;
  itr?: string;
  cidade?: string;
  municipio?: string;
  situacaoImovel?: string;
  tipo?: string;
  averbacao?: string;
  latitude?: number | null;
  longitude?: number | null;
  possuiMemorialDescritivo?: string;
  observacoes?: string;
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

interface Despesa {
  id: string;
  projetoId: string;
  descricao: string;
  valor: number;
  categoria: string;
  data: string;
  observacoes?: string;
  status?: string;
}

const projectDetailFieldClass = cn(geoFieldClass, 'w-full p-3 text-sm font-medium');
const projectDetailSelectClass = cn(projectDetailFieldClass, 'font-semibold');
const projectDetailCardClass = 'geo-card p-6';

export function ProjetoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'tarefas' | 'arquivos' | 'financeiro'>('tarefas');
  
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

  const [expDescricao, setExpDescricao] = useState('');
  const [expValor, setExpValor] = useState('');
  const [expData, setExpData] = useState(new Date().toISOString().split('T')[0]);
  const [expCategoria, setExpCategoria] = useState('Combustível');
  const [expObservacoes, setExpObservacoes] = useState('');

  // 1. Fetch Project Details (which includes clientNome)
  const { data: projeto, isLoading: loadingProjeto } = useQuery<Projeto>({
    queryKey: ['projeto', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/projetos/${id}`);
      if (!res.ok) throw new Error('Projeto não encontrado');
      return res.json();
    },
    enabled: !!id
  });

  // 2. Fetch Project Tasks
  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery<Tarefa[]>({
    queryKey: ['projeto-tarefas', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/tarefas?projetoId=${id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  // 3. Fetch Project Files
  const { data: filesData = { files: [], path: '' }, isLoading: loadingFiles } = useQuery<{ files: ArquivoItem[]; path: string }>({
    queryKey: ['projeto-arquivos', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/arquivos/projeto/${id}`);
      if (res.ok) {
        const data = await res.json();
        return { files: data.files || [], path: data.path || '' };
      }
      return { files: [], path: '' };
    },
    enabled: !!id
  });

  const projetoFiles = filesData.files;
  const projetoFilesPasta = filesData.path;

  // 4. Fetch all expenses (filter by project)
  const { data: despesas = [], isLoading: loadingDespesas } = useQuery<Despesa[]>({
    queryKey: ['despesas'],
    queryFn: () => apiClient.get<Despesa[]>('/api/financeiro/despesas')
  });

  const projectDespesas = despesas.filter((d: Despesa) => d.projetoId === id);

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
      alert('Erro ao criar tarefa.');
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
      alert('Erro ao atualizar tarefa.');
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
      alert('Erro ao excluir tarefa.');
    }
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (payload: Omit<Despesa, 'id'>) => {
      const res = await apiFetch('/api/financeiro/despesas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erro ao registrar despesa');
      return res.json();
    },
    onSuccess: () => {
      setExpDescricao('');
      setExpValor('');
      setExpObservacoes('');
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
    },
    onError: () => {
      alert('Erro ao criar despesa.');
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
      queryClient.invalidateQueries({ queryKey: ['despesas'] });
    },
    onError: () => {
      alert('Erro ao excluir despesa.');
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
      alert(`Erro ao enviar arquivo: ${err.message}`);
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
      alert('Erro ao excluir o arquivo.');
    }
  });

  const openFolderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/projetos/${id}/abrir-pasta`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Erro ao abrir pasta');
      return res.json();
    },
    onSuccess: (data) => {
      console.log('Pasta aberta:', data.path);
    },
    onError: () => {
      alert('Não foi possível abrir a pasta local automaticamente. Verifique se o caminho existe.');
    }
  });

  // Actions
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      uploadFileMutation.mutate(file);
    } catch (err) {
      console.error(err);
      alert('Erro ao processar o arquivo.');
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

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDescricao.trim() || !expValor.trim()) return;
    
    // Parse currency float to cents integer
    const cleanVal = expValor.replace(/\D/g, '');
    const valorCents = parseInt(cleanVal, 10);
    
    if (isNaN(valorCents)) return;

    addExpenseMutation.mutate({
      projetoId: id || '',
      descricao: expDescricao,
      valor: valorCents,
      data: expData,
      categoria: expCategoria,
      observacoes: expObservacoes,
      status: 'Pago'
    });
  };

  const handleOpenFolder = () => {
    openFolderMutation.mutate();
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

  if (loadingProjeto) {
    return (
      <Layout>
        <div className="py-24 flex justify-center">
          <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-8 w-8 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary-600" />
        </div>
      </Layout>
    );
  }

  if (!projeto) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Projeto não encontrado</h2>
          <button onClick={() => navigate('/projetos')} className={primarySmallActionButtonClass}>
            Voltar para lista de projetos
          </button>
        </div>
      </Layout>
    );
  }

  const totalDespesas = projectDespesas.reduce((acc: number, cur: Despesa) => acc + (Number(cur.valor) || 0), 0);

  return (
    <Layout>
      {/* Top Bar with back button */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/projetos')}
          className="geo-focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-brand-surface text-zinc-600 transition-[background-color,color,border-color,transform] hover:bg-brand-surface-subtle active:scale-95 dark:text-zinc-300"
        >
          <ArrowLeft weight="bold" className="w-4 h-4" />
        </button>
        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Link to="/projetos" className="hover:text-zinc-900 dark:text-zinc-100 transition-colors">Projetos</Link>
          <span className="mx-2 text-zinc-300">/</span>
          <span className="text-zinc-950 dark:text-white">{projeto.nome}</span>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-semibold tracking-tighter text-zinc-950 dark:text-white">{projeto.nome}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider uppercase ${getStatusColor(projeto.status || 'Em Andamento')}`}>
              {projeto.status || 'Em Andamento'}
            </span>
          </div>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400 font-medium">
            Vinculado ao cliente: <Link to={`/clientes/${projeto.clienteId}`} className="text-zinc-950 dark:text-white font-semibold underline hover:text-zinc-700">{projeto.clienteNome || 'Cliente'}</Link>
          </p>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={handleOpenFolder}
            className={secondarySmallActionButtonClass}
          >
            <FolderOpen weight="bold" className="w-4 h-4 text-amber-500" />
            <span>Abrir Pasta do Projeto</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        {/* Left Column: General & Property Details */}
        <div className="lg:col-span-1 space-y-6">
          {/* General info Card */}
          <div className={projectDetailCardClass}>
            <h3 className="text-lg font-semibold text-zinc-950 dark:text-white mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-zinc-400" /> Detalhes Gerais
            </h3>
            
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Descrição</p>
                <p className="text-zinc-900 dark:text-zinc-100 font-medium mt-1 leading-relaxed">{projeto.descricao || 'Sem descrição cadastrada.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Data de Início</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-1">
                    {projeto.dataInicio ? new Date(projeto.dataInicio).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Prazo de Entrega</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-1">
                    {projeto.dataEntrega ? new Date(projeto.dataEntrega).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Technical / Property Card */}
          <div className={projectDetailCardClass}>
            <h3 className="text-lg font-semibold text-zinc-950 dark:text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-zinc-400" /> Dados da Propriedade (Imóvel)
            </h3>
            
            <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm text-zinc-600">
              {projeto.areaHa && (
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Área (Hectares)</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-0.5">{projeto.areaHa} ha</p>
                </div>
              )}
              {projeto.tipo && (
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Tipo</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-0.5">{projeto.tipo}</p>
                </div>
              )}
              {projeto.matricula && (
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Matrícula</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-0.5">{projeto.matricula}</p>
                </div>
              )}
              {projeto.car && (
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">CAR</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-0.5">{projeto.car}</p>
                </div>
              )}
              {projeto.ccir && (
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">CCIR</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-0.5">{projeto.ccir}</p>
                </div>
              )}
              {projeto.itr && (
                <div>
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">ITR</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-0.5">{projeto.itr}</p>
                </div>
              )}
              {projeto.situacaoImovel && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Situação do Imóvel</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-medium mt-0.5">{projeto.situacaoImovel}</p>
                </div>
              )}
              {(projeto.cidade || projeto.municipio) && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Localidade</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-medium mt-0.5">{projeto.cidade} - {projeto.municipio || ''}</p>
                </div>
              )}
              {projeto.averbacao && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Averbação</p>
                  <p className="text-zinc-900 dark:text-zinc-100 font-medium mt-0.5">{projeto.averbacao}</p>
                </div>
              )}
            </div>

            {/* Coordinates and memorial description */}
            {(projeto.latitude || projeto.longitude) && (
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-brand-border pt-4 text-xs">
                <div>
                  <p className="text-zinc-400 font-semibold uppercase tracking-wider">Latitude</p>
                  <p className="font-mono text-zinc-800 dark:text-zinc-200 mt-0.5">{projeto.latitude}</p>
                </div>
                <div>
                  <p className="text-zinc-400 font-semibold uppercase tracking-wider">Longitude</p>
                  <p className="font-mono text-zinc-800 dark:text-zinc-200 mt-0.5">{projeto.longitude}</p>
                </div>
              </div>
            )}
            
            {projeto.possuiMemorialDescritivo && (
              <div className="mt-4 flex items-center justify-between border-t border-brand-border pt-4 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">Memorial Descritivo:</span>
                <span className={`px-2 py-0.5 rounded font-semibold text-xs ${
                  projeto.possuiMemorialDescritivo === 'Sim' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                }`}>
                  {projeto.possuiMemorialDescritivo}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dynamic Tabs (Tasks, Files, Finance) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Navigation */}
          <div role="tablist" aria-label="Abas de detalhes do projeto" className={cn(geoTabListClass, 'flex gap-2 overflow-x-auto hide-scrollbar')}>
            <button 
              role="tab"
              aria-selected={activeTab === 'tarefas'}
              onClick={() => setActiveTab('tarefas')}
              className={geoTabButtonClass(activeTab === 'tarefas', 'system', 'px-4 py-2.5')}
            >
              <span aria-hidden="true" className={geoTabIconClass(activeTab === 'tarefas', 'system')}><CheckSquare weight={activeTab === 'tarefas' ? 'fill' : 'regular'} className="h-4 w-4" /></span>
              Checklist ({tarefas.length})
            </button>
            <button 
              role="tab"
              aria-selected={activeTab === 'arquivos'}
              onClick={() => setActiveTab('arquivos')}
              className={geoTabButtonClass(activeTab === 'arquivos', 'field', 'px-4 py-2.5')}
            >
              <span aria-hidden="true" className={geoTabIconClass(activeTab === 'arquivos', 'field')}><Folder weight={activeTab === 'arquivos' ? 'fill' : 'regular'} className="h-4 w-4" /></span>
              Documentos ({projetoFiles.length})
            </button>
            <button 
              role="tab"
              aria-selected={activeTab === 'financeiro'}
              onClick={() => setActiveTab('financeiro')}
              className={geoTabButtonClass(activeTab === 'financeiro', 'finance', 'px-4 py-2.5')}
            >
              <span aria-hidden="true" className={geoTabIconClass(activeTab === 'financeiro', 'danger')}><CurrencyDollar weight={activeTab === 'financeiro' ? 'fill' : 'regular'} className="h-4 w-4" /></span>
              Despesas ({projectDespesas.length})
            </button>
          </div>

          {/* Dynamic Tab Contents */}
          <div className="min-h-[400px]">
            {activeTab === 'tarefas' && (
              <div className="space-y-4">
                {/* Form to add tasks */}
                <div className={projectDetailCardClass}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-zinc-950 dark:text-white flex items-center gap-2">
                      Checklist do Projeto
                    </h3>
                    <button 
                      onClick={() => setShowNewTaskForm(!showNewTaskForm)}
                      className={cn(secondarySmallActionButtonClass, 'min-h-9 px-3 py-1.5 text-xs')}
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Tarefa
                    </button>
                  </div>

                  <AnimatePresence>
                    {showNewTaskForm && (
                      <motion.form 
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={geoViewTransition}
                        onSubmit={handleAddTask} 
                        className="mb-6 space-y-4 border-t border-brand-border pt-4 motion-gpu"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Título</label>
                            <input 
                              type="text" 
                              value={taskTitulo} 
                              onChange={(e) => setTaskTitulo(e.target.value)}
                              placeholder="Ex: Emitir Memorial Descritivo..."
                              className={projectDetailFieldClass}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Prioridade</label>
                            <FormSelect
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
                            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Data Limite</label>
                            <DatePickerField
                              value={taskDataLimite} 
                              onChange={(e) => setTaskDataLimite(e.target.value)}
                              className={projectDetailSelectClass}
                            />
                          </div>

                          <div className="col-span-1 md:col-span-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Descrição (Opcional)</label>
                            <textarea 
                              value={taskDescricao} 
                              onChange={(e) => setTaskDescricao(e.target.value)}
                              placeholder="Observações ou subpassos..."
                              rows={2}
                              className={projectDetailFieldClass}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            type="submit" 
                            disabled={addTaskMutation.isPending}
                            className={cn(primarySmallActionButtonClass, 'min-h-10 px-4 py-2.5 text-xs')}
                          >
                            Criar Tarefa
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setShowNewTaskForm(false)}
                            className={cn(secondarySmallActionButtonClass, 'min-h-10 px-4 py-2.5 text-xs')}
                          >
                            Cancelar
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  {/* Tasks Checklist */}
                  {loadingTarefas ? (
                    <div className="py-8 flex justify-center">
                      <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-6 w-6 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary-600" />
                    </div>
                  ) : tarefas.length === 0 ? (
                    <div className="geo-empty-state py-6 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">Nenhuma tarefa associada a este projeto.</div>
                  ) : (
                    <div className="space-y-3 pt-2">
                      {tarefas.map((task: Tarefa) => {
                        const priorityTone = getTaskPriorityTone(task.prioridade);

                        return (
                        <div 
                          key={task.id}
                          className={`geo-card-interactive flex items-center justify-between border-l-4 p-4 motion-gpu motion-standard ${priorityTone.cardClass}`}
                        >
                          <div className="flex items-center gap-3">
                            <CheckboxField
                              id={`project-task-${task.id}`}
                              label={`Marcar ${task.titulo} como concluída`}
                              checked={task.status === 'Concluído'}
                              onChange={(checked) => updateTaskMutation.mutate({ taskId: task.id, status: checked ? 'Concluído' : 'A Fazer' })}
                              compact
                              labelHidden
                            />
                            
                            <div>
                              <span className={`text-sm font-semibold tracking-tight ${task.status === 'Concluído' ? 'line-through text-zinc-400 font-normal' : 'text-zinc-950 dark:text-white'}`}>
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
                                  <span className="text-zinc-400">
                                    Limite: {new Date(task.dataLimite).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button 
                            onClick={() => setDeleteTarget({ type: 'task', item: task })}
                            className="geo-focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-[background-color,color,transform] hover:bg-brand-red-50 hover:text-brand-red-600 active:scale-95 dark:hover:bg-brand-red-400/10"
                          >
                            <Trash className="w-4 h-4" />
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
              <div className="geo-card flex flex-col p-6">
                <div className="mb-6 flex flex-col items-start justify-between gap-2 border-b border-brand-border pb-4 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-950 dark:text-white flex items-center gap-2">
                      Documentos Locais
                    </h3>
                    <p className="mt-1 inline-block select-all rounded-lg bg-brand-surface-subtle p-2 font-mono text-xs text-zinc-500 dark:bg-brand-surface-muted dark:text-zinc-400" title={projetoFilesPasta}>
                      {projetoFilesPasta || 'Buscando diretório...'}
                    </p>
                  </div>
                </div>

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
                    className="hidden" 
                    onChange={handleFileUploadChange} 
                  />
                  <label 
                    htmlFor="file-upload" 
                    className="cursor-pointer flex flex-col items-center gap-2 w-full text-center"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-zinc-500 shadow-sm dark:bg-brand-surface-muted dark:text-zinc-400">
                      <CloudArrowUp weight="duotone" className="w-6 h-6 text-emerald-500" />
                    </div>
                    <span className="text-sm font-semibold text-zinc-700">
                      {uploading ? 'Processando...' : 'Arraste arquivos ou clique para fazer upload'}
                    </span>
                    <span className="text-xs text-zinc-400">
                      Qualquer tipo de arquivo local (GPKG, KML, KMZ, DWG, PDF, JPG, etc. Máx 50MB)
                    </span>
                  </label>
                </div>

                {/* Files List */}
                <div className="space-y-3">
                  {loadingFiles ? (
                    <div className="py-8 flex justify-center">
                      <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-6 w-6 animate-spin rounded-full border-2 border-brand-border border-t-brand-green-600" />
                    </div>
                  ) : projetoFiles.length === 0 ? (
                    <div className="geo-empty-state py-12 text-center">
                      <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Nenhum arquivo nesta pasta local ainda.</p>
                    </div>
                  ) : (
                    projetoFiles.map((file: ArquivoItem, idx: number) => {
                      let FileIcon = FileDashed;
                      let iconColor = "text-zinc-400";
                      let bgColor = "bg-zinc-50 dark:bg-zinc-950";

                      if (file.extension === '.pdf') { FileIcon = FilePdf; iconColor = "text-red-500"; bgColor = "bg-red-50"; }
                      if (file.extension === '.docx') { FileIcon = FileDoc; iconColor = "text-blue-500"; bgColor = "bg-blue-50"; }
                      if (file.extension === '.csv' || file.extension === '.xlsx') { FileIcon = FileText; iconColor = "text-emerald-500"; bgColor = "bg-emerald-50"; }
                      if (file.extension === '.gpkg' || file.extension === '.shp' || file.extension === '.kml' || file.extension === '.kmz' || file.extension === '.geojson') { FileIcon = Files; iconColor = "text-indigo-500"; bgColor = "bg-indigo-50"; }
                      if (file.extension === '.dwg') { FileIcon = Files; iconColor = "text-amber-500"; bgColor = "bg-amber-50"; }

                      return (
                        <motion.div 
                          key={file.name}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="geo-card-interactive group flex items-center gap-4 p-4"
                        >
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgColor} flex-shrink-0`}>
                            <FileIcon weight="duotone" className={`w-5 h-5 ${iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-zinc-950 dark:text-white text-sm truncate" title={file.name}>{file.name}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold tracking-wider mt-0.5">
                              {(file.sizeBytes / 1024).toFixed(1)} KB • {new Date(file.modifiedAt).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => window.open(getDownloadUrl(file.path))}
                              className="geo-focus-ring flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border bg-brand-surface-subtle text-zinc-600 transition-[background-color,color,border-color,transform] hover:border-brand-primary-300/60 hover:bg-brand-primary-50/70 hover:text-brand-primary-700 active:scale-95 dark:bg-brand-surface-muted dark:text-zinc-100 dark:hover:bg-brand-primary-400/10 dark:hover:text-brand-primary-100"
                              title="Baixar Arquivo"
                            >
                              <DownloadSimple weight="bold" className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFileDelete(file.path, file.name)}
                              className="geo-focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-[background-color,color,transform] hover:bg-brand-red-50 hover:text-brand-red-600 active:scale-95 dark:hover:bg-brand-red-400/10"
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
              </div>
            )}

            {activeTab === 'financeiro' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Add Expense Form */}
                <div className={cn(projectDetailCardClass, 'h-fit')}>
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-white mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-zinc-400" /> Registrar Despesa
                  </h3>
                  
                  <form onSubmit={handleAddExpense} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Descrição</label>
                      <input 
                        type="text" 
                        value={expDescricao} 
                        onChange={(e) => setExpDescricao(e.target.value)}
                        placeholder="Ex: Custas de cartório, combustível..."
                        className={projectDetailFieldClass}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Valor (R$)</label>
                        <input 
                          type="text" 
                          value={expValor} 
                          onChange={(e) => setExpValor(e.target.value)}
                          placeholder="0,00"
                          className={projectDetailSelectClass}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Data</label>
                        <DatePickerField
                          value={expData} 
                          onChange={(e) => setExpData(e.target.value)}
                          className={projectDetailSelectClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Categoria</label>
                      <FormSelect
                        value={expCategoria}
                        onChange={(e) => setExpCategoria(e.target.value)}
                        className={projectDetailSelectClass}
                      >
                        <option value="Combustível">Combustível</option>
                        <option value="Cartório">Cartório</option>
                        <option value="Alimentação">Alimentação</option>
                        <option value="Equipamento">Equipamento</option>
                        <option value="Outro">Outro</option>
                      </FormSelect>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Observações (Opcional)</label>
                      <textarea 
                        value={expObservacoes} 
                        onChange={(e) => setExpObservacoes(e.target.value)}
                        rows={2}
                        className={projectDetailFieldClass}
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={addExpenseMutation.isPending}
                      className={cn(primarySmallActionButtonClass, 'w-full py-3')}
                    >
                      <Check className="w-4 h-4" /> Salvar Despesa
                    </button>
                  </form>
                </div>

                {/* Expenses list and summary */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Summary card */}
                  <div className={cn(geoPurpleSurfaceClass, 'geo-card flex flex-col justify-between p-6 text-white')}>
                    <div>
                      <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Custo Total Executado no Projeto</p>
                      <p className="text-3xl font-bold mt-1 text-red-400">{formatCurrency(totalDespesas)}</p>
                    </div>
                  </div>

                  {/* List */}
                  <div className={projectDetailCardClass}>
                    <h3 className="text-base font-semibold text-zinc-950 dark:text-white mb-4">Detalhamento de Custos</h3>
                    
                    {loadingDespesas ? (
                      <div className="py-8 flex justify-center">
                        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-6 w-6 animate-spin rounded-full border-2 border-brand-border border-t-brand-primary-600" />
                      </div>
                    ) : projectDespesas.length === 0 ? (
                      <div className="geo-empty-state py-6 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">Nenhuma despesa registrada para este projeto.</div>
                    ) : (
                      <div className="space-y-3">
                        {projectDespesas.map((exp: Despesa) => (
                          <div 
                            key={exp.id}
                            className="geo-card-interactive flex items-center justify-between p-4"
                          >
                            <div>
                              <p className="text-sm font-semibold text-zinc-950 dark:text-white">{exp.descricao}</p>
                              <p className="text-xs text-zinc-400 font-medium mt-0.5">
                                {exp.categoria} • {new Date(exp.data).toLocaleDateString('pt-BR')}
                              </p>
                              {exp.observacoes && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 italic mt-1">{exp.observacoes}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-red-600">{formatCurrency(exp.valor)}</span>
                              <button 
                                onClick={() => setDeleteTarget({ type: 'expense', item: exp })}
                                className="geo-focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-[background-color,color,transform] hover:bg-brand-red-50 hover:text-brand-red-600 active:scale-95 dark:hover:bg-brand-red-400/10"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
            ? 'A despesa será removida do projeto e os totais financeiros e indicadores da DRE serão recalculados. O projeto será preservado. Esta ação não pode ser desfeita.'
            : 'O arquivo será removido permanentemente do disco local e deixará de aparecer nos documentos do projeto. Esta ação não pode ser desfeita.'}
        confirmText={deleteTarget?.type === 'task' ? 'Excluir tarefa' : deleteTarget?.type === 'expense' ? 'Excluir despesa' : 'Excluir arquivo'}
        loading={deleteTaskMutation.isPending || deleteExpenseMutation.isPending || deleteFileMutation.isPending}
      />
    </Layout>
  );
}
