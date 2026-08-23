import { useEffect, useMemo, useState, type ElementType } from 'react';
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
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Modal } from '../../../components/Modal';
import { apiFetch, getDownloadUrl } from '../../../services/apiClient';
import { primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../../../utils/actionStyles';
import { cn } from '../../../utils/cn';

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
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(sizeBytes / 1024).toFixed(1)} KB`;
};

interface ClienteDocumentosTabProps {
  clienteId: string;
  focusedDocumentId: string | null;
  initialSearchTerm: string;
  onPreviewFile: (file: ClienteArquivoItem) => void;
}

export function ClienteDocumentosTab({
  clienteId,
  focusedDocumentId,
  initialSearchTerm,
  onPreviewFile
}: ClienteDocumentosTabProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [documentCategoryFilter, setDocumentCategoryFilter] = useState('Todas');
  const [documentSearchTerm, setDocumentSearchTerm] = useState('');
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

  useEffect(() => {
    if (!initialSearchTerm) return;
    const syncSearch = window.setTimeout(() => setDocumentSearchTerm(initialSearchTerm), 0);
    return () => window.clearTimeout(syncSearch);
  }, [initialSearchTerm]);

  // 5. Fetch Client Files
  const { data: filesData = { files: [], path: '' }, isLoading: loadingFiles } = useQuery<{
    files: ClienteArquivoItem[];
    path: string;
  }>({
    queryKey: ['cliente-arquivos', clienteId],
    queryFn: async () => {
      const res = await apiFetch(`/api/arquivos/cliente/${clienteId}`);
      if (res.ok) {
        const data = await res.json();
        return { files: data.files || [], path: data.path || '' };
      }
      return { files: [], path: '' };
    },
    enabled: Boolean(clienteId)
  });

  const { data: documentCategoryOptions = [] } = useQuery<DocumentoCategoria[]>({
    queryKey: ['documento-categorias'],
    queryFn: async () => {
      const res = await apiFetch('/api/arquivos/categorias');
      if (!res.ok) return [];
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

  const handleOpenFolder = async (folderPath: string) => {
    const res = await apiFetch('/api/arquivos/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath })
    });

    if (!res.ok) {
      toast.error('Não foi possível abrir a pasta local.');
    }
  };

  const categoryFilteredClientFiles = documentCategoryFilter === 'Todas'
    ? clientFiles
    : clientFiles.filter((file) => getDocumentCategory(file) === documentCategoryFilter);
  const documentQuery = documentSearchTerm.trim().toLowerCase();
  const filteredClientFiles = documentQuery
    ? categoryFilteredClientFiles.filter((file) => [
      file.name,
      file.relativePath,
      file.category,
      file.extension,
      ...(file.tags || [])
    ].filter(Boolean).join(' ').toLowerCase().includes(documentQuery))
    : categoryFilteredClientFiles;
  const isGoogleDriveFolder = /google drive|meu drive|my drive|gdrive/i.test(clientFilesPasta);

  return (
    <>
          <div className="flex flex-col rounded-lg border border-zinc-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
            {/* Top Header */}
            <div className="mb-6 flex flex-col gap-4 border-b border-zinc-100 pb-6 dark:border-zinc-800/80 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                    <FolderSimple weight="duotone" className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <h3 className="truncate text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
                      Documentos do Cliente
                    </h3>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                      isGoogleDriveFolder
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}>
                      {isGoogleDriveFolder ? 'Drive Sync' : 'Pasta Local'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
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
                  Categorias de Pastas
                </button>
                <button
                  type="button"
                  onClick={() => clientFilesPasta && handleOpenFolder(clientFilesPasta)}
                  disabled={!clientFilesPasta}
                  className={secondarySmallActionButtonClass}
                >
                  <FolderOpen className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                  Abrir no Windows
                </button>
              </div>
            </div>

            {/* Janela Modal Estática e Limpa para Gerenciar Categorias */}
            <Modal
              isOpen={showCategoryManager}
              onClose={() => setShowCategoryManager(false)}
              title="Categorias de Documentos"
              maxWidth="max-w-3xl"
            >
              <div className="space-y-6 pt-1">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">Categorias Disponíveis</h4>
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
                              <p className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">{category}</p>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
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
              className={`mb-8 grid grid-cols-1 items-center gap-5 rounded-lg border p-6 transition-[background-color,border-color,box-shadow] duration-150 lg:grid-cols-[minmax(0,1fr)_auto] ${
                dragActive
                  ? 'border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-500/20 dark:border-indigo-400/70 dark:bg-indigo-500/12'
                  : 'border-dashed border-indigo-200/70 bg-indigo-50/35 hover:border-indigo-300/80 hover:bg-indigo-50/55 dark:border-indigo-400/20 dark:bg-zinc-800/55 dark:hover:border-indigo-400/35 dark:hover:bg-zinc-800/75'
              }`}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.kml,.kmz,.geojson,.json"
                onChange={handleFileUploadChange}
              />
              <label htmlFor="file-upload" className="group flex min-w-0 cursor-pointer items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-indigo-500 shadow-sm transition-transform duration-150 group-hover:scale-105 dark:border-zinc-800 dark:bg-zinc-900 dark:text-indigo-300">
                  <CloudArrowUp weight="duotone" className="h-7 w-7" />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {uploading ? 'Enviando arquivo…' : 'Anexar novo arquivo ao cliente'}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
                    Clique ou arraste PDF, Imagens, KML/KMZ. Será salvo na subpasta escolhida ao lado.
                  </span>
                </div>
              </label>

              <div className="ml-auto flex w-full flex-col items-start gap-2.5 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between lg:w-auto lg:justify-end lg:border-t-0 lg:pt-0">
                <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-zinc-500">Pasta destino:</span>
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
              <div className="relative w-full">
                  <FileText className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    aria-label="Pesquisar documento pelo nome"
                    value={documentSearchTerm}
                    onChange={(event) => setDocumentSearchTerm(event.target.value)}
                    placeholder="Pesquisar documento pelo nome…"
                    className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-16 text-xs font-semibold text-zinc-800 outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  {documentSearchTerm && (
                    <button type="button" onClick={() => setDocumentSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 transition-colors duration-150 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 dark:hover:text-zinc-200">Limpar</button>
                  )}
              </div>

              {/* Filtro por Pasta / Categoria (Faixa Inferior Organizada) */}
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">Filtrar Pasta:</span>
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

            {/* Files List */}
            <div className="space-y-3">
              {loadingFiles ? (
                <div className="py-8 flex justify-center">
                  <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-6 h-6 rounded-full border-2 border-zinc-200 border-t-indigo-600 animate-spin dark:border-zinc-800" />
                </div>
              ) : filteredClientFiles.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-100 bg-zinc-50/20 py-12 text-center dark:border-zinc-800">
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">
                    {clientFiles.length === 0 ? 'Nenhum arquivo nesta pasta local ainda.' : 'Nenhum arquivo encontrado neste filtro.'}
                  </p>
                </div>
              ) : (
                filteredClientFiles.map((file, idx: number) => {
                  let FileIcon = FileDashed;
                  let iconColor = "text-zinc-400";
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
                      key={file.path || file.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`group flex items-center gap-3 rounded-lg border p-3 transition-[border-color,box-shadow,background-color] duration-150 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${
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
                          <p className="max-w-full truncate text-sm font-semibold text-zinc-950 dark:text-white" title={file.name}>{file.name}</p>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ring-1 ${categoryStyle.className}`}>
                            <CategoryIcon weight="duotone" className="h-3 w-3" />
                            {category}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-400" title={file.relativePath || file.path}>
                          {formatFileSize(file.sizeBytes)} • {new Date(file.modifiedAt).toLocaleDateString('pt-BR')}
                          {file.relativePath ? ` • ${file.relativePath}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPreviewFile(file)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-300 transition-[background-color,border-color,color,box-shadow,transform] shadow-sm"
                          title={canPreviewFile(file) ? 'Visualizar no GeoGestor' : 'Abrir arquivo'}
                        >
                          <Eye weight="bold" className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenFile(file.path)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 border border-violet-200/80 dark:border-violet-800/60 text-violet-600 dark:text-violet-300 transition-[background-color,border-color,color,box-shadow,transform] shadow-sm"
                          title="Abrir no aplicativo padrão"
                        >
                          <ArrowSquareOut weight="bold" className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => window.open(getDownloadUrl(file.path))}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 border border-sky-200/80 dark:border-sky-800/60 text-sky-600 dark:text-sky-300 transition-[background-color,border-color,color,box-shadow,transform] shadow-sm"
                          title="Baixar Arquivo"
                        >
                          <DownloadSimple weight="bold" className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFileDelete(file.path, file.name)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-950/40 hover:bg-red-100 border border-red-200/80 dark:border-red-800/60 text-red-600 dark:text-red-400 transition-[background-color,border-color,color,box-shadow,transform] shadow-sm"
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
