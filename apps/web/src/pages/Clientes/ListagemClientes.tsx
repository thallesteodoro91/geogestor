import { DatePickerField, FormSelect } from '../../components/Form';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Layout } from '../../components/Layout';
import { ModuleNavigation } from '../../components/ModuleNavigation';
import { PageFilterBar } from '../../components/PageFilterBar';
import { PageHeader } from '../../components/PageHeader';
import { Modal } from '../../components/Modal';
import { FileUploadModal } from '../../components/FileUploadModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { apiClient } from '../../services/apiClient';
import { motion } from 'framer-motion';
import { Plus, EnvelopeSimple, Phone, Trash, Note, Info, Users, ClockCounterClockwise, WhatsappLogo, Envelope, UsersThree, ChatText, FolderSimple, DownloadSimple, FilePdf, FileDoc, FileText, FileDashed, Files, MagnifyingGlass, DotsThree, PencilSimple, ArrowSquareOut, X, ArrowsDownUp, WarningCircle } from '@phosphor-icons/react';
import {
  CLIENT_CATEGORY_OPTIONS,
  CLIENT_ORIGIN_OPTIONS,
  getClientCategoryTagClass
} from '../../utils/clientTags';
import { getClientCategoryIcon, getClientCategoryColorClass } from '../../utils/clientIcons';
import { cn } from '../../utils/cn';
import { headerPrimaryActionButtonClass, headerPrimaryActionIconClass, primarySmallActionButtonClass, primarySubmitButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { getDownloadUrl } from '../../services/apiClient';
import { CustomSelect } from '../../components/CustomSelect';
import { ClienteFormFields } from './ClienteFormFields';
import {
  applyClientPrefill,
  clientFormFingerprint,
  clientFormToPayload,
  clientRecordToForm,
  createEmptyClientForm,
  validateClientForm,
  type ClientFormErrors,
  type ClientFormState,
  type PersonType
} from './clientForm';
import { filterSearchInputClass } from '../../utils/filterStyles';
import { geoFieldClass, geoTabButtonClass, geoTabIconClass, geoTabListClass } from '../../utils/geoTheme';
import { commercialContentClass } from '../../utils/commercialLayout';

export interface Cliente {
  id: string;
  nome: string;
  tipoPessoa?: PersonType | null;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  numero?: string | null;
  semNumero?: boolean | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  celular?: string | null;
  celularWhatsapp?: boolean | null;
  cpf?: string | null;
  rg?: string | null;
  cnpj?: string | null;
  inscricaoEstadual?: string | null;
  origem?: string | null;
  origemPrincipal?: string | null;
  origemDetalhe?: string | null;
  indicadoPor?: string | null;
  categoria?: string | null;
  perfis?: string | null;
  anotacoes?: string | null;
  situacao?: string | null;
  previsaoEntrega?: string | null;
  servicos?: string | null;
  ultimaInteracao?: string | null;
  propriedadesCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface ClientPage {
  items: Cliente[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const EMPTY_CLIENTS: Cliente[] = [];

type ClientModalTab = 'basico' | 'notas' | 'historico' | 'arquivos';

const splitClientTags = (value?: string | null) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const clienteFieldClass = cn(geoFieldClass, 'w-full px-4 py-2.5 text-sm font-medium');
const clienteTextareaClass = cn(geoFieldClass, 'w-full resize-none px-4 py-3 font-medium leading-relaxed');

const BRAZILIAN_AREA_CODES = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99'
]);

type FormattedPhone = {
  display: string;
  href?: string;
  valid: boolean;
};

const formatBrazilianPhone = (value?: string | null): FormattedPhone | null => {
  if (!value?.trim()) return null;

  const original = value.trim();
  const explicitlyInternational = original.startsWith('+');
  let digits = original.replace(/\D/g, '');

  if (explicitlyInternational && !digits.startsWith('55')) {
    return { display: original, valid: false };
  }

  if (digits.length === 12 || digits.length === 13) {
    if (!digits.startsWith('55')) return { display: original, valid: false };
    digits = digits.slice(2);
  }

  // Prefixos nacionais antigos como 0XX devem ser removidos antes de validar o DDD.
  if ((digits.length === 11 || digits.length === 12) && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length !== 10 && digits.length !== 11) {
    return { display: original, valid: false };
  }

  const areaCode = digits.slice(0, 2);
  const subscriber = digits.slice(2);
  const isMobile = subscriber.length === 9;
  const validSubscriber = isMobile
    ? subscriber.startsWith('9')
    : /^[2-5]/.test(subscriber);

  if (!BRAZILIAN_AREA_CODES.has(areaCode) || !validSubscriber) {
    return { display: original, valid: false };
  }

  const formattedSubscriber = isMobile
    ? `${subscriber.slice(0, 5)}-${subscriber.slice(5)}`
    : `${subscriber.slice(0, 4)}-${subscriber.slice(4)}`;

  return {
    display: `+55 (${areaCode}) ${formattedSubscriber}`,
    href: `tel:+55${digits}`,
    valid: true
  };
};

const isValidEmail = (value?: string | null) =>
  Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeStyle: 'short'
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const clientCountFormatter = new Intl.NumberFormat('pt-BR');

const formatPropertyCountLabel = (value: number) =>
  `${clientCountFormatter.format(value)} ${value === 1 ? 'propriedade vinculada' : 'propriedades vinculadas'}`;

const formatLastInteraction = (value?: string | null) => {
  if (!value) return { relative: 'Sem interações' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { relative: 'Sem interações' };

  const differenceInSeconds = (date.getTime() - Date.now()) / 1000;
  const absoluteSeconds = Math.abs(differenceInSeconds);
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  let divisor = 1;

  if (absoluteSeconds >= 31_536_000) {
    unit = 'year';
    divisor = 31_536_000;
  } else if (absoluteSeconds >= 2_592_000) {
    unit = 'month';
    divisor = 2_592_000;
  } else if (absoluteSeconds >= 604_800) {
    unit = 'week';
    divisor = 604_800;
  } else if (absoluteSeconds >= 86_400) {
    unit = 'day';
    divisor = 86_400;
  } else if (absoluteSeconds >= 3_600) {
    unit = 'hour';
    divisor = 3_600;
  } else if (absoluteSeconds >= 60) {
    unit = 'minute';
    divisor = 60;
  }

  return {
    relative: relativeTimeFormatter.format(Math.round(differenceInSeconds / divisor), unit),
    full: dateTimeFormatter.format(date)
  };
};

const getClientCategory = (cliente: Cliente) =>
  cliente.categoria || (cliente.documento && cliente.documento.length > 14 ? 'Empresa' : 'Produtor Rural');

const splitClientName = (value: string) => {
  const match = value.trim().match(/^(Srta?\.|Sra\.|Dra?\.|Profa?\.)\s+(.+)$/i);
  return match
    ? { honorific: match[1], name: match[2] }
    : { honorific: null, name: value };
};

const clientListTagClass = 'inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-xs font-bold leading-4';

const getClientListStatusClass = (status: string) => cn(
  clientListTagClass,
  status === 'Inativo'
    ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-100'
    : status === 'Ativo'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-100'
      : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-400/40 dark:bg-sky-500/20 dark:text-sky-100'
);

interface ClientActionsMenuProps {
  cliente: Cliente;
  returnTo: string;
  onEdit: (cliente: Cliente) => void;
  onDelete: (id: string, name: string) => void;
}

function ClientActionsMenu({ cliente, returnTo, onEdit, onDelete }: ClientActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={`Ações de ${cliente.nome}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-lg text-zinc-600 transition-[background-color,color] duration-150 hover:bg-brand-surface-subtle hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-brand-surface-muted dark:hover:text-white"
      >
        <DotsThree aria-hidden="true" weight="bold" className="h-5 w-5" />
      </button>
      {isOpen && (
        <div
          role="menu"
          className="geo-surface-raised absolute right-0 top-full z-40 mt-1.5 w-48 overflow-hidden p-1.5"
        >
          <Link
            to={`/clientes/${cliente.id}`}
            state={{ clientesReturnTo: returnTo }}
            role="menuitem"
            onClick={() => setIsOpen(false)}
            className="geo-focus-ring flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 transition-[background-color,color] hover:bg-brand-surface-subtle hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-brand-surface-muted dark:hover:text-white"
          >
            <ArrowSquareOut aria-hidden="true" className="h-4 w-4" />
            Abrir cadastro
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onEdit(cliente);
            }}
            className="geo-focus-ring flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-zinc-700 transition-[background-color,color] hover:bg-brand-surface-subtle hover:text-zinc-950 dark:text-zinc-200 dark:hover:bg-brand-surface-muted dark:hover:text-white"
          >
            <PencilSimple aria-hidden="true" className="h-4 w-4" />
            Editar
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onDelete(cliente.id, cliente.nome);
            }}
            className="geo-focus-ring flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-brand-red-700 transition-[background-color,color] hover:bg-brand-red-50 dark:text-brand-red-200 dark:hover:bg-brand-red-500/12"
          >
            <Trash aria-hidden="true" className="h-4 w-4" />
            Excluir
          </button>
        </div>
      )}
    </div>
  );
}

const readInitialListValue = (search: string, key: string, fallback: string) => {
  const valueFromUrl = new URLSearchParams(search).get(key);
  if (valueFromUrl) return valueFromUrl;

  try {
    const stored = JSON.parse(window.sessionStorage.getItem('geogestor:clientes:list-state') || '{}') as Record<string, string>;
    return stored[key] || fallback;
  } catch {
    return fallback;
  }
};

export function ListagemClientes() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const handledRouteActionRef = useRef(false);
  const editReturnClienteIdRef = useRef<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [activeTab, setActiveTab] = useState<ClientModalTab>('basico');
  const [searchTerm, setSearchTerm] = useState(() => readInitialListValue(location.search, 'q', ''));
  const [situacaoFilter, setSituacaoFilter] = useState(() => readInitialListValue(location.search, 'status', 'Todos'));
  const [categoriaFilter, setCategoriaFilter] = useState(() => readInitialListValue(location.search, 'categoria', 'Todos'));
  const [origemFilter, setOrigemFilter] = useState(() => readInitialListValue(location.search, 'origem', 'Todos'));
  const [sortOrder, setSortOrder] = useState(() => readInitialListValue(location.search, 'ordenar', 'recentes'));
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(() => {
    const value = Number(readInitialListValue(location.search, 'pagina', '1'));
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  });
  const resetPageAfterFirstCriteriaChangeRef = useRef(false);

  // Client files states
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

  const [clientForm, setClientForm] = useState<ClientFormState>(() => createEmptyClientForm());
  const [clientFormErrors, setClientFormErrors] = useState<ClientFormErrors>({});
  const [clientFormDirty, setClientFormDirty] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const initialClientFormRef = useRef(clientFormFingerprint(createEmptyClientForm()));

  // Historico CRM form states
  const [histTipo, setHistTipo] = useState('Whatsapp');
  const [histData, setHistData] = useState(new Date().toISOString().split('T')[0]);
  const [histDescricao, setHistDescricao] = useState('');

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const { data: clientPage, isLoading: loading, isError: hasLoadError, isFetching, refetch } = useQuery<ClientPage>({
    queryKey: ['clientes', 'directory', page, deferredSearchTerm, situacaoFilter, categoriaFilter, origemFilter, sortOrder],
    queryFn: () => {
      const params = new URLSearchParams({
        mode: 'page',
        page: String(page),
        limit: '30',
        ordenar: sortOrder
      });
      if (deferredSearchTerm.trim()) params.set('q', deferredSearchTerm.trim());
      if (situacaoFilter !== 'Todos') params.set('status', situacaoFilter);
      if (categoriaFilter !== 'Todos') params.set('categoria', categoriaFilter);
      if (origemFilter !== 'Todos') params.set('origem', origemFilter);
      return apiClient.get<ClientPage>(`/api/clientes?${params}`);
    },
    placeholderData: (previous) => previous
  });
  const clientes = clientPage?.items || EMPTY_CLIENTS;
  const totalClients = clientPage?.total || 0;
  const totalPages = clientPage?.totalPages || 1;

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
  const filteredClientes = clientes;
  const paginatedClientes = clientes;
  const activeClientCriteriaCount = [
    searchTerm,
    situacaoFilter !== 'Todos',
    categoriaFilter !== 'Todos',
    origemFilter !== 'Todos',
    sortOrder !== 'recentes'
  ].filter(Boolean).length;
  const activeFilterChips = [
    situacaoFilter !== 'Todos' ? { key: 'status', label: `Status: ${situacaoFilter}`, clear: () => setSituacaoFilter('Todos') } : null,
    categoriaFilter !== 'Todos' ? { key: 'categoria', label: `Categoria: ${categoriaFilter}`, clear: () => setCategoriaFilter('Todos') } : null,
    origemFilter !== 'Todos' ? { key: 'origem', label: `Origem: ${origemFilter}`, clear: () => setOrigemFilter('Todos') } : null
  ].filter((chip): chip is { key: string; label: string; clear: () => void } => Boolean(chip));

  // 4. Mutations
  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/clientes/${id}`);
    },
    onSuccess: () => {
      setConfirmData(prev => ({ ...prev, isOpen: false }));
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente excluído com sucesso.');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir cliente';
      toast.error(msg);
    }
  });

  const submitClientMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof clientFormToPayload>) => {
      if (selectedCliente) {
        return await apiClient.patch(`/api/clientes/${selectedCliente.id}`, payload);
      }
      return await apiClient.post('/api/clientes', payload);
    },
    onSuccess: () => {
      const feedbackMessage = selectedCliente ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.';
      setSuccessMessage(feedbackMessage);
      setClientFormDirty(false);
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-dashboard', selectedCliente?.id] });
      toast.success(feedbackMessage);
      if (selectedCliente && editReturnClienteIdRef.current) {
        const returnId = editReturnClienteIdRef.current;
        editReturnClienteIdRef.current = null;
        navigate(`/clientes/${returnId}`);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : (selectedCliente ? 'Erro ao atualizar cliente' : 'Erro ao criar cliente');
      toast.error(msg);
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
      setConfirmData(prev => ({ ...prev, isOpen: false }));
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
      title: `Excluir arquivo “${filePath.split(/[\\/]/).pop() || 'arquivo'}”?`,
      description: 'O arquivo será removido permanentemente do disco local e deixará de aparecer nos documentos do cliente. Esta ação não pode ser desfeita.',
      confirmText: 'Excluir arquivo',
      onConfirm: () => deleteFileMutation.mutate(filePath)
    });
  };

  const openCreateModal = (prefill?: Record<string, string>) => {
    const nextForm = applyClientPrefill(createEmptyClientForm(), prefill);
    setSelectedCliente(null);
    setClientForm(nextForm);
    setClientFormErrors({});
    initialClientFormRef.current = clientFormFingerprint(nextForm);
    setClientFormDirty(false);
    setActiveTab('basico');
    editReturnClienteIdRef.current = null;
    setShowModal(true);
  };

  const openEditModal = (cliente: Cliente) => {
    const nextForm = clientRecordToForm(cliente);
    setSelectedCliente(cliente);
    setClientForm(nextForm);
    setClientFormErrors({});
    initialClientFormRef.current = clientFormFingerprint(nextForm);
    setClientFormDirty(false);
    setActiveTab('basico');
    setShowModal(true);
  };

  const closeClientModal = () => {
    if (clientFormDirty && !submitClientMutation.isPending && !window.confirm('Descartar as alterações não salvas deste cliente?')) return;
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
    if (handledRouteActionRef.current) return;

    const routeParams = new URLSearchParams(location.search);
    if (routeParams.get('novo') === '1') {
      handledRouteActionRef.current = true;
      routeParams.delete('novo');
      setTimeout(() => {
        openCreateModal();
        navigate({ pathname: location.pathname, search: routeParams.toString() ? `?${routeParams}` : '' }, { replace: true });
      }, 0);
      return;
    }

    if (!routeState) return;

    if (routeState.openNewClientModal && routeState.prefillClientData) {
      handledRouteActionRef.current = true;
      const pre = routeState.prefillClientData;
      setTimeout(() => {
        openCreateModal(pre);
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
  }, [clientes, loading, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (!showModal) return;
    setClientFormDirty(clientFormFingerprint(clientForm) !== initialClientFormRef.current);
  }, [clientForm, showModal]);

  useEffect(() => {
    if (!clientFormDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [clientFormDirty]);

  useEffect(() => {
    if (!resetPageAfterFirstCriteriaChangeRef.current) {
      resetPageAfterFirstCriteriaChangeRef.current = true;
      return;
    }
    setPage(1);
  }, [categoriaFilter, deferredSearchTerm, origemFilter, situacaoFilter, sortOrder]);

  useEffect(() => {
    if (!clientPage || page <= clientPage.totalPages) return;
    const timeoutId = window.setTimeout(() => setPage(clientPage.totalPages), 0);
    return () => window.clearTimeout(timeoutId);
  }, [clientPage, page]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const setOrDelete = (key: string, value: string, defaultValue = '') => {
      if (!value || value === defaultValue) params.delete(key);
      else params.set(key, value);
    };

    setOrDelete('q', searchTerm);
    setOrDelete('status', situacaoFilter, 'Todos');
    setOrDelete('categoria', categoriaFilter, 'Todos');
    setOrDelete('origem', origemFilter, 'Todos');
    setOrDelete('ordenar', sortOrder, 'recentes');
    setOrDelete('pagina', String(page), '1');

    const nextSearch = params.toString();
    const currentSearch = location.search.replace(/^\?/, '');
    if (nextSearch !== currentSearch) {
      navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' }, { replace: true });
    }

    window.sessionStorage.setItem('geogestor:clientes:list-state', JSON.stringify({
      q: searchTerm,
      status: situacaoFilter,
      categoria: categoriaFilter,
      origem: origemFilter,
      ordenar: sortOrder,
      pagina: String(page)
    }));
  }, [categoriaFilter, location.pathname, location.search, navigate, origemFilter, page, searchTerm, situacaoFilter, sortOrder]);

  const handleDelete = (id: string, name: string) => {
    setConfirmData({
      isOpen: true,
      title: `Excluir ${name}?`,
      description: `O cliente “${name}”, seu histórico e seus vínculos serão removidos do GeoGestor. Por segurança, os arquivos da pasta local serão preservados. Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir cliente',
      onConfirm: () => deleteClientMutation.mutate(id)
    });
  };

  const clearClientFormErrors = (...fields: Array<keyof ClientFormState>) => {
    setClientFormErrors((current) => {
      if (!fields.some((field) => current[field])) return current;
      const next = { ...current };
      fields.forEach((field) => delete next[field]);
      return next;
    });
  };

  const activateClientTab = (tab: ClientModalTab, moveFocus = false) => {
    setActiveTab(tab);
    window.setTimeout(() => {
      const scrollRegion = document.getElementById('client-form-scroll-region');
      if (scrollRegion) scrollRegion.scrollTop = 0;
      if (moveFocus) document.getElementById(`client-tab-${tab}`)?.focus();
    }, 0);
  };

  const handleClientTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentTab: ClientModalTab) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabOrder: ClientModalTab[] = selectedCliente
      ? ['basico', 'notas', 'historico', 'arquivos']
      : ['basico', 'notas'];
    const currentIndex = tabOrder.indexOf(currentTab);
    let nextIndex = currentIndex;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabOrder.length - 1;
    else if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabOrder.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
    activateClientTab(tabOrder[nextIndex], true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateClientForm(clientForm, selectedCliente);
    setClientFormErrors(validation.errors);
    if (!validation.valid) {
      activateClientTab('basico');
      const firstField = Object.keys(validation.errors)[0] as keyof ClientFormState | undefined;
      const fieldId = firstField === 'tipoPessoa' ? 'client-tipo-pf' : firstField ? `client-${firstField}` : 'client-nome';
      window.setTimeout(() => document.getElementById(fieldId)?.focus(), 0);
      return;
    }
    submitClientMutation.mutate(validation.payload);
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
    <Layout contentClassName={commercialContentClass}>
      <PageHeader
        eyebrow="Diretório"
        title="Clientes"
        count={totalClients}
        description="Gerencie clientes, contatos, propriedades e histórico de interações."
        action={(
          <button
            type="button"
            onClick={() => openCreateModal()}
            className={cn(headerPrimaryActionButtonClass, 'w-full shadow-sm hover:shadow-md sm:w-auto')}
          >
            <span>Novo cliente</span>
            <span aria-hidden="true" className={headerPrimaryActionIconClass}>
              <Plus weight="bold" className="h-3.5 w-3.5" />
            </span>
          </button>
        )}
        navigation={<ModuleNavigation module="commercial" className="mb-0" />}
      />

      <PageFilterBar
        search={(
          <>
            <label htmlFor="client-search" className="sr-only">Buscar clientes</label>
            <div className="relative">
              <MagnifyingGlass aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="client-search"
                name="client-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar clientes por nome, documento ou contato…"
                autoComplete="off"
                className={filterSearchInputClass}
              />
            </div>
          </>
        )}
        filtersOpen={showFilters}
        onFiltersToggle={() => setShowFilters((current) => !current)}
        filterPanelId="client-filter-panel"
        activeFilterCount={activeClientCriteriaCount}
        onClear={() => {
          setSearchTerm('');
          setSituacaoFilter('Todos');
          setCategoriaFilter('Todos');
          setOrigemFilter('Todos');
          setSortOrder('recentes');
        }}
      >
        <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <span>Status</span>
            <CustomSelect
              id="client-status-filter"
              ariaLabel="Filtrar por status"
              value={situacaoFilter}
              onChange={setSituacaoFilter}
              placeholder="Status"
              className="min-w-0"
              options={[
                { label: 'Todos os status', value: 'Todos' },
                { label: 'Ativo', value: 'Ativo' },
                { label: 'Inativo', value: 'Inativo' },
                { label: 'Prospectado', value: 'Prospectado' }
              ]}
            />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <span>Categoria</span>
            <CustomSelect
              id="client-category-filter"
              ariaLabel="Filtrar por categoria"
              value={categoriaFilter}
              onChange={setCategoriaFilter}
              placeholder="Categoria"
              className="min-w-0"
              options={[
                { label: 'Todas as categorias', value: 'Todos' },
                ...CLIENT_CATEGORY_OPTIONS.map(opt => ({ label: opt, value: opt }))
              ]}
            />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <span>Origem</span>
            <CustomSelect
              id="client-origin-filter"
              ariaLabel="Filtrar por origem"
              value={origemFilter}
              onChange={setOrigemFilter}
              placeholder="Origem"
              className="min-w-0"
              options={[
                { label: 'Todas as origens', value: 'Todos' },
                ...CLIENT_ORIGIN_OPTIONS.map(opt => ({ label: opt, value: opt }))
              ]}
            />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <span>Ordenação</span>
            <div className="relative min-w-0">
              <ArrowsDownUp aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <CustomSelect
                id="client-sort-order"
                ariaLabel="Ordenar clientes"
                value={sortOrder}
                onChange={setSortOrder}
                placeholder="Ordenar por"
                className="min-w-0"
                buttonClassName="pl-9"
                options={[
                  { label: 'Cadastro mais recente', value: 'recentes' },
                  { label: 'Cadastro mais antigo', value: 'antigos' },
                  { label: 'Nome (A–Z)', value: 'az' },
                  { label: 'Nome (Z–A)', value: 'za' }
                ]}
              />
            </div>
        </label>
      </PageFilterBar>

      <div className="mb-4">
        {activeFilterChips.length > 0 && (
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2" aria-label="Filtros ativos">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Filtros ativos:</span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="geo-focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full border border-brand-primary-200 bg-brand-primary-50 px-2.5 py-1 text-xs font-semibold text-brand-primary-800 transition-[background-color,border-color] hover:bg-brand-primary-100 dark:border-brand-primary-300/25 dark:bg-brand-primary-400/12 dark:text-brand-primary-100 dark:hover:bg-brand-primary-400/20"
                aria-label={`Remover filtro ${chip.label}`}
              >
                {chip.label}
                <X aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-3 flex min-h-6 items-center justify-between gap-3 text-xs font-medium text-zinc-600 dark:text-zinc-300" role="status" aria-live="polite" aria-atomic="true">
        <span>{totalClients} {totalClients === 1 ? 'resultado encontrado' : 'resultados encontrados'}</span>
        {isFetching && !loading && <span>Atualizando…</span>}
      </div>

      <div>
        {hasLoadError ? (
          <div className="geo-empty-state p-10 text-center" role="alert">
            <WarningCircle aria-hidden="true" weight="duotone" className="mx-auto mb-3 h-9 w-9 text-brand-red-600 dark:text-brand-red-200" />
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Não foi possível carregar os clientes</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-300">Verifique a conexão com o GeoGestor e tente novamente.</p>
            <button type="button" onClick={() => refetch()} className={cn(secondarySmallActionButtonClass, 'mt-5')}>
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div className="geo-card overflow-hidden" aria-busy="true" aria-label="Carregando clientes">
            <div className="sr-only" role="status">Carregando clientes…</div>
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="flex items-center gap-4 border-b border-brand-border px-4 py-3 last:border-b-0">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-brand-surface-muted motion-reduce:animate-none" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-brand-surface-muted motion-reduce:animate-none" />
                  <div className="h-2.5 w-24 animate-pulse rounded bg-brand-surface-muted motion-reduce:animate-none" />
                </div>
                <div className="hidden h-3 w-44 animate-pulse rounded bg-brand-surface-muted motion-reduce:animate-none sm:block" />
              </div>
            ))}
          </div>
        ) : clientes.length === 0 ? (
          <div className="geo-card mx-auto max-w-lg p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-brand-primary-200 bg-brand-primary-50 text-brand-primary-600 dark:border-brand-primary-300/25 dark:bg-brand-primary-400/12 dark:text-brand-primary-100">
              <Users aria-hidden="true" weight="duotone" className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-zinc-950 dark:text-white">Nenhum cliente cadastrado</h2>
            <p className="mb-6 mt-2 text-sm text-zinc-600 dark:text-zinc-300">Cadastre seu primeiro cliente para gerenciar projetos, orçamentos e histórico de relacionamento.</p>
            <button type="button" onClick={() => openCreateModal()} className={cn(primarySmallActionButtonClass, 'px-6 py-3')}>
              Novo cliente
            </button>
          </div>
        ) : filteredClientes.length === 0 ? (
          <div className="geo-empty-state p-10 text-center">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Nenhum cliente encontrado</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Ajuste a busca ou remova os filtros aplicados.</p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSituacaoFilter('Todos');
                setCategoriaFilter('Todos');
                setOrigemFilter('Todos');
              }}
              className={cn(secondarySmallActionButtonClass, 'mt-5')}
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-2 text-left">
                <thead className="border-b border-brand-border bg-brand-surface-subtle/70">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                    <th scope="col" className="w-[35%] px-4 py-2.5">Cliente</th>
                    <th scope="col" className="w-[27%] px-4 py-2.5">Contato</th>
                    <th scope="col" className="w-[13%] px-4 py-2.5 text-center">Propriedades</th>
                    <th scope="col" className="w-[18%] px-4 py-2.5">Última interação</th>
                    <th scope="col" className="w-[7%] px-3 py-2.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClientes.map((cliente) => {
                    const clientName = splitClientName(cliente.nome);
                    const category = getClientCategory(cliente);
                    const categories = splitClientTags(category);
                    const status = cliente.situacao || 'Ativo';
                    const phone = formatBrazilianPhone(cliente.celular || cliente.telefone);
                    const interaction = formatLastInteraction(cliente.ultimaInteracao);
                    const propertyCount = cliente.propriedadesCount ?? 0;
                    const detailPath = `/clientes/${cliente.id}`;
                    const returnTo = `${location.pathname}${location.search}`;

                    return (
                      <tr key={cliente.id} className="group shadow-sm transition-shadow duration-150 hover:shadow-md">
                        <td className="rounded-l-lg border-y border-l border-brand-border bg-brand-surface px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-brand-surface-subtle">
                          <div className="flex min-w-0 items-center gap-3.5">
                            <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center ${getClientCategoryColorClass(category)}`}>
                              {getClientCategoryIcon(category, 'h-10 w-10')}
                            </span>
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                {clientName.honorific && (
                                  <span aria-label={`Tratamento: ${clientName.honorific}`} title="Tratamento" className="shrink-0 rounded bg-brand-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                                    {clientName.honorific}
                                  </span>
                                )}
                                <Link
                                  to={detailPath}
                                  state={{ clientesReturnTo: returnTo }}
                                  className="geo-focus-ring min-w-0 truncate rounded text-[15px] font-semibold text-zinc-950 transition-colors hover:text-brand-primary-700 hover:underline dark:text-white dark:hover:text-brand-primary-100"
                                  aria-label={`Abrir cadastro de ${clientName.name}`}
                                >
                                  {clientName.name}
                                </Link>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5" title={categories.join(', ')}>
                                {categories.length > 0 ? categories.map((item) => (
                                  <span key={item} className={cn(clientListTagClass, getClientCategoryTagClass(item))}>
                                    {item}
                                  </span>
                                )) : (
                                  <span className={cn(clientListTagClass, 'border-brand-border bg-brand-surface-muted text-zinc-700 dark:text-zinc-200')}>Sem categoria</span>
                                )}
                                <span className={getClientListStatusClass(status)}>{status}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="border-y border-brand-border bg-brand-surface px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-brand-surface-subtle">
                          <div className="min-w-0 space-y-1 text-[13px]">
                            {cliente.email ? (
                              isValidEmail(cliente.email) ? (
                                <a href={`mailto:${cliente.email}`} className="geo-focus-ring flex min-h-6 min-w-0 items-center gap-1.5 rounded text-zinc-700 hover:text-brand-primary-700 hover:underline dark:text-zinc-200 dark:hover:text-brand-primary-100">
                                  <EnvelopeSimple aria-hidden="true" className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{cliente.email}</span>
                                </a>
                              ) : (
                                <span className="flex min-w-0 items-center gap-1.5 text-amber-800 dark:text-amber-200" title="O e-mail precisa ser revisado">
                                  <WarningCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{cliente.email} · Revisar</span>
                                </span>
                              )
                            ) : <span className="text-zinc-500 dark:text-zinc-400">Sem e-mail</span>}
                            {phone ? (
                              phone.valid ? (
                                <a href={phone.href} className="geo-focus-ring flex min-h-6 items-center gap-1.5 rounded text-zinc-700 hover:text-brand-primary-700 hover:underline dark:text-zinc-200 dark:hover:text-brand-primary-100">
                                  <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
                                  {phone.display}
                                </a>
                              ) : (
                                <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-200" title="DDD ou quantidade de dígitos inválida">
                                  <WarningCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{phone.display} · Revisar telefone</span>
                                </span>
                              )
                            ) : <span className="text-zinc-500 dark:text-zinc-400">Sem telefone</span>}
                          </div>
                        </td>
                        <td className="border-y border-brand-border bg-brand-surface px-4 py-4 text-center align-middle text-[15px] font-semibold tabular-nums text-zinc-700 transition-colors duration-150 group-hover:bg-brand-surface-subtle dark:text-zinc-200" title={formatPropertyCountLabel(propertyCount)}>
                          <span aria-hidden="true">{clientCountFormatter.format(propertyCount)}</span>
                          <span className="sr-only">{formatPropertyCountLabel(propertyCount)}</span>
                        </td>
                        <td className="border-y border-brand-border bg-brand-surface px-4 py-4 align-middle transition-colors duration-150 group-hover:bg-brand-surface-subtle">
                          <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200" title={interaction.full}>
                            {interaction.relative}
                          </span>
                        </td>
                        <td className="rounded-r-lg border-y border-r border-brand-border bg-brand-surface px-3 py-4 text-right align-middle transition-colors duration-150 group-hover:bg-brand-surface-subtle">
                          <ClientActionsMenu cliente={cliente} returnTo={returnTo} onEdit={openEditModal} onDelete={handleDelete} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 lg:hidden">
              {paginatedClientes.map((cliente) => {
                const clientName = splitClientName(cliente.nome);
                const category = getClientCategory(cliente);
                const categories = splitClientTags(category);
                const status = cliente.situacao || 'Ativo';
                const phone = formatBrazilianPhone(cliente.celular || cliente.telefone);
                const interaction = formatLastInteraction(cliente.ultimaInteracao);
                const propertyCount = cliente.propriedadesCount ?? 0;
                const returnTo = `${location.pathname}${location.search}`;

                return (
                  <article key={cliente.id} className="geo-card p-[1.125rem]">
                    <div className="flex items-start gap-3.5">
                      <span aria-hidden="true" className={`flex h-12 w-12 shrink-0 items-center justify-center ${getClientCategoryColorClass(category)}`}>
                        {getClientCategoryIcon(category, 'h-11 w-11')}
                      </span>
                      <div className="min-w-0 flex-1">
                        {clientName.honorific && (
                          <span aria-label={`Tratamento: ${clientName.honorific}`} title="Tratamento" className="mb-1 inline-flex rounded bg-brand-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                            {clientName.honorific}
                          </span>
                        )}
                        <Link
                          to={`/clientes/${cliente.id}`}
                          state={{ clientesReturnTo: returnTo }}
                          className="geo-focus-ring block truncate rounded text-base font-semibold text-zinc-950 hover:text-brand-primary-700 hover:underline dark:text-white dark:hover:text-brand-primary-100"
                          aria-label={`Abrir cadastro de ${clientName.name}`}
                        >
                          {clientName.name}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {categories.length > 0 ? categories.map((item) => (
                            <span key={item} className={cn(clientListTagClass, getClientCategoryTagClass(item))}>
                              {item}
                            </span>
                          )) : (
                            <span className={cn(clientListTagClass, 'border-brand-border bg-brand-surface-muted text-zinc-700 dark:text-zinc-200')}>Sem categoria</span>
                          )}
                          <span className={getClientListStatusClass(status)}>{status}</span>
                        </div>
                      </div>
                      <ClientActionsMenu cliente={cliente} returnTo={returnTo} onEdit={openEditModal} onDelete={handleDelete} />
                    </div>

                    <dl className="mt-3.5 grid gap-3.5 border-t border-brand-border pt-3.5 text-[13px] sm:grid-cols-4">
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="font-semibold text-zinc-600 dark:text-zinc-300">Contato</dt>
                        <dd className="mt-1 min-w-0 space-y-1 text-zinc-700 dark:text-zinc-200">
                          {cliente.email ? (
                            isValidEmail(cliente.email)
                              ? <a href={`mailto:${cliente.email}`} className="geo-focus-ring flex min-h-6 items-center truncate rounded hover:text-brand-primary-700 hover:underline">{cliente.email}</a>
                              : <span className="block truncate text-amber-800 dark:text-amber-200">{cliente.email} · Revisar</span>
                          ) : <span>Sem e-mail</span>}
                          {phone ? (
                            phone.valid
                              ? <a href={phone.href} className="geo-focus-ring flex min-h-6 items-center rounded hover:text-brand-primary-700 hover:underline">{phone.display}</a>
                              : <span className="block truncate text-amber-800 dark:text-amber-200">{phone.display} · Revisar telefone</span>
                          ) : <span>Sem telefone</span>}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-zinc-600 dark:text-zinc-300">Propriedades</dt>
                        <dd className="mt-1 font-semibold tabular-nums text-zinc-700 dark:text-zinc-200" title={formatPropertyCountLabel(propertyCount)}>
                          <span aria-hidden="true">{clientCountFormatter.format(propertyCount)}</span>
                          <span className="sr-only">{formatPropertyCountLabel(propertyCount)}</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-zinc-600 dark:text-zinc-300">Última interação</dt>
                        <dd className="mt-1 font-medium text-zinc-700 dark:text-zinc-200" title={interaction.full}>{interaction.relative}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav className="flex flex-wrap items-center justify-center gap-3 pt-5" aria-label="Paginação de clientes">
                <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || isFetching} className={cn(secondarySmallActionButtonClass, 'disabled:cursor-not-allowed disabled:opacity-50')}>
                  Página anterior
                </button>
                <span className="min-w-28 text-center text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-300">Página {page} de {totalPages}</span>
                <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || isFetching} className={cn(secondarySmallActionButtonClass, 'disabled:cursor-not-allowed disabled:opacity-50')}>
                  Próxima página
                </button>
              </nav>
            )}
          </>
        )}
      </div>

      {/* Slide-over / Modal Expansion */}
      <Modal
        isOpen={showModal}
        onClose={closeClientModal}
        title={(
          <span className="flex flex-wrap items-center gap-2">
            <span>{selectedCliente ? 'Editar cliente' : 'Novo cliente'}</span>
            {clientFormDirty && (
              <span className="geo-badge-base geo-badge-unsaved px-2.5 py-1 text-[11px] font-bold leading-none">
                Alterações não salvas
              </span>
            )}
          </span>
        )}
        maxWidth="max-w-[960px]"
        contentScrollable={false}
        initialFocusId="client-nome"
      >
        <div className="flex min-h-0 flex-1 flex-col">
        {/* Tabs Navigation */}
        <div className="relative mb-4 shrink-0">
        <div className="overflow-x-auto pb-1">
        <div role="tablist" aria-label="Navegação de abas do cliente" className={cn(geoTabListClass, 'flex w-max min-w-full gap-1.5 sm:min-w-0')}>
          <button 
            id="client-tab-basico"
            type="button"
            role="tab"
            aria-selected={activeTab === 'basico'}
            aria-controls="client-panel-basico"
            tabIndex={activeTab === 'basico' ? 0 : -1}
            onClick={() => activateClientTab('basico')}
            onKeyDown={(event) => handleClientTabKeyDown(event, 'basico')}
            className={geoTabButtonClass(activeTab === 'basico', 'system', 'px-4 py-2')}
          >
            <span aria-hidden="true" className={geoTabIconClass(activeTab === 'basico', 'system')}><Info weight={activeTab === 'basico' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Cadastro
          </button>
          <button 
            id="client-tab-notas"
            type="button"
            role="tab"
            aria-selected={activeTab === 'notas'}
            aria-controls="client-panel-notas"
            tabIndex={activeTab === 'notas' ? 0 : -1}
            onClick={() => activateClientTab('notas')}
            onKeyDown={(event) => handleClientTabKeyDown(event, 'notas')}
            className={geoTabButtonClass(activeTab === 'notas', 'system', 'px-4 py-2')}
          >
            <span aria-hidden="true" className={geoTabIconClass(activeTab === 'notas', 'system')}><Note weight={activeTab === 'notas' ? 'fill' : 'regular'} className="h-4 w-4" /></span> Anotações fixas
          </button>
          {selectedCliente && (
            <button 
              id="client-tab-historico"
              type="button"
              role="tab"
              aria-selected={activeTab === 'historico'}
              aria-controls="client-panel-historico"
              tabIndex={activeTab === 'historico' ? 0 : -1}
              onClick={() => activateClientTab('historico')}
              onKeyDown={(event) => handleClientTabKeyDown(event, 'historico')}
              className={geoTabButtonClass(activeTab === 'historico', 'field', 'px-4 py-2')}
            >
              <span aria-hidden="true" className={geoTabIconClass(activeTab === 'historico', 'field')}><ClockCounterClockwise weight={activeTab === 'historico' ? 'bold' : 'regular'} className="h-4 w-4" /></span> Histórico CRM
            </button>
          )}
          {selectedCliente && (
            <button 
              id="client-tab-arquivos"
              type="button"
              role="tab"
              aria-selected={activeTab === 'arquivos'}
              aria-controls="client-panel-arquivos"
              tabIndex={activeTab === 'arquivos' ? 0 : -1}
              onClick={() => activateClientTab('arquivos')}
              onKeyDown={(event) => handleClientTabKeyDown(event, 'arquivos')}
              className={geoTabButtonClass(activeTab === 'arquivos', 'success', 'px-4 py-2')}
            >
              <span aria-hidden="true" className={geoTabIconClass(activeTab === 'arquivos', 'success')}><FolderSimple weight={activeTab === 'arquivos' ? 'bold' : 'regular'} className="h-4 w-4" /></span> Arquivos
            </button>
          )}
        </div>
        </div>
        {selectedCliente && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-brand-surface to-transparent sm:hidden" />}
        </div>

        {activeTab === 'arquivos' ? (
          // TAB: ARQUIVOS DO CLIENTE
          <div id="client-panel-arquivos" role="tabpanel" aria-labelledby="client-tab-arquivos" className="min-h-0 flex-1 overflow-y-auto pb-6 pr-1">
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
                          aria-label={`Baixar arquivo ${file.name}`}
                          className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-xl border border-sky-200/80 bg-sky-50 text-sky-600 shadow-sm transition-[background-color,border-color,color] hover:bg-sky-100 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300"
                          title="Baixar Arquivo"
                        >
                          <DownloadSimple weight="bold" className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClientFileDelete(file.path)}
                          aria-label={`Excluir arquivo ${file.name}`}
                          className="geo-focus-ring flex h-11 w-11 items-center justify-center rounded-xl border border-red-200/80 bg-red-50 text-red-600 shadow-sm transition-[background-color,border-color,color] hover:bg-red-100 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-400"
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
          <div id="client-panel-historico" role="tabpanel" aria-labelledby="client-tab-historico" className="min-h-0 flex-1 overflow-y-auto pb-6 pr-1">
            {/* Formulario de Nova Interação */}
            <form onSubmit={handleAddHistorico} className="geo-card mb-8 flex-shrink-0 p-5">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-500" /> Registrar Nova Interação
              </h4>
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <FormSelect
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
                </FormSelect>
                <DatePickerField
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
          <form
            id={`client-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`client-tab-${activeTab}`}
            onSubmit={handleSubmit}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div id="client-form-scroll-region" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-5 pr-1">
              <ClienteFormFields
                form={clientForm}
                setForm={setClientForm}
                errors={clientFormErrors}
                activeSection={activeTab === 'notas' ? 'notas' : 'basico'}
                editing={Boolean(selectedCliente)}
                onClearErrors={clearClientFormErrors}
              />
            </div>

            <div className="-mx-1 flex flex-shrink-0 flex-wrap items-center justify-end gap-3 border-t border-brand-border bg-brand-surface/95 px-1 pb-1 pt-4 backdrop-blur supports-[backdrop-filter]:bg-brand-surface/85 sm:flex-nowrap">
              <p className="mr-auto w-full text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:w-auto" role="status" aria-live="polite">
                {clientForm.perfis.length === 0 && clientForm.servicos.length === 0
                  ? 'Nenhum perfil ou serviço selecionado'
                  : `${clientForm.perfis.length} ${clientForm.perfis.length === 1 ? 'perfil' : 'perfis'} · ${clientForm.servicos.length} ${clientForm.servicos.length === 1 ? 'serviço' : 'serviços'}`}
              </p>
              <button type="button" onClick={closeClientModal} className={secondarySmallActionButtonClass}>
                Cancelar
              </button>
              <button type="submit" disabled={submitClientMutation.isPending} className={cn(primarySubmitButtonClass, 'px-6 py-3 disabled:cursor-wait disabled:opacity-70')}>
                {submitClientMutation.isPending ? 'Salvando…' : 'Salvar cliente'}
              </button>
            </div>
          </form>
        )}
        {(['basico', 'notas', ...(selectedCliente ? ['historico', 'arquivos'] : [])] as ClientModalTab[])
          .filter((tab) => tab !== activeTab)
          .map((tab) => (
            <div
              key={tab}
              id={`client-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`client-tab-${tab}`}
              hidden
            />
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmData.isOpen}
        onClose={() => setConfirmData(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmData.onConfirm}
        title={confirmData.title}
        description={confirmData.description}
        confirmText={confirmData.confirmText}
        loading={deleteClientMutation.isPending || deleteFileMutation.isPending}
      />
      <div className="sr-only" aria-live="polite" aria-atomic="true">{successMessage}</div>
    </Layout>
  );
}
