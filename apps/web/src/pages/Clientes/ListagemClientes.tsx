import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Layout } from '../../components/Layout';
import { Modal } from '../../components/Modal';
import { FileUploadModal } from '../../components/FileUploadModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { apiClient } from '../../services/apiClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, EnvelopeSimple, Phone, Trash, Note, Tag, Info, Users, ClockCounterClockwise, WhatsappLogo, Envelope, UsersThree, ChatText, FolderSimple, DownloadSimple, FilePdf, FileDoc, FileText, FileDashed, Files, MagnifyingGlass } from '@phosphor-icons/react';
import {
  CLIENT_CATEGORY_OPTIONS,
  CLIENT_ORIGIN_OPTIONS,
  CLIENT_SERVICOS_BY_CATEGORY,
  CLIENT_STATUS_OPTIONS,
  getClientCategoryTagClass,
  getClientOriginTagClass,
  getClientStatusTagClass,
  getClientServicoTagClass
} from '../../utils/clientTags';
import { getClientCategoryIcon, getClientCategoryColorClass } from '../../utils/clientIcons';
import { formatCnpj, formatCpf, formatPhoneBR } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { primaryActionButtonClass, primaryActionIconClass, primarySmallActionButtonClass, primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { getDownloadUrl } from '../../services/apiClient';
import eyeIcon from '../../assets/magnific-icons/eye-tracking_8052980.svg';
import editIcon from '../../assets/magnific-icons/writing_3215063.svg';
import trashIcon from '../../assets/magnific-icons/trash-bin_5510130.svg';
import { CustomSelect } from '../../components/CustomSelect';
import {
  filterBarClass,
  filterClearButtonClass,
  filterSearchInputClass
} from '../../utils/filterStyles';
import { geoFieldClass, geoKickerClass, geoTabButtonClass, geoTabListClass } from '../../utils/geoTheme';

export interface Cliente {
  id: string;
  nome: string;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  celular?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  origem?: string | null;
  categoria?: string | null;
  anotacoes?: string | null;
  situacao?: string | null;
  previsaoEntrega?: string | null;
  servicos?: string | null;
  ultimaInteracao?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const splitClientTags = (value?: string | null) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const clienteFieldClass = cn(geoFieldClass, 'w-full px-4 py-2.5 text-sm font-medium');
const clienteCompactFieldClass = cn(geoFieldClass, 'w-full px-4 py-2 text-sm font-medium');
const clienteTextareaClass = cn(geoFieldClass, 'w-full resize-none px-4 py-3 font-medium leading-relaxed');
const clientePanelClass = 'geo-card space-y-4 p-5';
const clienteChecklistClass = 'grid max-h-40 gap-2 overflow-y-auto rounded-lg border border-brand-border bg-brand-surface p-3';
const clienteCheckboxClass = 'h-4 w-4 rounded border-brand-border text-brand-primary-600 focus:ring-brand-primary-400';
const clienteActionLinkClass = 'geo-focus-ring flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-[background-color,color,transform] duration-150 active:scale-95';

export function ListagemClientes() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const handledRouteActionRef = useRef(false);
  const editReturnClienteIdRef = useRef<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [activeTab, setActiveTab] = useState<'basico' | 'contato' | 'notas' | 'historico' | 'arquivos'>('basico');
  const [searchTerm, setSearchTerm] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState('Todos');
  const [categoriaFilter, setCategoriaFilter] = useState('Todos');
  const [origemFilter, setOrigemFilter] = useState('Todos');
  const [sortOrder, setSortOrder] = useState('recentes');
  const [visibleCount, setVisibleCount] = useState(15);

  // Client files states
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

  // Form states
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [celular, setCelular] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [origem, setOrigem] = useState('');
  const [categoria, setCategoria] = useState('');
  const [anotacoes, setAnotacoes] = useState('');
  const [situacao, setSituacao] = useState('Ativo');
  const [previsaoEntrega, setPrevisaoEntrega] = useState('');
  const [servicos, setServicos] = useState('');
  const [activeServicoTab, setActiveServicoTab] = useState<string>('Ambiental');

  // Historico CRM form states
  const [histTipo, setHistTipo] = useState('Whatsapp');
  const [histData, setHistData] = useState(new Date().toISOString().split('T')[0]);
  const [histDescricao, setHistDescricao] = useState('');

  // 1. Fetching client list
  const { data: clientes = [], isLoading: loading } = useQuery<Cliente[]>({
    queryKey: ['clientes'],
    queryFn: () => apiClient.get<Cliente[]>('/api/clientes')
  });

  // 2. Fetching history list
  const { data: historico = [], isLoading: loadingHistorico } = useQuery<Array<{
    id: string;
    tipo: string;
    data: string;
    descricao: string;
  }>>({
    queryKey: ['cliente-historico', selectedCliente?.id],
    queryFn: async () => {
      if (!selectedCliente?.id) return [];
      try {
        return await apiClient.get<Array<{ id: string; tipo: string; data: string; descricao: string }>>(`/api/clientes/${selectedCliente.id}/historico`);
      } catch {
        return [];
      }
    },
    enabled: !!selectedCliente?.id
  });

  // 3. Fetching client files list
  const { data: filesData = { files: [], path: '' }, isLoading: clientFilesLoading } = useQuery<{
    files: Array<{ name: string; extension: string; path: string; sizeBytes: number; modifiedAt: string }>;
    path: string;
  }>({
    queryKey: ['cliente-arquivos', selectedCliente?.id],
    queryFn: async () => {
      if (!selectedCliente?.id) return { files: [], path: '' };
      try {
        const data = await apiClient.get<{ files?: Array<{ name: string; extension: string; path: string; sizeBytes: number; modifiedAt: string }>; path?: string }>(`/api/arquivos/cliente/${selectedCliente.id}`);
        return { files: data.files || [], path: data.path || '' };
      } catch {
        return { files: [], path: '' };
      }
    },
    enabled: !!selectedCliente?.id
  });

  const clientFiles = filesData.files;
  const clientFilesPasta = filesData.path;
  const selectedCategorias = splitClientTags(categoria);
  const selectedOrigens = splitClientTags(origem);
  const selectedServicos = splitClientTags(servicos);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const filteredClientes = useMemo(() => {
    const query = deferredSearchTerm.trim().toLowerCase();

    return clientes.filter((cliente) => {
      const searchable = [
        cliente.nome,
        cliente.email,
        cliente.telefone,
        cliente.celular,
        cliente.cpf,
        cliente.cnpj,
        cliente.documento,
        cliente.endereco,
        cliente.numero,
        cliente.bairro,
        (cliente.categoria || (cliente.documento && cliente.documento.length > 14 ? 'Empresa' : 'Produtor Rural')),
        cliente.origem
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesSituacao = situacaoFilter === 'Todos' || (cliente.situacao || 'Ativo') === situacaoFilter;
      const matchesCategoria = categoriaFilter === 'Todos' || splitClientTags((cliente.categoria || (cliente.documento && cliente.documento.length > 14 ? 'Empresa' : 'Produtor Rural'))).includes(categoriaFilter);
      const matchesOrigem = origemFilter === 'Todos' || splitClientTags(cliente.origem).includes(origemFilter);
      return matchesSearch && matchesSituacao && matchesCategoria && matchesOrigem;
    }).sort((a, b) => {
      if (sortOrder === 'az') return a.nome.localeCompare(b.nome);
      if (sortOrder === 'za') return b.nome.localeCompare(a.nome);
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (sortOrder === 'antigos') return dateA - dateB;
      return dateB - dateA;
    });
  }, [categoriaFilter, clientes, deferredSearchTerm, origemFilter, situacaoFilter, sortOrder]);
  const paginatedClientes = useMemo(() => filteredClientes.slice(0, visibleCount), [filteredClientes, visibleCount]);
  const hasClientFilters = Boolean(searchTerm || situacaoFilter !== 'Todos' || categoriaFilter !== 'Todos' || origemFilter !== 'Todos');

  const toggleTagValue = (
    value: string,
    selectedValues: string[],
    setValue: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const nextValues = selectedValues.includes(value)
      ? selectedValues.filter((item) => item !== value)
      : [...selectedValues, value];
    setValue(nextValues.join(', '));
  };

  // 4. Mutations
  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/clientes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir cliente';
      alert(msg);
    }
  });

  const submitClientMutation = useMutation({
    mutationFn: async (payload: Partial<Cliente>) => {
      if (selectedCliente) {
        return await apiClient.patch(`/api/clientes/${selectedCliente.id}`, payload);
      }
      return await apiClient.post('/api/clientes', payload);
    },
    onSuccess: () => {
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-dashboard', selectedCliente?.id] });
      if (selectedCliente && editReturnClienteIdRef.current) {
        const returnId = editReturnClienteIdRef.current;
        editReturnClienteIdRef.current = null;
        navigate(`/clientes/${returnId}`);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : (selectedCliente ? 'Erro ao atualizar cliente' : 'Erro ao criar cliente');
      alert(msg);
    }
  });

  const addHistoricoMutation = useMutation({
    mutationFn: async (payload: { tipo: string; data: string; descricao: string }) => {
      if (!selectedCliente) return;
      return await apiClient.post(`/api/clientes/${selectedCliente.id}/historico`, payload);
    },
    onSuccess: () => {
      setHistDescricao('');
      queryClient.invalidateQueries({ queryKey: ['cliente-historico', selectedCliente?.id] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar interação.';
      alert(msg);
    }
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedCliente) return;
      const formData = new FormData();
      formData.append('clienteId', selectedCliente.id);
      formData.append('file', file);

      await apiClient.post('/api/arquivos/upload/stream', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-arquivos', selectedCliente?.id] });
      queryClient.invalidateQueries({ queryKey: ['cliente-geo', selectedCliente?.id] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar arquivo';
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
      queryClient.invalidateQueries({ queryKey: ['cliente-arquivos', selectedCliente?.id] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir o arquivo.';
      alert(msg);
    }
  });

  // Action methods
  const uploadClientFile = async (file: File) => {
    if (!selectedCliente) return;
    setUploading(true);
    try {
      uploadFileMutation.mutate(file);
    } catch (err) {
      console.error(err);
      alert('Erro ao processar o arquivo.');
      setUploading(false);
    }
  };

  const handleClientFileDelete = (filePath: string) => {
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

  const openCreateModal = () => {
    setSelectedCliente(null);
    setNome('');
    setDocumento('');
    setEmail('');
    setTelefone('');
    setEndereco('');
    setNumero('');
    setBairro('');
    setCelular('');
    setCpf('');
    setCnpj('');
    setOrigem('');
    setCategoria('Pessoa Física');
    setAnotacoes('');
    setSituacao('Ativo');
    setPrevisaoEntrega('');
    setServicos('');
    setActiveTab('basico');
    editReturnClienteIdRef.current = null;
    setShowModal(true);
  };

  const openEditModal = (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setNome(cliente.nome || '');
    setDocumento(cliente.documento || '');
    setEmail(cliente.email || '');
    setTelefone(formatPhoneBR(cliente.telefone || ''));
    setEndereco(cliente.endereco || '');
    setNumero(cliente.numero || '');
    setBairro(cliente.bairro || '');
    setCelular(formatPhoneBR(cliente.celular || ''));
    setCpf(formatCpf(cliente.cpf || ''));
    setCnpj(formatCnpj(cliente.cnpj || ''));
    setOrigem(cliente.origem || '');
    setCategoria((cliente.categoria || (cliente.documento && cliente.documento.length > 14 ? 'Empresa' : 'Produtor Rural')) || 'Pessoa Física');
    setAnotacoes(cliente.anotacoes || '');
    setSituacao(cliente.situacao || 'Ativo');
    setPrevisaoEntrega(cliente.previsaoEntrega || '');
    setServicos(cliente.servicos || '');
    setActiveTab('basico');
    setShowModal(true);
  };

  const closeClientModal = () => {
    editReturnClienteIdRef.current = null;
    setShowModal(false);
  };

  useEffect(() => {
    const routeState = location.state as { 
      editClienteId?: string;
      returnToClienteId?: string;
      openNewClientModal?: boolean;
      prefillClientData?: Record<string, string>;
    } | null;
    if (handledRouteActionRef.current || !routeState) return;

    if (routeState.openNewClientModal && routeState.prefillClientData) {
      handledRouteActionRef.current = true;
      const pre = routeState.prefillClientData;
      setTimeout(() => {
        openCreateModal();
        if (pre.nome) setNome(pre.nome);
        if (pre.email) setEmail(pre.email);
        if (pre.telefone) setTelefone(formatPhoneBR(pre.telefone));
        if (pre.endereco) setEndereco(pre.endereco);
        if (pre.numero) setNumero(pre.numero);
        if (pre.bairro) setBairro(pre.bairro);
        if (pre.documento) setDocumento(pre.documento);
        if (pre.cpf) setCpf(formatCpf(pre.cpf));
        if (pre.cnpj) setCnpj(formatCnpj(pre.cnpj));
        navigate(location.pathname, { replace: true, state: {} });
      }, 0);
      return;
    }

    if (routeState.editClienteId && !loading) {
      const target = clientes.find((c) => c.id === routeState.editClienteId);
      if (target) {
        handledRouteActionRef.current = true;
        editReturnClienteIdRef.current = routeState.returnToClienteId || routeState.editClienteId || null;
        setTimeout(() => {
          openEditModal(target);
          navigate(location.pathname, { replace: true, state: {} });
        }, 0);
      }
    }
  }, [clientes, loading, location.pathname, location.state, navigate]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setVisibleCount(15);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [categoriaFilter, deferredSearchTerm, origemFilter, situacaoFilter, sortOrder]);

  const handleDelete = (id: string, name: string) => {
    setConfirmData({
      isOpen: true,
      title: 'Excluir Cliente',
      description: `Tem certeza que deseja excluir o cliente "${name}"? Cadastros, histórico e vínculos serão removidos do GeoGestor. Por segurança, os arquivos da pasta local serão preservados.`,
      onConfirm: () => {
        deleteClientMutation.mutate(id);
        setConfirmData(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Zod validation
    const payload = {
      nome,
      documento: documento || (selectedCategorias.includes('Pessoa Jurídica') ? cnpj : cpf) || null,
      email: email || null,
      telefone: telefone || null,
      endereco: endereco || null,
      numero: numero || null,
      bairro: bairro || null,
      celular: celular || null,
      cpf: cpf || null,
      cnpj: cnpj || null,
      origem: origem || null,
      categoria: categoria || null,
      anotacoes: anotacoes || null,
      situacao: situacao || 'Ativo',
      previsaoEntrega: previsaoEntrega || null,
      servicos: servicos || null
    };

    const schema = z.object({
      nome: z.string().min(1, 'Razão Social / Nome Completo é obrigatório'),
      email: z.string().email('E-mail inválido').optional().or(z.literal('')).nullable(),
    });

    const validation = schema.safeParse(payload);
    if (!validation.success) {
      alert(validation.error.issues[0].message);
      return;
    }

    submitClientMutation.mutate(payload);
  };

  const handleAddHistorico = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente) return;
    addHistoricoMutation.mutate({
      tipo: histTipo,
      data: histData,
      descricao: histDescricao
    });
  };

  // Helper values for background styles of situation
  const getStatusColor = (status: string) => {
    return getClientStatusTagClass(status);
  };

  const getInteractionIcon = (tipo: string) => {
    switch (tipo) {
      case 'Whatsapp': return <WhatsappLogo weight="duotone" className="w-5 h-5 text-emerald-500" />;
      case 'Ligação': return <Phone weight="duotone" className="w-5 h-5 text-blue-500" />;
      case 'Email': return <Envelope weight="duotone" className="w-5 h-5 text-amber-500" />;
      case 'Reunião': return <UsersThree weight="duotone" className="w-5 h-5 text-purple-500" />;
      default: return <ChatText weight="duotone" className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />;
    }
  };

  const getInteractionColor = (tipo: string) => {
    switch (tipo) {
      case 'Whatsapp': return 'bg-emerald-100 ring-emerald-50';
      case 'Ligação': return 'bg-blue-100 ring-blue-50';
      case 'Email': return 'bg-amber-100 ring-amber-50';
      case 'Reunião': return 'bg-purple-100 ring-purple-50';
      default: return 'bg-zinc-100 ring-zinc-50';
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div>
          <span className={cn(geoKickerClass, 'mb-4')}>
            Diretório
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
            Clientes
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Carteira de clientes ativos, contatos e propriedades integradas.
          </p>
        </div>
        
        <button 
          onClick={openCreateModal}
          className={primaryActionButtonClass}
        >
          <span>Novo Cliente</span>
          <div className={primaryActionIconClass}>
            <Plus weight="bold" className="w-4 h-4" />
          </div>
        </button>
      </div>

      <div className={cn('mb-6', filterBarClass)}>
        <div className="flex flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome, e-mail, telefone, CPF/CNPJ ou endereço..."
              className={filterSearchInputClass}
            />
          </div>
          <CustomSelect
            value={situacaoFilter}
            onChange={setSituacaoFilter}
            placeholder="Situações"
            options={[
              { label: 'Situações', value: 'Todos' },
              { label: 'Ativo', value: 'Ativo' },
              { label: 'Inativo', value: 'Inativo' },
              { label: 'Prospectado', value: 'Prospectado' }
            ]}
          />
          <CustomSelect
            value={categoriaFilter}
            onChange={setCategoriaFilter}
            placeholder="Categorias"
            options={[
              { label: 'Categorias', value: 'Todos' },
              ...CLIENT_CATEGORY_OPTIONS.map(opt => ({ label: opt, value: opt }))
            ]}
          />
          <CustomSelect
            value={origemFilter}
            onChange={setOrigemFilter}
            placeholder="Origens"
            options={[
              { label: 'Origens', value: 'Todos' },
              ...CLIENT_ORIGIN_OPTIONS.map(opt => ({ label: opt, value: opt }))
            ]}
          />
          <CustomSelect
            value={sortOrder}
            onChange={setSortOrder}
            placeholder="Ordenar"
            options={[
              { label: 'Mais Recentes', value: 'recentes' },
              { label: 'Mais Antigos', value: 'antigos' },
              { label: 'A-Z', value: 'az' },
              { label: 'Z-A', value: 'za' }
            ]}
          />
          {hasClientFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSituacaoFilter('Todos');
                setCategoriaFilter('Todos');
                setOrigemFilter('Todos');
                setSortOrder('recentes');
              }}
              className={filterClearButtonClass}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        ) : clientes.length === 0 ? (
          <div className="geo-card mx-auto max-w-lg p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg border border-brand-primary-200 bg-brand-primary-50 text-brand-primary-600 dark:border-brand-primary-300/25 dark:bg-brand-primary-400/12 dark:text-brand-primary-100">
              <Users weight="duotone" className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Nenhum cliente cadastrado</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Cadastre seu primeiro cliente para gerenciar projetos, orçamentos e histórico de relacionamento.</p>
            <button onClick={openCreateModal} className={cn(primarySmallActionButtonClass, 'px-6 py-3')}>
              Cadastrar Primeiro Cliente
            </button>
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="geo-empty-state p-10 text-center">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Nenhum cliente encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <>
            {paginatedClientes.map((cliente) => (
              <div 
                key={cliente.id}
                className="geo-card-interactive group motion-gpu content-auto flex flex-col justify-between gap-6 p-6 md:flex-row md:items-center"
              >
              <div className="flex-1 flex flex-col md:flex-row md:items-center gap-6">
                <div className={`w-14 h-14 flex items-center justify-center flex-shrink-0 ${getClientCategoryColorClass((cliente.categoria || (cliente.documento && cliente.documento.length > 14 ? 'Empresa' : 'Produtor Rural')))}`}>
                  {getClientCategoryIcon((cliente.categoria || (cliente.documento && cliente.documento.length > 14 ? 'Empresa' : 'Produtor Rural')), "w-11 h-11")}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-xl font-medium tracking-tight text-zinc-950 dark:text-white">{cliente.nome}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tracking-wider uppercase ${getStatusColor(cliente.situacao || 'Ativo')}`}>
                        {cliente.situacao || 'Ativo'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {splitClientTags((cliente.categoria || (cliente.documento && cliente.documento.length > 14 ? 'Empresa' : 'Produtor Rural'))).map((category) => (
                        <span key={category} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${getClientCategoryTagClass(category)}`}>
                          <Tag className="h-3 w-3" /> {category}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col justify-center space-y-1">
                    {cliente.email ? (
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        <EnvelopeSimple weight="duotone" className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span className="truncate">{cliente.email}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400 italic">Sem e-mail cadastrado</span>
                    )}
                    {cliente.telefone && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <Phone weight="duotone" className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>{cliente.telefone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-center">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Última Interação</span>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {cliente.ultimaInteracao ? new Date(cliente.ultimaInteracao).toLocaleDateString('pt-BR') : 'Recém cadastrado'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 border-t border-brand-border pt-4 md:border-t-0 md:pt-0">
                <Link
                  to={`/clientes/${cliente.id}`}
                  className={cn(clienteActionLinkClass, 'text-brand-primary-600 hover:bg-brand-primary-50 dark:text-brand-primary-200 dark:hover:bg-brand-primary-400/12')}
                >
                  <img src={eyeIcon} alt="" className="w-6 h-6 object-contain opacity-80" />
                  Ver Perfil
                </Link>
                <button
                  type="button"
                  onClick={() => openEditModal(cliente)}
                  className={cn(clienteActionLinkClass, 'text-zinc-600 hover:bg-brand-surface-subtle hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-brand-surface-muted dark:hover:text-zinc-100')}
                >
                  <img src={editIcon} alt="" className="w-6 h-6 object-contain opacity-80" />
                  Editar
                </button>
                <button 
                  onClick={() => handleDelete(cliente.id, cliente.nome)}
                  className="geo-focus-ring flex h-8 w-8 items-center justify-center rounded-lg transition-transform hover:scale-110 active:scale-95"
                  title="Excluir Cliente"
                >
                  <img src={trashIcon} alt="Excluir" className="w-6 h-6 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
                </button>
              </div>
              </div>
            ))}
            
            {visibleCount < filteredClientes.length && (
              <div className="pt-6 flex justify-center">
                <button
                  onClick={() => setVisibleCount(v => v + 15)}
                  className={secondarySmallActionButtonClass}
                >
                  Carregar mais clientes
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Slide-over / Modal Expansion */}
      <Modal
        isOpen={showModal}
        onClose={closeClientModal}
        title={selectedCliente ? 'Perfil Completo do Cliente' : 'Novo Cliente'}
        maxWidth="max-w-5xl"
      >
        {/* Tabs Navigation */}
        <div role="tablist" aria-label="Navegação de abas do cliente" className={cn(geoTabListClass, 'mb-6 flex gap-2 overflow-x-auto hide-scrollbar')}>
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === 'basico'}
            onClick={() => setActiveTab('basico')}
            className={geoTabButtonClass(activeTab === 'basico', 'system', 'px-4 py-2')}
          >
            <Info weight={activeTab === 'basico' ? 'fill' : 'regular'} className="w-4 h-4" /> Dados e Contato
          </button>
          <button 
            type="button"
            role="tab"
            aria-selected={activeTab === 'notas'}
            onClick={() => setActiveTab('notas')}
            className={geoTabButtonClass(activeTab === 'notas', 'system', 'px-4 py-2')}
          >
            <Note weight={activeTab === 'notas' ? 'fill' : 'regular'} className="w-4 h-4" /> Anotações Fixas
          </button>
          {selectedCliente && (
            <button 
              type="button"
              role="tab"
              aria-selected={activeTab === 'historico'}
              onClick={() => setActiveTab('historico')}
              className={geoTabButtonClass(activeTab === 'historico', 'field', 'px-4 py-2')}
            >
              <ClockCounterClockwise weight={activeTab === 'historico' ? 'bold' : 'regular'} className="w-4 h-4" /> Histórico CRM
            </button>
          )}
          {selectedCliente && (
            <button 
              type="button"
              role="tab"
              aria-selected={activeTab === 'arquivos'}
              onClick={() => {
                setActiveTab('arquivos');
              }}
              className={geoTabButtonClass(activeTab === 'arquivos', 'success', 'px-4 py-2')}
            >
              <FolderSimple weight={activeTab === 'arquivos' ? 'bold' : 'regular'} className="w-4 h-4" /> Arquivos
            </button>
          )}
        </div>

        {activeTab === 'arquivos' ? (
          // TAB: ARQUIVOS DO CLIENTE
          <div className="flex flex-col h-full pb-6">
            <div className="mb-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate" title={clientFilesPasta}>
                Pasta do Cliente: <span className="font-mono">{clientFilesPasta || 'Buscando...'}</span>
              </p>
            </div>

            {/* Drag and Drop Zone */}
            <div className="mb-6">
              <FileUploadModal
                onUpload={uploadClientFile}
                uploading={uploading}
                accept=".pdf,.gpkg,.kml,.kmz,.dwg,.shp,.xlsx,.csv,.docx,.png,.jpg,.jpeg"
              />
            </div>

            {/* Lista de Arquivos */}
            <div className="space-y-3">
              {clientFilesLoading ? (
                <div className="py-12 flex justify-center">
                  <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-8 h-8 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-emerald-600 animate-spin" />
                </div>
              ) : clientFiles.length === 0 ? (
                <div className="geo-empty-state py-12 text-center">
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm">Nenhum arquivo encontrado nesta pasta.</p>
                </div>
              ) : (
                clientFiles.map((file, idx: number) => {
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
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.open(getDownloadUrl(file.path))}
                          className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 border border-sky-200/80 dark:border-sky-800/60 text-sky-600 dark:text-sky-300 transition-all shadow-sm"
                          title="Baixar Arquivo"
                        >
                          <DownloadSimple weight="bold" className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClientFileDelete(file.path)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-950/40 hover:bg-red-100 border border-red-200/80 dark:border-red-800/60 text-red-600 dark:text-red-400 transition-all shadow-sm"
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
        ) : activeTab === 'historico' ? (
          // TAB: HISTORICO CRM TIMELINE
          <div className="flex flex-col h-full pb-6">
            {/* Formulario de Nova Interação */}
            <form onSubmit={handleAddHistorico} className="geo-card mb-8 flex-shrink-0 p-5">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-500" /> Registrar Nova Interação
              </h4>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <select 
                  value={histTipo} 
                  onChange={e => setHistTipo(e.target.value)} 
                  aria-label="Tipo de Interação"
                  className={cn(clienteFieldClass, 'md:w-auto')}
                >
                  <option value="Whatsapp">Whatsapp</option>
                  <option value="Ligação">Ligação Telefônica</option>
                  <option value="Reunião">Reunião Presencial/Online</option>
                  <option value="Email">E-mail</option>
                  <option value="Observação">Anotação Interna</option>
                </select>
                <input 
                  type="date" 
                  required 
                  value={histData} 
                  onChange={e => setHistData(e.target.value)} 
                  aria-label="Data da Interação"
                  className={cn(clienteFieldClass, 'md:w-auto')} 
                />
              </div>
              <textarea 
                required 
                value={histDescricao} 
                onChange={e => setHistDescricao(e.target.value)} 
                placeholder="Descreva os detalhes da interação (ex: Cliente aprovou o orçamento verbalmente, pediu desconto, etc...)" 
                rows={3} 
                aria-label="Descrição da Interação"
                className={cn(clienteTextareaClass, 'mb-3 text-sm')} 
              />
              <div className="flex justify-end">
                <button type="submit" className={primarySmallActionButtonClass}>Registrar no Histórico</button>
              </div>
            </form>

            {/* Timeline Render */}
            <div className="relative ml-8 pl-8 border-l-2 border-indigo-200 dark:border-indigo-900/50 space-y-6 overflow-visible">
              {loadingHistorico ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Carregando jornada do cliente...</p>
              ) : historico.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum histórico registrado para este cliente.</p>
              ) : (
                historico.map((item, idx: number) => (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} key={item.id} className="relative group overflow-visible">
                    {/* Dot / Icon centralizado sobre a linha vertical */}
                    <div className={`absolute -left-[50px] top-2.5 w-9 h-9 rounded-xl flex items-center justify-center ring-4 ring-white dark:ring-zinc-950 shadow-md ${getInteractionColor(item.tipo)} transition-transform group-hover:scale-110 z-10`}>
                      {getInteractionIcon(item.tipo)}
                    </div>
                    
                    {/* Card */}
                    <div className="geo-card-interactive p-4">
                      <div className="flex justify-between items-center gap-2 mb-2">
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{item.tipo}</span>
                        <span className="geo-badge-base geo-badge-neutral px-2.5 py-1 text-xs">
                          {new Date(item.data).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed break-words">
                        {item.descricao}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        ) : (
          // TABS COMUNS: Formulario Basico/Contato/Notas
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
            <div className="space-y-5 pb-6">
              {activeTab === 'basico' && (
                <div className="space-y-6">
                  {/* Card 1: Cadastro & Contato Unificados */}
                  <div className={clientePanelClass}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Dados Gerais e Contato</h4>
                    <div>
                      <label htmlFor="cliente-nome" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Razão Social / Nome Completo</label>
                      <input id="cliente-nome" type="text" required value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: João da Silva ou Agropecuária XYZ" className={clienteFieldClass} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedCategorias.includes('Pessoa Jurídica') || selectedCategorias.includes('Empresa') ? (
                        <div>
                          <label htmlFor="cliente-cnpj" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">CNPJ</label>
                          <input id="cliente-cnpj" type="text" value={cnpj} onChange={e => setCnpj(formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} className={clienteFieldClass} />
                        </div>
                      ) : (
                        <div>
                          <label htmlFor="cliente-cpf" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">CPF</label>
                          <input id="cliente-cpf" type="text" value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} className={clienteFieldClass} />
                        </div>
                      )}
                      <div>
                        <label htmlFor="cliente-documento" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Doc. Alternativo / RG</label>
                        <input id="cliente-documento" type="text" value={documento} onChange={e => setDocumento(e.target.value)} placeholder="Ex: RG, Inscrição Estadual" className={clienteFieldClass} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                      <div className="md:col-span-5">
                        <label htmlFor="cliente-email" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">E-mail</label>
                        <input id="cliente-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="exemplo@email.com" className={clienteFieldClass} />
                      </div>
                      <div className="md:col-span-3">
                        <label htmlFor="cliente-celular" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Celular / WhatsApp</label>
                        <input id="cliente-celular" type="text" value={celular} onChange={e => setCelular(formatPhoneBR(e.target.value))} placeholder="(00) 90000-0000" maxLength={15} className={clienteFieldClass} />
                      </div>
                      <div className="md:col-span-4">
                        <label htmlFor="cliente-telefone" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Telefone Fixo</label>
                        <input id="cliente-telefone" type="text" value={telefone} onChange={e => setTelefone(formatPhoneBR(e.target.value))} placeholder="(00) 0000-0000" maxLength={15} className={clienteFieldClass} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                      <div className="md:col-span-6">
                        <label htmlFor="cliente-endereco" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Endereço Completo</label>
                        <input id="cliente-endereco" type="text" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, avenida, estrada ou localidade" className={clienteFieldClass} />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="cliente-numero" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Número</label>
                        <input id="cliente-numero" type="text" value={numero} onChange={e => setNumero(e.target.value)} placeholder="S/N" className={clienteFieldClass} />
                      </div>
                      <div className="md:col-span-4">
                        <label htmlFor="cliente-bairro" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">Bairro</label>
                        <input id="cliente-bairro" type="text" value={bairro} onChange={e => setBairro(e.target.value)} placeholder="Bairro ou comunidade" className={clienteFieldClass} />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Classificação & Canal */}
                  <div className={clientePanelClass}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Categorização e Origem</h4>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                      <div className="md:row-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Tipo / Categoria</label>
                        <div className={clienteChecklistClass}>
                          {CLIENT_CATEGORY_OPTIONS.map((option) => (
                            <label key={option} className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedCategorias.includes(option)}
                                onChange={() => toggleTagValue(option, selectedCategorias, setCategoria)}
                                className={clienteCheckboxClass}
                              />
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getClientCategoryTagClass(option)}`}>
                                {option}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="md:row-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Origem / Canal</label>
                        <div className={clienteChecklistClass}>
                          {CLIENT_ORIGIN_OPTIONS.map((option) => (
                            <label key={option} className="flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedOrigens.includes(option)}
                                onChange={() => toggleTagValue(option, selectedOrigens, setOrigem)}
                                className={clienteCheckboxClass}
                              />
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getClientOriginTagClass(option)}`}>
                                {option}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label htmlFor="cliente-previsao" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Previsão de Entrega</label>
                        <input type="date" id="cliente-previsao" value={previsaoEntrega} onChange={e => setPrevisaoEntrega(e.target.value)} className={clienteCompactFieldClass} />
                      </div>
                      <div className="md:col-start-3">
                        <label htmlFor="cliente-situacao" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Situação</label>
                        <select
                          id="cliente-situacao"
                          name="situacao"
                          value={situacao}
                          onChange={e => setSituacao(e.target.value)}
                          className={clienteCompactFieldClass}
                        >
                          {CLIENT_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Serviços Principais */}
                  <div className={clientePanelClass}>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Serviços Principais</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Selecione os serviços divididos por setor:</p>
                    </div>
                    
                    {/* Tabs / Category Selector */}
                    <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                      {(Object.keys(CLIENT_SERVICOS_BY_CATEGORY) as Array<keyof typeof CLIENT_SERVICOS_BY_CATEGORY>).map((categoria) => (
                        <button
                          key={categoria}
                          type="button"
                          onClick={() => setActiveServicoTab(categoria)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                            activeServicoTab === categoria
                              ? "bg-brand-primary-500 text-white border-brand-primary-500 shadow-brand-primary"
                              : "bg-brand-surface text-zinc-600 border-brand-border hover:bg-brand-surface-subtle dark:bg-brand-surface-muted dark:text-zinc-300 dark:hover:bg-brand-surface"
                          )}
                        >
                          {categoria}
                        </button>
                      ))}
                    </div>

                    {/* Services by Category with Animation */}
                    <div className="relative min-h-[80px]">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeServicoTab}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.2 }}
                          className="flex flex-wrap gap-2 pt-1"
                        >
                          {CLIENT_SERVICOS_BY_CATEGORY[activeServicoTab as keyof typeof CLIENT_SERVICOS_BY_CATEGORY].map((opt) => {
                            const isSelected = selectedServicos.includes(opt);
                            return (
                              <label 
                                key={opt} 
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 transition-all select-none hover:border-brand-primary-300/55 active:scale-[0.97]",
                                  isSelected 
                                    ? "bg-brand-primary-50/70 dark:bg-brand-primary-400/10 border-brand-primary-300/70 shadow-brand" 
                                    : "bg-brand-surface border-brand-border"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleTagValue(opt, selectedServicos, setServicos)}
                                  className={cn(clienteCheckboxClass, 'h-3.5 w-3.5 cursor-pointer')}
                                />
                                <span className={cn(
                                  "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold truncate transition-all",
                                  getClientServicoTagClass(opt),
                                  !isSelected && "opacity-60 saturate-50"
                                )}>
                                  {opt}
                                </span>
                              </label>
                            );
                          })}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notas' && (
                <div>
                  <label htmlFor="cliente-anotacoes" className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Observações / Anotações Fixas</label>
                  <textarea id="cliente-anotacoes" value={anotacoes} onChange={e => setAnotacoes(e.target.value)} placeholder="Escreva observações comerciais contínuas ou detalhes contratuais..." rows={8} className={clienteTextareaClass} />
                </div>
              )}
            </div>

            <div className="flex flex-shrink-0 items-center justify-end gap-3 border-t border-brand-border pt-6">
              <button type="button" onClick={closeClientModal} className={secondarySmallActionButtonClass}>
                Cancelar
              </button>
              <button type="submit" className={cn(primarySubmitButtonClass, 'px-6 py-3')}>
                {selectedCliente ? 'Salvar Perfil' : 'Cadastrar'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmData.isOpen}
        onClose={() => setConfirmData(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        description={confirmData.description}
        loading={deleteClientMutation.isPending || deleteFileMutation.isPending}
      />
    </Layout>
  );
}
