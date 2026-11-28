import { useCallback, useEffect, useId, useMemo, useRef, useState, type ElementType, type ReactNode } from 'react';
import { appLinks } from '@geogestor/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowSquareOut,
  Check,
  CloudArrowUp,
  DownloadSimple,
  Eye,
  FileDashed,
  FileDoc,
  FilePdf,
  FileText,
  Files,
  FolderOpen,
  FolderSimple,
  ImageSquare,
  MapTrifold,
  PencilSimple,
  Plus,
  Receipt,
  Spinner,
  Tag,
  Trash,
  X
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { FormSelect } from '../../../components/Form';
import { SharedDataNotice } from '../../../components/SharedDataNotice';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Modal } from '../../../components/Modal';
import { apiFetch } from '../../../services/apiClient';
import { ClientLoadState } from '../ClientLoadState';
import { primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../../../utils/actionStyles';
import { cn } from '../../../utils/cn';
import { Link, useSearchParams } from 'react-router-dom';
import { CLIENT_RECORD_PAGE_SIZE, compareClientDates, compareClientNumbers, normalizeClientSearch } from './clientTabRecords';
import { ClientListPagination, ClientListStart } from './ClientTabListTools';
import { useClientListNavigation } from './useClientListNavigation';

export interface ClienteArquivoItem {
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
  originType?: 'client' | 'project';
  projetoId?: string | null;
  projetoNome?: string | null;
}

interface DocumentoCategoria {
  id: string;
  nome: string;
  pastaNome: string;
  icone: string;
  cor: string;
  ordem: number;
  ativo: boolean;
}

const PREVIEWABLE_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const CLIENT_UPLOAD_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.kml', '.kmz', '.geojson', '.json'];
const DEFAULT_DOCUMENT_CATEGORIES = ['Contratos', 'Documentos', 'Mapas', 'Fotos', 'Orçamentos', 'Licenças', 'Outros'];

const documentCategoryStyles: Record<string, { icon: ElementType; className: string }> = {
  Contratos: { icon: FileText, className: 'geo-badge-base geo-badge-primary' },
  Documentos: { icon: FilePdf, className: 'geo-badge-base geo-badge-neutral' },
  Mapas: { icon: MapTrifold, className: 'geo-badge-base geo-badge-success' },
  Fotos: { icon: ImageSquare, className: 'geo-badge-base geo-badge-info' },
  Orçamentos: { icon: Receipt, className: 'geo-badge-base geo-badge-warning' },
  Licenças: { icon: Check, className: 'geo-badge-base geo-badge-warning' },
  Outros: { icon: FolderSimple, className: 'geo-badge-base geo-badge-neutral' }
};

const documentCategoryToneClasses: Record<string, string> = {
  indigo: 'geo-badge-base geo-badge-primary',
  zinc: 'geo-badge-base geo-badge-neutral',
  emerald: 'geo-badge-base geo-badge-success',
  sky: 'geo-badge-base geo-badge-info',
  violet: 'geo-badge-base geo-badge-primary',
  amber: 'geo-badge-base geo-badge-warning',
  rose: 'geo-badge-base geo-badge-danger',
  teal: 'geo-badge-base geo-badge-info'
};

const documentCategoryIconMap: Record<string, ElementType> = {
  FileText,
  FilePdf,
  MapTrifold,
  ImageSquare,
  Receipt,
  Check,
  FolderSimple,
  Files
};

const documentCategoryIconOptions = [
  { value: 'FolderSimple', label: 'Pasta', icon: FolderSimple },
  { value: 'FileText', label: 'Contrato', icon: FileText },
  { value: 'FilePdf', label: 'PDF', icon: FilePdf },
  { value: 'MapTrifold', label: 'Mapa', icon: MapTrifold },
  { value: 'ImageSquare', label: 'Imagem', icon: ImageSquare },
  { value: 'Receipt', label: 'Orçamento', icon: Receipt },
  { value: 'Check', label: 'Licença', icon: Check },
  { value: 'Files', label: 'Arquivos', icon: Files }
];

const documentCategoryToneOptions = [
  { value: 'teal', label: 'Verde água' },
  { value: 'emerald', label: 'Verde' },
  { value: 'indigo', label: 'Índigo' },
  { value: 'sky', label: 'Azul' },
  { value: 'violet', label: 'Violeta' },
  { value: 'amber', label: 'Âmbar' },
  { value: 'rose', label: 'Rosa' },
  { value: 'zinc', label: 'Neutro' }
];

const canPreviewFile = (file: ClienteArquivoItem) => PREVIEWABLE_EXTENSIONS.includes(file.extension.toLowerCase());

const getDocumentCategory = (file: ClienteArquivoItem) => file.category || 'Outros';

const getDocumentCategoryStyle = (category?: string, tone?: string, iconName?: string) => {
  const fallback = documentCategoryStyles[category || 'Outros'] || documentCategoryStyles.Outros;
  return {
    icon: documentCategoryIconMap[iconName || ''] || fallback.icon,
    className: (tone && documentCategoryToneClasses[tone]) || fallback.className
  };
};

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes == null || !Number.isFinite(sizeBytes)) return 'Tamanho não informado';
  if (sizeBytes >= 1024 * 1024) return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(sizeBytes / 1024 / 1024)} MB`;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(sizeBytes / 1024)} KB`;
};

interface ClienteDocumentosTabProps {
  clienteId: string;
  focusedDocumentId: string | null;
  initialSearchTerm: string;
  onPreviewFile: (file: ClienteArquivoItem) => void;
}

function FileAction({ label, accessibleLabel, children, onClick, className, disabled, busy }: { label: string; accessibleLabel: string; children: ReactNode; onClick: () => void; className: string; disabled?: boolean; busy?: boolean }) {
  const hintId = useId();
  return <button type="button" onClick={onClick} aria-label={accessibleLabel} aria-describedby={hintId} disabled={disabled} aria-busy={busy} className={'geo-focus-ring client-file-action min-h-11 min-w-11 rounded-lg border transition-[background-color,border-color,color,box-shadow] ' + className}>
    {children}<span className="client-file-action-label">{label}</span><span id={hintId} role="tooltip" className="client-file-action-hint">{label}</span>
  </button>;
}

const fileOrders = [
  { value: 'nome', label: 'Nome (A–Z)', compare: (a: ClienteArquivoItem, b: ClienteArquivoItem) => a.name.localeCompare(b.name, 'pt-BR') },
  { value: 'nome-desc', label: 'Nome (Z–A)', compare: (a: ClienteArquivoItem, b: ClienteArquivoItem) => b.name.localeCompare(a.name, 'pt-BR') },
  { value: 'data', label: 'Modificação mais recente', compare: (a: ClienteArquivoItem, b: ClienteArquivoItem) => compareClientDates(a.modifiedAt, b.modifiedAt, true) },
  { value: 'data-asc', label: 'Modificação mais antiga', compare: (a: ClienteArquivoItem, b: ClienteArquivoItem) => compareClientDates(a.modifiedAt, b.modifiedAt) },
  { value: 'tamanho', label: 'Tamanho crescente', compare: (a: ClienteArquivoItem, b: ClienteArquivoItem) => compareClientNumbers(a.sizeBytes, b.sizeBytes) },
  { value: 'tamanho-desc', label: 'Tamanho decrescente', compare: (a: ClienteArquivoItem, b: ClienteArquivoItem) => compareClientNumbers(a.sizeBytes, b.sizeBytes, true) }
];

export function ClienteDocumentosTab({
  clienteId,
  focusedDocumentId,
  initialSearchTerm,
  onPreviewFile
}: ClienteDocumentosTabProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const downloadFile = async (file: ClienteArquivoItem) => {
    if (downloading) return;
    setDownloading(file.path);
    try {
      const response = await apiFetch(`/api/arquivos/download?path=${encodeURIComponent(file.path)}`);
      if (!response.ok) throw new Error('Falha no download');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error('Não foi possível baixar o arquivo. Tente novamente.'); }
    finally { setDownloading(null); }
  };
  const [dragActive, setDragActive] = useState(false);
  const [fileParams, setFileParams] = useSearchParams();
  const documentCategoryFilter = fileParams.get('arquivosCategoria') || 'Todas';
  const originParam = fileParams.get('arquivosOrigem');
  const documentOriginFilter = originParam === 'client' || originParam === 'project' ? originParam : 'all';
  const documentProjectFilter = fileParams.get('arquivosProjeto') || 'all';
  const documentSearchTerm = fileParams.get('arquivo') ?? initialSearchTerm;
  const documentOrder = fileOrders.find(order => order.value === fileParams.get('arquivosOrdem')) || fileOrders[0];
  const updateFileFilters = useCallback((values: Record<string, string>, resetPage = true) => setFileParams(previous => {
    // Criteria changes do not schedule a focus or scroll change.

    const next = new URLSearchParams(previous);
    if (resetPage) next.set('arquivosPagina', '1');
    for (const [key, value] of Object.entries(values)) {
      if (value === '' || (key === 'arquivosCategoria' && value === 'Todas') || ((key === 'arquivosOrigem' || key === 'arquivosProjeto') && value === 'all')) next.delete(key);
      else next.set(key, value);
    }
    return next;
  }, { replace: true, preventScrollReset: true }), [setFileParams]);
  const setDocumentCategoryFilter = (value: string) => updateFileFilters({ arquivosCategoria: value });
  const setDocumentProjectFilter = (value: string) => updateFileFilters({ arquivosProjeto: value });
  const setDocumentSearchTerm = (value: string) => updateFileFilters({ arquivo: value });
  const clearDocumentFilters = () => updateFileFilters({ arquivo: '', arquivosCategoria: 'Todas', arquivosOrigem: 'all', arquivosProjeto: 'all' });
  const hasDocumentFilters = Boolean(documentSearchTerm || documentCategoryFilter !== 'Todas' || documentOriginFilter !== 'all' || documentProjectFilter !== 'all');
  const [documentUploadCategory, setDocumentUploadCategory] = useState('Documentos');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newDocumentCategoryName, setNewDocumentCategoryName] = useState('');
  const [newDocumentCategoryIcon, setNewDocumentCategoryIcon] = useState('FolderSimple');
  const [newDocumentCategoryTone, setNewDocumentCategoryTone] = useState('teal');
  const [editingDocumentCategoryId, setEditingDocumentCategoryId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'category'; item: DocumentoCategoria }
    | { type: 'file'; filePath: string; fileName: string }
    | null
  >(null);

  // 5. Fetch Client Files
  const { data: filesData = { files: [], path: '' }, isLoading: loadingFiles, isError: filesError, refetch: reloadFiles } = useQuery<{
    files: ClienteArquivoItem[];
    path: string;
  }>({
    queryKey: ['cliente-arquivos', clienteId],
    queryFn: async () => {
      const res = await apiFetch(`/api/arquivos/cliente/${clienteId}?scope=all`);
      if (res.ok) {
        const data = await res.json();
        return { files: data.files || [], path: data.path || '' };
      }
      throw new Error('Não foi possível carregar os arquivos.');
    },
    enabled: Boolean(clienteId)
  });

  const { data: documentCategoryOptions = [], isError: categoriesError, refetch: reloadCategories } = useQuery<DocumentoCategoria[]>({
    queryKey: ['documento-categorias'],
    queryFn: async () => {
      const res = await apiFetch('/api/arquivos/categorias');
      if (!res.ok) throw new Error('Não foi possível carregar as categorias.');
      return res.json();
    },
    enabled: true
  });

  const clientFiles = filesData.files;
  const clientFilesPasta = filesData.path;
  const documentCategoryByName = new Map(documentCategoryOptions.map((category) => [category.nome, category]));
  const existingDocumentCategories = Array.from(new Set(clientFiles.map(getDocumentCategory).filter(Boolean)));
  const backendDocumentCategories = documentCategoryOptions.length > 0
    ? documentCategoryOptions.map((category) => category.nome)
    : DEFAULT_DOCUMENT_CATEGORIES;
  const documentCategories = Array.from(new Set([...backendDocumentCategories, ...existingDocumentCategories]));
  const documentCategoryUsageCount = useMemo(() => {
    const counts = new Map<string, number>();
    clientFiles.forEach((file) => {
      const category = getDocumentCategory(file);
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return counts;
  }, [clientFiles]);
  const documentProjects = useMemo(() => Array.from(
    new Map(
      clientFiles
        .filter((file) => file.originType === 'project' && file.projetoId)
        .map((file) => [file.projetoId as string, file.projetoNome || 'Projeto vinculado'])
    )
  ), [clientFiles]);

  const createDocumentCategoryMutation = useMutation({
    mutationFn: async (payload: { nome: string; icone: string; cor: string }) => {
      const res = await apiFetch('/api/arquivos/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao salvar categoria');
      }
      return res.json() as Promise<DocumentoCategoria>;
    },
    onSuccess: (category) => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['documento-categorias'] });
      setDocumentUploadCategory(category.nome);
      setNewDocumentCategoryName('');
      setNewDocumentCategoryIcon('FolderSimple');
      setNewDocumentCategoryTone('teal');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar categoria: ${err.message}`);
    }
  });

  const updateDocumentCategoryMutation = useMutation({
    mutationFn: async (payload: { id: string; nome: string; icone: string; cor: string }) => {
      const res = await apiFetch(`/api/arquivos/categorias/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: payload.nome,
          icone: payload.icone,
          cor: payload.cor
        })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao atualizar categoria');
      }
      return res.json() as Promise<DocumentoCategoria>;
    },
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ['documento-categorias'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-arquivos', clienteId] });
      setDocumentUploadCategory(category.nome);
      setDocumentCategoryFilter(category.nome);
      setNewDocumentCategoryName('');
      setNewDocumentCategoryIcon('FolderSimple');
      setNewDocumentCategoryTone('teal');
      setEditingDocumentCategoryId(null);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar categoria: ${err.message}`);
    }
  });

  const deleteDocumentCategoryMutation = useMutation({
    mutationFn: async (category: DocumentoCategoria) => {
      const res = await apiFetch(`/api/arquivos/categorias/${category.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao apagar categoria');
      }
      return category;
    },
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ['documento-categorias'] });
      if (documentUploadCategory === category.nome) setDocumentUploadCategory('Documentos');
      if (documentCategoryFilter === category.nome) setDocumentCategoryFilter('Todas');
      if (editingDocumentCategoryId === category.id) {
        setNewDocumentCategoryName('');
        setNewDocumentCategoryIcon('FolderSimple');
        setNewDocumentCategoryTone('teal');
        setEditingDocumentCategoryId(null);
      }
    },
    onError: (err: Error) => {
      toast.error(`Erro ao apagar categoria: ${err.message}`);
    }
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, category }: { file: File; category: string }) => {
      const formData = new FormData();
      formData.append('clienteId', clienteId);
      formData.append('category', category);
      formData.append('file', file);

      const res = await apiFetch('/api/arquivos/upload/stream', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro desconhecido');
      }
      return res.json();
    },
    onSuccess: async () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['cliente-arquivos', clienteId] });
        queryClient.invalidateQueries({ queryKey: ['cliente-geo', clienteId] });
        queryClient.invalidateQueries({ queryKey: ['cliente-central-arquivos', clienteId] });
        queryClient.invalidateQueries({ queryKey: ['documento-categorias'] });
        queryClient.invalidateQueries({ queryKey: ['cliente-historico', clienteId] });
      }, 10);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao enviar arquivo: ${err.message}`);
    },
    onSettled: () => {
      setUploading(false);
    }
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const res = await apiFetch(`/api/arquivos?path=${encodeURIComponent(filePath)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Erro ao excluir o arquivo');
    },
    onSuccess: () => {
      setDeleteTarget(null);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['cliente-arquivos', clienteId] });
      }, 10);
    },
    onError: () => {
      toast.error('Erro ao excluir o arquivo.');
    }
  });

  // Actions
  const handleUpload = async (file: File) => {
    const extension = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;

    if (!CLIENT_UPLOAD_EXTENSIONS.includes(extension)) {
      toast.error('Envie PDF, imagem ou arquivo de mapa KML/KMZ/GeoJSON nesta área.');
      return;
    }

    setUploading(true);
    try {
      const uploadCategory = documentUploadCategory;

      if (!uploadCategory) {
        toast.error('Informe o nome da categoria antes de enviar o arquivo.');
        setUploading(false);
        return;
      }

      uploadFileMutation.mutate({ file, category: uploadCategory });
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

  const handleCreateDocumentCategory = (event: React.FormEvent) => {
    event.preventDefault();
    const categoryName = newDocumentCategoryName.trim();
    if (!categoryName) return;

    if (editingDocumentCategoryId) {
      updateDocumentCategoryMutation.mutate({
        id: editingDocumentCategoryId,
        nome: categoryName,
        icone: newDocumentCategoryIcon,
        cor: newDocumentCategoryTone
      });
      return;
    }

    createDocumentCategoryMutation.mutate({
      nome: categoryName,
      icone: newDocumentCategoryIcon,
      cor: newDocumentCategoryTone
    });
  };

  const handleEditDocumentCategory = (category: DocumentoCategoria) => {
    setEditingDocumentCategoryId(category.id);
    setNewDocumentCategoryName(category.nome);
    setNewDocumentCategoryIcon(category.icone || 'FolderSimple');
    setNewDocumentCategoryTone(category.cor || 'teal');
  };

  const handleCancelDocumentCategoryEdit = () => {
    setEditingDocumentCategoryId(null);
    setNewDocumentCategoryName('');
    setNewDocumentCategoryIcon('FolderSimple');
    setNewDocumentCategoryTone('teal');
  };

  const handleDeleteDocumentCategory = (category: DocumentoCategoria) => {
    const usageCount = documentCategoryUsageCount.get(category.nome) || 0;
    if (usageCount > 0) {
      toast.error('Essa categoria possui documentos vinculados. Para apagar, mova os documentos para outra categoria primeiro.');
      return;
    }

    setDeleteTarget({ type: 'category', item: category });
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

  const openingRef = useRef(false);
  const [opening, setOpening] = useState<{ type: 'file' | 'folder'; path: string } | null>(null);
  const [openingMessage, setOpeningMessage] = useState('');
  const requestLocalOpen = async (type: 'file' | 'folder', path: string) => {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening({ type, path });
    setOpeningMessage(type === 'file' ? 'Solicitando abertura do arquivo…' : 'Solicitando abertura da pasta…');
    try {
      const response = await apiFetch(`/api/arquivos/open-${type}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path })
      });
      if (!response.ok) throw new Error('Resposta de erro');
      const result = await response.json();
      if (result.success !== true || result.error) throw new Error('Solicitação recusada');
      setOpeningMessage('Solicitação encaminhada ao sistema. Aguarde o aplicativo ou a pasta.');
    } catch {
      const message = `Não foi possível solicitar a abertura ${type === 'file' ? 'do arquivo' : 'da pasta'}. Tente novamente. Se persistir, verifique se o serviço local está disponível.`;
      setOpeningMessage(message);
      toast.error(message);
    } finally {
      openingRef.current = false;
      setOpening(null);
    }
  };
  const handleOpenFile = (path: string) => requestLocalOpen('file', path);
  const handleOpenFolder = (path: string) => requestLocalOpen('folder', path);

  const originFilteredClientFiles = documentOriginFilter === 'all'
    ? clientFiles
    : clientFiles.filter((file) => (file.originType || 'client') === documentOriginFilter);
  const projectFilteredClientFiles = documentProjectFilter === 'all'
    ? originFilteredClientFiles
    : originFilteredClientFiles.filter((file) => file.projetoId === documentProjectFilter);
  const categoryFilteredClientFiles = documentCategoryFilter === 'Todas'
    ? projectFilteredClientFiles
    : projectFilteredClientFiles.filter((file) => getDocumentCategory(file) === documentCategoryFilter);
  const documentQuery = normalizeClientSearch(documentSearchTerm);
  const filteredClientFiles = documentQuery
    ? categoryFilteredClientFiles.filter((file) => [
      file.name,
      file.relativePath,
      file.category,
      file.extension,
      ...(file.tags || [])
    ].filter(Boolean).some(value => normalizeClientSearch(value || '').includes(documentQuery)))
    : categoryFilteredClientFiles;
  const sortedClientFiles = [...filteredClientFiles].sort(documentOrder.compare);
  const pageCount = Math.max(1, Math.ceil(sortedClientFiles.length / CLIENT_RECORD_PAGE_SIZE));
  const requestedPage = Number(fileParams.get('arquivosPagina')) || 1;
  const linkedIndex = focusedDocumentId ? sortedClientFiles.findIndex(file => file.documentId === focusedDocumentId) : -1;
  const linkedPage = linkedIndex >= 0 && fileParams.get('arquivosVinculo') !== focusedDocumentId ? Math.floor(linkedIndex / CLIENT_RECORD_PAGE_SIZE) + 1 : null;
  const page = linkedPage ?? Math.min(pageCount, Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const navigation = useClientListNavigation(page);
  const fileList = { page, pageCount, found: sortedClientFiles.length, resultsAnchor: navigation.resultsAnchor, setPage: (value: number) => {
    navigation.preparePage(value); updateFileFilters({ arquivosPagina: String(value) }, false);
  } };
  useEffect(() => {
    if (loadingFiles || filesError) return;
    if (linkedPage !== null) {
      updateFileFilters({ arquivosPagina: String(linkedPage), arquivosVinculo: focusedDocumentId || '' }, false);
    } else if (requestedPage !== page) {
      updateFileFilters({ arquivosPagina: String(page) }, false);
    }
  }, [loadingFiles, filesError, focusedDocumentId, linkedPage, requestedPage, page, updateFileFilters]);
  const visibleClientFiles = sortedClientFiles.slice((page - 1) * CLIENT_RECORD_PAGE_SIZE, page * CLIENT_RECORD_PAGE_SIZE);
  const linkedFile = focusedDocumentId ? clientFiles.find(file => file.documentId === focusedDocumentId) : undefined;
  const isGoogleDriveFolder = /google drive|meu drive|my drive|gdrive/i.test(clientFilesPasta);

  return (
    <>
          <div className="mb-4">{categoriesError && <ClientLoadState label="as categorias" error onRetry={() => void reloadCategories()} />}
            <SharedDataNotice preferenceKey="client-documents-shared-data">
              Esta central reúne documentos gerais do cliente e arquivos vinculados aos seus projetos. Os arquivos permanecem nas pastas originais; nenhuma cópia é criada.
            </SharedDataNotice>
          </div>
          <div className="flex flex-col rounded-lg border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
            {/* Top Header */}
            <div className="mb-6 flex flex-col gap-4 border-b border-zinc-100 pb-6 dark:border-zinc-800/80 ">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                    <FolderSimple weight="duotone" className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h2 className="break-words text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
                      Documentos do Cliente
                    </h2>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                      isGoogleDriveFolder
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}>
                      {isGoogleDriveFolder ? 'Drive Sync' : 'Pasta Local'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-300">
                    Arquivos organizados por categorias e pastas físicas
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-start gap-2.5 md:justify-end">
                <button
                  type="button"
                  onClick={() => setShowCategoryManager(true)}
                  className={secondarySmallActionButtonClass}
                >
                  <Tag className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                  Categorias de documentos
                </button>
                <button
                  type="button"
                  onClick={() => clientFilesPasta && handleOpenFolder(clientFilesPasta)}
                  disabled={!clientFilesPasta || Boolean(opening)}
                  aria-busy={opening?.type === 'folder'}
                  className={secondarySmallActionButtonClass}
                >
                  <FolderOpen className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                  {opening?.type === 'folder' ? 'Solicitando abertura…' : 'Abrir no Windows'}
                </button>
              </div>
            </div>

            {/* Janela Modal Estática e Limpa para Gerenciar Categorias */}
            <Modal
              isOpen={showCategoryManager}
              onClose={() => setShowCategoryManager(false)}
              title="Categorias de documentos"
              maxWidth="max-w-3xl"
            >
              <div className="space-y-6 pt-1">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-300">
                  Cada categoria representa uma etiqueta no sistema e uma subpasta física onde o documento será salvo.
                </p>

                <form onSubmit={handleCreateDocumentCategory} className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/80">
                  <label htmlFor="document-category-name" className="block text-xs font-bold uppercase tracking-wider text-zinc-500">
                    {editingDocumentCategoryId ? 'Editar Categoria / Subpasta' : 'Nova Categoria / Subpasta'}
                  </label>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(8rem,10rem)_minmax(8rem,10rem)_minmax(9rem,auto)] md:items-end">
                    <input
                      id="document-category-name"
                      value={newDocumentCategoryName}
                      onChange={(event) => setNewDocumentCategoryName(event.target.value)}
                      placeholder="Ex.: Certidões"
                      className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 outline-none transition-[border-color,box-shadow] duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    <FormSelect
                      aria-label="Ícone da categoria"
                      value={newDocumentCategoryIcon}
                      onChange={(event) => setNewDocumentCategoryIcon(event.target.value)}
                      className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-700 outline-none transition-[border-color,box-shadow] duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      {documentCategoryIconOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </FormSelect>
                    <FormSelect
                      aria-label="Cor da categoria"
                      value={newDocumentCategoryTone}
                      onChange={(event) => setNewDocumentCategoryTone(event.target.value)}
                      className="h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-700 outline-none transition-[border-color,box-shadow] duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      {documentCategoryToneOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </FormSelect>
                    <div className="flex gap-2 md:justify-end">
                      <button
                        type="submit"
                        disabled={!newDocumentCategoryName.trim() || createDocumentCategoryMutation.isPending || updateDocumentCategoryMutation.isPending}
                        className={cn(primarySmallActionButtonClass, 'h-10 min-h-10 w-full min-w-[6.5rem] shrink-0 whitespace-nowrap px-4 py-0 text-xs md:w-auto')}
                      >
                        {editingDocumentCategoryId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {editingDocumentCategoryId ? 'Salvar' : 'Criar'}
                      </button>
                      {editingDocumentCategoryId && (
                        <button
                          type="button"
                          onClick={handleCancelDocumentCategoryEdit}
                          className={cn(secondarySmallActionButtonClass, 'h-10 min-h-10 px-3 py-0 text-xs')}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </form>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 mb-2.5">Categorias Disponíveis</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {documentCategories.map((category) => {
                      const meta = documentCategoryByName.get(category);
                      const style = getDocumentCategoryStyle(category, meta?.cor, meta?.icone);
                      const CategoryIcon = style.icon;
                      const usageCount = documentCategoryUsageCount.get(category) || 0;
                      const canManage = Boolean(meta);
                      const isDeleting = deleteDocumentCategoryMutation.isPending && deleteDocumentCategoryMutation.variables?.id === meta?.id;

                      return (
                        <div key={category} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-white p-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${style.className}`}>
                              <CategoryIcon weight="duotone" className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="break-words text-xs font-bold text-zinc-800 dark:text-zinc-100">{category}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                                {usageCount} arquivo(s)
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => meta && handleEditDocumentCategory(meta)}
                              disabled={!canManage || updateDocumentCategoryMutation.isPending}
                              className="geo-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-[background-color,color,border-color] hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-indigo-400/30 dark:hover:bg-indigo-400/10 dark:hover:text-indigo-200"
                              aria-label={`Editar categoria ${category}`}
                            >
                              <PencilSimple className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => meta && handleDeleteDocumentCategory(meta)}
                              disabled={!canManage || usageCount > 0 || deleteDocumentCategoryMutation.isPending}
                              className="geo-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-[background-color,color,border-color] hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-rose-400/30 dark:hover:bg-rose-400/10 dark:hover:text-rose-200"
                              aria-label={`Apagar categoria ${category}`}
                              title={usageCount > 0 ? 'Categorias com arquivos vinculados não podem ser apagadas' : 'Apagar categoria'}
                            >
                              {isDeleting ? <Spinner className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button type="button" onClick={() => setShowCategoryManager(false)} className={secondarySmallActionButtonClass}>
                    Pronto
                  </button>
                </div>
              </div>
            </Modal>

            {/* Destaque de Upload de Anexos */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`mb-8 grid grid-cols-1 items-center gap-5 rounded-lg border p-6 transition-[background-color,border-color,box-shadow] duration-150 ${
                dragActive
                  ? 'border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-500/20 dark:border-indigo-400/70 dark:bg-indigo-500/12'
                  : 'border-dashed border-indigo-200/70 bg-indigo-50/35 hover:border-indigo-300/80 hover:bg-indigo-50/55 dark:border-indigo-400/20 dark:bg-zinc-800/55 dark:hover:border-indigo-400/35 dark:hover:bg-zinc-800/75'
              }`}
            >
              <input
                type="file"
                id="file-upload"
                ref={uploadInput}
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.kml,.kmz,.geojson,.json"
                onChange={handleFileUploadChange}
              />
              <button type="button" disabled={uploading} aria-busy={uploading} onClick={() => uploadInput.current?.click()} className="geo-focus-ring group flex min-h-11 min-w-0 items-center gap-4 rounded text-left disabled:opacity-50">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-indigo-500 shadow-sm transition-transform duration-150 group-hover:scale-105 dark:border-zinc-800 dark:bg-zinc-900 dark:text-indigo-300">
                  <CloudArrowUp weight="duotone" className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {uploading ? 'Enviando arquivo…' : 'Anexar novo arquivo ao cliente'}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-300 break-words">
                    Selecione ou arraste um PDF, imagem ou mapa. O arquivo será salvo na categoria escolhida.
                  </span>
                </div>
              </button>

              <div className="ml-auto flex w-full flex-col items-start gap-2.5 border-t border-zinc-200 pt-4 dark:border-zinc-800  ">
                <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-zinc-500">Categoria e pasta destino:</span>
                <FormSelect
                  aria-label="Pasta destino do upload"
                  value={documentUploadCategory}
                  onChange={(event) => setDocumentUploadCategory(event.target.value)}
                  className="h-10 min-w-[180px] rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-800 outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {documentCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </FormSelect>
              </div>
            </div>

            {/* Barra de Busca e Filtros Inteligentes (Sem Duplicidade Visual) */}
            <div className="mb-6 rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800/80 dark:bg-zinc-950/30">
              <label htmlFor="document-search" className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">Buscar arquivos</label>
              <div className="relative w-full">
                  <FileText className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <input
                    id="document-search" name="arquivo" type="search" autoComplete="off" aria-describedby="document-search-hint"
                    value={documentSearchTerm}
                    onChange={(event) => setDocumentSearchTerm(event.target.value)}
                    placeholder="Ex.: contrato, .pdf ou matrícula"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-16 text-xs font-semibold text-zinc-800 outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  {documentSearchTerm && (
                    <button type="button" onClick={() => setDocumentSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-600 transition-colors duration-150 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:hover:text-zinc-200">Limpar</button>
                  )}
              </div>

              <p id="document-search-hint" className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">Nome, caminho relativo, categoria, extensão ou etiquetas.</p>
              <div className="mt-3">
                <label htmlFor="document-order" className="mb-1 block text-xs font-semibold text-zinc-700 dark:text-zinc-200">Ordenar arquivos</label>
                <FormSelect id="document-order" name="arquivosOrdem" value={documentOrder.value} onChange={event => updateFileFilters({ arquivosOrdem: event.target.value })} className="geo-focus-ring min-h-11 w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  {fileOrders.map(order => <option key={order.value} value={order.value}>{order.label}</option>)}
                </FormSelect>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">A data é a última modificação do arquivo no disco. Datas e tamanhos não informados ficam ao final.</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filtrar documentos por origem">
                <span className="mr-1 text-[10px] font-extrabold uppercase tracking-widest text-zinc-600">Origem:</span>
                {([
                  ['all', 'Todos'],
                  ['client', 'Documentos gerais'],
                  ['project', 'Por projeto']
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={documentOriginFilter === value}
                    onClick={() => {
                      updateFileFilters({ arquivosOrigem: value, ...(value === 'client' ? { arquivosProjeto: 'all' } : {}) });
                    }}
                    className={cn(
                      'geo-focus-ring rounded-lg border px-2.5 py-1 text-xs font-semibold transition-[background-color,border-color,color]',
                      documentOriginFilter === value
                        ? 'border-sky-400 bg-sky-50 text-sky-800 dark:bg-sky-400/10 dark:text-sky-200'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                    )}
                  >
                    {label}
                  </button>
                ))}
                {documentProjects.length > 0 && documentOriginFilter !== 'client' && (
                  <div className="ml-auto flex min-w-[14rem] items-center gap-2">
                    <label htmlFor="document-project-filter" className="shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-zinc-600">
                      Projeto:
                    </label>
                    <FormSelect
                      id="document-project-filter"
                      name="documentProjectFilter"
                      value={documentProjectFilter}
                      onChange={(event) => setDocumentProjectFilter(event.target.value)}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-700 outline-none transition-[border-color,box-shadow] focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      <option value="all">Todos os projetos</option>
                      {documentProjects.map(([projectId, projectName]) => (
                        <option key={projectId} value={projectId}>{projectName}</option>
                      ))}
                    </FormSelect>
                  </div>
                )}
              </div>

              {/* Filtro por Pasta / Categoria (Faixa Inferior Organizada) */}
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-zinc-600">Filtrar categoria:</span>
                {['Todas', ...documentCategories].map((category) => {
                  const categoryMeta = documentCategoryByName.get(category);
                  const categoryStyle = getDocumentCategoryStyle(
                    category === 'Todas' ? undefined : category,
                    categoryMeta?.cor,
                    categoryMeta?.icone
                  );
                  const CategoryIcon = category === 'Todas' ? FolderSimple : categoryStyle.icon;
                  const isSelected = documentCategoryFilter === category;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setDocumentCategoryFilter(category)}
                      aria-pressed={isSelected}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-[background-color,border-color,color,box-shadow] duration-150 ${
                        isSelected
                          ? 'border-indigo-400/60 bg-indigo-50/80 text-indigo-800 shadow-sm ring-1 ring-indigo-500/10 dark:bg-indigo-500/[0.12] dark:text-indigo-100'
                          : `${categoryStyle.className} border-transparent bg-opacity-35 hover:border-zinc-300/70 dark:hover:border-zinc-700`
                      }`}
                    >
                      <CategoryIcon weight="duotone" className="h-3 w-3" />
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>

            <p role="status" aria-live="polite" aria-atomic="true" className="mb-3 text-sm text-zinc-700 dark:text-zinc-200">{openingMessage}</p>
            {focusedDocumentId && !loadingFiles && !filesError && linkedIndex < 0 && <div role="status" className="mb-3 rounded-lg border border-zinc-300 p-3 text-sm dark:border-zinc-700">
              <p>{linkedFile ? 'O documento deste vínculo está oculto pelos critérios atuais. Seus filtros foram preservados.' : 'O documento deste vínculo não está disponível nesta coleção. Atualize a lista ou verifique o vínculo.'}</p>
              {linkedFile && <button type="button" className={secondarySmallActionButtonClass + ' mt-2'} onClick={() => updateFileFilters({ arquivo: '', arquivosCategoria: 'Todas', arquivosOrigem: 'all', arquivosProjeto: 'all', arquivosVinculo: '' })}>Mostrar documento e limpar filtros</button>}
            </div>}
            {/* Files List */}
            {!loadingFiles && !filesError && <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p role="status" aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-300">{filteredClientFiles.length} de {clientFiles.length} {clientFiles.length === 1 ? 'documento' : 'documentos'}{hasDocumentFilters ? ' neste filtro' : ''}</p>{hasDocumentFilters && <button type="button" onClick={clearDocumentFilters} className={secondarySmallActionButtonClass}>Limpar filtros</button>}</div>}
            {!loadingFiles && !filesError && <ClientListStart page={page} pageCount={pageCount} found={fileList.found} resultsAnchor={navigation.resultsAnchor} noun="documentos" />}
            <div className="space-y-3">
              {filesError ? <ClientLoadState label="os arquivos" error onRetry={() => { void queryClient.invalidateQueries({ queryKey: ['cliente-central-arquivos', clienteId] }); void reloadFiles(); }} /> : loadingFiles ? (
                <ClientLoadState label="os arquivos" />
              ) : filteredClientFiles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-100 bg-zinc-50/20 py-12 text-center dark:border-zinc-800">
                  <p className="text-zinc-500 dark:text-zinc-300 text-sm font-medium">
                    {clientFiles.length === 0 ? 'Nenhum arquivo vinculado ao cliente ou aos seus projetos.' : 'Nenhum arquivo encontrado neste filtro.'}
                  </p>
                </div>
              ) : (
                visibleClientFiles.map((file) => {
                  let FileIcon = FileDashed;
                  let iconColor = "text-zinc-600";
                  let bgColor = "bg-zinc-50 dark:bg-zinc-950";

                  if (file.extension === '.pdf') { FileIcon = FilePdf; iconColor = "text-red-500"; bgColor = "bg-red-50"; }
                  if (IMAGE_EXTENSIONS.includes(file.extension)) { FileIcon = ImageSquare; iconColor = "text-sky-500"; bgColor = "bg-sky-50"; }
                  if (file.extension === '.docx') { FileIcon = FileDoc; iconColor = "text-blue-500"; bgColor = "bg-blue-50"; }
                  if (file.extension === '.csv' || file.extension === '.xlsx') { FileIcon = FileText; iconColor = "text-emerald-500"; bgColor = "bg-emerald-50"; }
                  if (file.extension === '.gpkg' || file.extension === '.shp' || file.extension === '.kml' || file.extension === '.kmz' || file.extension === '.geojson') { FileIcon = Files; iconColor = "text-indigo-500"; bgColor = "bg-indigo-50"; }
                  if (file.extension === '.dwg') { FileIcon = Files; iconColor = "text-amber-500"; bgColor = "bg-amber-50"; }
                  const category = getDocumentCategory(file);
                  const categoryStyle = getDocumentCategoryStyle(category, file.categoryTone, file.categoryIcon);
                  const CategoryIcon = categoryStyle.icon;
                  const isFocusedDocument = Boolean(focusedDocumentId && file.documentId === focusedDocumentId);

                  return (
                    <motion.div 
                      data-client-file-id={file.documentId || file.path}
                      key={file.path || file.name}
                      initial={false}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0 }}
                      className={`client-file-row group gap-3 rounded-lg border p-3 transition-[border-color,box-shadow,background-color] duration-150 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${
                        isFocusedDocument
                          ? 'border-indigo-300 bg-indigo-50/80 ring-2 ring-indigo-400/20 dark:border-indigo-500/40 dark:bg-indigo-500/10'
                          : 'border-zinc-100 bg-white'
                      }`}
                    >
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${bgColor}`}>
                        <FileIcon weight="duotone" className={`h-5 w-5 ${iconColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="max-w-full break-words text-sm font-semibold text-zinc-950 dark:text-white" title={file.name}>{file.name}</p>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 ${categoryStyle.className}`}>
                            <CategoryIcon weight="duotone" className="h-3 w-3" />
                            {category}
                          </span>
                        </div>
                        <p className="mt-0.5 break-words text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-300" title={file.relativePath || file.path}>
                          {formatFileSize(file.sizeBytes)} • {file.modifiedAt && Number.isFinite(Date.parse(file.modifiedAt)) ? `Modificado em ${new Intl.DateTimeFormat('pt-BR').format(new Date(file.modifiedAt))}` : 'Data de modificação não informada'}
                          {file.relativePath ? ` • ${file.relativePath}` : ''}
                        </p>
                        <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          {file.originType === 'project' && file.projetoId ? (
                            <>Projeto: <Link to={appLinks.projectSection(file.projetoId, 'documentos')} className="geo-focus-ring rounded font-semibold text-indigo-700 underline underline-offset-2 dark:text-indigo-300">{file.projetoNome || 'Projeto vinculado'}</Link></>
                          ) : 'Documento geral do cliente'}
                        </p>
                      </div>
                      <div className="client-file-actions">
                        <FileAction label={canPreviewFile(file) ? 'Visualizar' : 'Abrir'} accessibleLabel={`${canPreviewFile(file) ? 'Visualizar' : 'Abrir'} arquivo ${file.name}`} onClick={()=>canPreviewFile(file) ? onPreviewFile(file) : void handleOpenFile(file.path)} className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"><Eye aria-hidden="true" weight="bold" className="h-4 w-4 shrink-0" /></FileAction>
                        <FileAction disabled={Boolean(opening)} busy={opening?.type === 'file' && opening.path === file.path} label={opening?.type === 'file' && opening.path === file.path ? 'Solicitando…' : 'Abrir fora'} accessibleLabel={`Abrir arquivo ${file.name} no aplicativo padrão`} onClick={()=>void handleOpenFile(file.path)} className="bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800"><ArrowSquareOut aria-hidden="true" weight="bold" className="h-4 w-4 shrink-0" /></FileAction>
                        <FileAction label={downloading===file.path ? 'Baixando…' : 'Baixar'} accessibleLabel={`Baixar arquivo ${file.name}`} onClick={()=>void downloadFile(file)} disabled={Boolean(downloading)} busy={downloading===file.path} className="bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"><DownloadSimple aria-hidden="true" weight="bold" className="h-4 w-4 shrink-0" /></FileAction>
                        <FileAction label="Excluir" accessibleLabel={`Excluir arquivo ${file.name}`} onClick={()=>handleFileDelete(file.path,file.name)} className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"><Trash aria-hidden="true" weight="bold" className="h-4 w-4 shrink-0" /></FileAction>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
            {!loadingFiles && !filesError && <ClientListPagination list={fileList} noun="documentos" />}
          </div>
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === 'category') deleteDocumentCategoryMutation.mutate(deleteTarget.item);
          if (deleteTarget?.type === 'file') deleteFileMutation.mutate(deleteTarget.filePath);
        }}
        title={deleteTarget?.type === 'category'
          ? `Excluir categoria “${deleteTarget.item.nome}”?`
          : `Excluir arquivo${deleteTarget?.fileName ? ` “${deleteTarget.fileName}”` : ''}?`}
        description={deleteTarget?.type === 'category'
          ? 'A categoria será removida das opções documentais. Esta exclusão só é permitida quando nenhum arquivo está vinculado a ela. Esta ação não pode ser desfeita.'
          : 'O arquivo será removido permanentemente do disco local e deixará de aparecer nos documentos do cliente. Esta ação não pode ser desfeita.'}
        confirmText={deleteTarget?.type === 'category' ? 'Excluir categoria' : 'Excluir arquivo'}
        loading={deleteDocumentCategoryMutation.isPending || deleteFileMutation.isPending}
      />
    </>
  );
}
