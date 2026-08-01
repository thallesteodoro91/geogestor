import { toast } from 'sonner';
import { DatePickerField, FormSelect, TimePickerField } from '../../components/Form';
import { useCallback, useEffect, useRef, useState, useMemo, type ElementType } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { MapBaseNotice } from '../../components/maps/MapBaseNotice';
import { createBaseTileLayer } from '../../utils/mapTiles';
import { motion, AnimatePresence } from 'framer-motion';
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
  CloudArrowUp, 
  DownloadSimple, 
  FilePdf, 
  FileDoc, 
  FileText, 
  Receipt,
  FileDashed, 
  Files, 
  Plus, 
  Check, 
  Calendar,
  FolderOpen,
  ListChecks,
  MapTrifold,
  Eye,
  ImageSquare,
  X,
  ArrowSquareOut,
  Warning,
  Buildings,
  Handshake,
  CurrencyDollar,
  CalendarCheck,
  Briefcase,
  UploadSimple,
  Spinner,
  Minus,
  PencilSimple,
  CheckCircle,
  Leaf
} from '@phosphor-icons/react';
import { ClienteCentralControle } from './ClienteCentralControle';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getClientCategoryTagClass,
  getClientOriginTagClass,
  getClientStatusTagClass,
  getClientServicoTagClass
} from '../../utils/clientTags';
import { getClientCategoryIcon, getClientCategoryColorClass } from '../../utils/clientIcons';
import { formatCnpj, formatCpf, formatPhoneBR } from '../../utils/formatters';
import { apiClient, apiFetch, getDownloadUrl, getPreviewUrl } from '../../services/apiClient';
import { primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../../utils/actionStyles';
import { cn } from '../../utils/cn';
import { geoGreenIconClass, geoGreenLabelClass, geoGreenSurfaceClass, geoGreenValueClass, geoTabButtonClass, geoTabIconClass, geoTabListClass, type GeoTone } from '../../utils/geoTheme';
import { getBudgetStatusLabel, isApprovedBudgetStatus } from '../../utils/budgetStatus';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface ClienteGeoFileItem {
  fileName: string;
  type: string;
  data: object;
}

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

interface DocumentoCategoria {
  id: string;
  nome: string;
  pastaNome: string;
  icone: string;
  cor: string;
  ordem: number;
  ativo: boolean;
}

type ClienteDetalhesTab = 'visao-geral' | 'servicos' | 'ambiental' | 'orcamentos' | 'financeiro' | 'arquivos';
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

const CLIENT_DETAIL_TABS: ClienteDetalhesTab[] = ['visao-geral', 'servicos', 'ambiental', 'orcamentos', 'financeiro', 'arquivos'];
const CLIENT_DETAIL_TAB_TONES: Record<ClienteDetalhesTab, GeoTone> = {
  'visao-geral': 'system',
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
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const MAP_EXTENSIONS = ['.gpkg', '.shp', '.kml', '.kmz', '.geojson', '.json'];
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

const EARTH_RADIUS_METERS = 6378137;

function ringAreaM2(ring: number[][]) {
  if (!Array.isArray(ring) || ring.length < 4) return 0;

  let area = 0;

  for (let i = 0; i < ring.length; i += 1) {
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    if (!current || !next || current.length < 2 || next.length < 2) continue;

    const lon1 = (Number(current[0]) * Math.PI) / 180;
    const lat1 = (Number(current[1]) * Math.PI) / 180;
    const lon2 = (Number(next[0]) * Math.PI) / 180;
    const lat2 = (Number(next[1]) * Math.PI) / 180;

    if ([lon1, lat1, lon2, lat2].some(Number.isNaN)) continue;
    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  return Math.abs((area * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2);
}

interface GeometryData {
  type: string;
  coordinates?: unknown;
  geometries?: GeometryData[];
  geometry?: GeometryData;
}

interface GeoJsonFeature {
  type: string;
  geometry?: GeometryData;
}

function geometryAreaM2(geometry: GeometryData | null | undefined): number {
  if (!geometry || typeof geometry !== 'object') return 0;

  if (geometry.type === 'Polygon') {
    const rings = (Array.isArray(geometry.coordinates) ? geometry.coordinates : []) as number[][][];
    return rings.reduce((acc: number, ring: number[][], index: number) => {
      const ringArea = ringAreaM2(ring);
      return index === 0 ? acc + ringArea : acc - ringArea;
    }, 0);
  }

  if (geometry.type === 'MultiPolygon') {
    const coords = (Array.isArray(geometry.coordinates) ? geometry.coordinates : []) as number[][][][];
    return coords.reduce(
      (acc: number, polygon: number[][][]) => acc + geometryAreaM2({ type: 'Polygon', coordinates: polygon }),
      0
    );
  }

  if (geometry.type === 'GeometryCollection') {
    return (Array.isArray(geometry.geometries) ? geometry.geometries : []).reduce(
      (acc: number, item: GeometryData) => acc + geometryAreaM2(item),
      0
    );
  }

  return 0;
}

function featureCollectionAreaM2(input: unknown): number {
  if (!input || typeof input !== 'object') return 0;

  const data = input as {
    type?: string;
    features?: GeoJsonFeature[];
    geometry?: GeometryData;
  };

  if (data.type === 'FeatureCollection') {
    return (Array.isArray(data.features) ? data.features : []).reduce(
      (acc: number, feature) => acc + geometryAreaM2(feature.geometry),
      0
    );
  }

  if (data.type === 'Feature') {
    return geometryAreaM2(data.geometry);
  }

  return geometryAreaM2(data as GeometryData);
}

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

function ClienteMapaCard({ clienteId, className = '' }: { clienteId: string; className?: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geojsonLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const queryClient = useQueryClient();
  
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [baseMapUnavailable, setBaseMapUnavailable] = useState(() => !navigator.onLine);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadBaseMap = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);
    setBaseMapUnavailable(!navigator.onLine);
    baseTileLayerRef.current = createBaseTileLayer(
      map,
      () => setBaseMapUnavailable(true),
      () => setBaseMapUnavailable(false)
    );
  }, []);

  useEffect(() => {
    const offline = () => setBaseMapUnavailable(true);
    const online = () => reloadBaseMap();
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, [reloadBaseMap]);

  const { data: geoFiles = [], isLoading } = useQuery<ClienteGeoFileItem[]>({
    queryKey: ['cliente-geo', clienteId],
    queryFn: async () => {
      const res = await apiFetch(`/api/arquivos/cliente/${clienteId}/geo`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.geoFeatures || [];
    },
    enabled: !!clienteId
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('clienteId', clienteId);
      formData.append('category', 'Mapas');
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
    onSuccess: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['cliente-arquivos', clienteId] });
        queryClient.invalidateQueries({ queryKey: ['cliente-geo', clienteId] });
        queryClient.invalidateQueries({ queryKey: ['cliente-central-arquivos', clienteId] });
        queryClient.invalidateQueries({ queryKey: ['cliente-historico', clienteId] });
      }, 10);
    },
    onError: (err: Error) => {
      toast.error(`Erro ao enviar mapa: ${err.message}`);
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });

  const handleFile = (file: File) => {
    const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
    if (!MAP_EXTENSIONS.includes(ext)) {
      toast.error('Envie apenas arquivos de mapa (KML, KMZ, GeoJSON).');
      return;
    }
    setIsUploading(true);
    uploadFileMutation.mutate(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    if (mapContainerRef.current && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([-15.793889, -47.882778], 4);

      baseTileLayerRef.current = createBaseTileLayer(
        map,
        () => setBaseMapUnavailable(true),
        () => setBaseMapUnavailable(false)
      );

      const layerGroup = L.layerGroup().addTo(map);
      geojsonLayerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;

      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);

      setTimeout(() => map.invalidateSize(), 0);
    }

    return () => {
      resizeObserver?.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        baseTileLayerRef.current = null;
      }
    };
  }, [reloadBaseMap]);

  useEffect(() => {
    if (!mapInstanceRef.current || !geojsonLayerGroupRef.current) return;

    geojsonLayerGroupRef.current.clearLayers();

    const bounds = L.latLngBounds([]);
    let hasData = false;

    geoFiles.forEach((feature) => {
      try {
        if (!feature || !feature.data) return;
        const layer = L.geoJSON(feature.data as Parameters<typeof L.geoJSON>[0], {
          style: {
            color: '#8b5cf6',
            weight: 3,
            opacity: 0.95,
            fillColor: '#a78bfa',
            fillOpacity: 0.22
          },
          pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
            radius: 6,
            color: '#8b5cf6',
            weight: 2,
            fillColor: '#c4b5fd',
            fillOpacity: 0.9
          }),
          onEachFeature: (item, layerItem) => {
            const name = item.properties?.name || feature.fileName;
            layerItem.bindPopup(`<strong>${name}</strong>`);
          }
        });

        geojsonLayerGroupRef.current?.addLayer(layer);
        if (layer.getBounds && typeof layer.getBounds === 'function') {
          const lBounds = layer.getBounds();
          if (lBounds && lBounds.isValid && lBounds.isValid()) {
            bounds.extend(lBounds);
          }
        }
        hasData = true;
      } catch (err) {
        console.warn('Erro ao carregar GeoJSON no mapa:', feature?.fileName, err);
      }
    });

    if (hasData && bounds.isValid()) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [42, 42] });
    } else {
      mapInstanceRef.current.setView([-15.793889, -47.882778], 4);
    }

    setTimeout(() => mapInstanceRef.current?.invalidateSize(), 0);
  }, [geoFiles]);

  return (
    <div className={`geo-card flex h-full flex-col overflow-hidden ${className}`}>
      <div className="flex flex-col gap-3 border-b border-brand-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-indigo-50 text-brand-indigo-700 dark:bg-brand-indigo-400/12 dark:text-brand-indigo-100">
            <MapTrifold weight="duotone" className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Mapa do Cliente</h3>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Camadas KML, KMZ e GeoJSON enviadas para este cliente.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="geo-badge-base geo-badge-neutral px-3 py-1 text-xs uppercase tracking-wider">
            {isLoading ? 'Carregando' : `${geoFiles.length} camada${geoFiles.length === 1 ? '' : 's'}`}
          </span>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".kml,.kmz,.geojson,.json"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={cn(secondarySmallActionButtonClass, 'min-h-8 px-3 py-1.5')}
          >
            {isUploading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <Spinner className="h-3.5 w-3.5" />
              </motion.div>
            ) : (
              <UploadSimple className="h-3.5 w-3.5" />
            )}
            {isUploading ? 'Enviando...' : 'Upload'}
          </button>
        </div>
      </div>

      <div 
        className="relative h-[340px] flex-none bg-zinc-950 md:h-[420px] lg:h-[520px] xl:h-[560px]"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <MapBaseNotice unavailable={baseMapUnavailable} onRetry={reloadBaseMap} />
        <div ref={mapContainerRef} className="h-full w-full" />
        
        {/* Drag & Drop Overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[1000] flex items-center justify-center bg-brand-primary-900/40 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-brand-primary-300 bg-zinc-950/40 p-8 text-center shadow-2xl backdrop-blur-md">
                <UploadSimple className="h-12 w-12 text-white mb-4 mx-auto animate-bounce" weight="duotone" />
                <p className="text-xl font-bold text-white">Solte o arquivo de mapa aqui</p>
                <p className="mt-2 text-sm text-brand-primary-100">Suporta KML, KMZ e GeoJSON</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Uploading State Overlay */}
        <AnimatePresence>
          {isUploading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[1000] flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}>
                  <Spinner className="mx-auto mb-4 h-10 w-10 text-brand-primary-400" />
                </motion.div>
                <p className="text-base font-bold text-white">Processando mapa...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!isLoading && geoFiles.length === 0 && !isDragging && !isUploading && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center bg-zinc-950/70 px-6 text-center backdrop-blur-[2px]">
            <div className="geo-surface-raised max-w-sm rounded-lg p-8">
              <MapTrifold weight="duotone" className="mx-auto mb-4 h-12 w-12 text-zinc-400" />
              <p className="text-lg font-bold text-white">Nenhum mapa cadastrado</p>
              <p className="mx-auto mt-2 text-sm font-medium leading-relaxed text-zinc-400">
                Arraste e solte um arquivo KML, KMZ ou GeoJSON aqui, ou use o botão de Upload acima.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(primarySmallActionButtonClass, 'mt-6 w-full')}
              >
                <UploadSimple className="h-4 w-4" weight="bold" />
                Selecionar Arquivo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewFile, setPreviewFile] = useState<ClienteArquivoItem | null>(null);
  const [documentCategoryFilter, setDocumentCategoryFilter] = useState('Todas');
  const [documentSearchTerm, setDocumentSearchTerm] = useState('');
  const [documentUploadCategory, setDocumentUploadCategory] = useState('Documentos');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newDocumentCategoryName, setNewDocumentCategoryName] = useState('');
  const [newDocumentCategoryIcon, setNewDocumentCategoryIcon] = useState('FolderSimple');
  const [newDocumentCategoryTone, setNewDocumentCategoryTone] = useState('teal');
  const [editingDocumentCategoryId, setEditingDocumentCategoryId] = useState<string | null>(null);
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('ha');
  const [copiedContactField, setCopiedContactField] = useState<string | null>(null);
  const [showAlertasModal, setShowAlertasModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'task'; item: ClienteTask }
    | { type: 'agenda'; item: ClienteCompromisso }
    | { type: 'category'; item: DocumentoCategoria }
    | { type: 'file'; filePath: string; fileName: string }
    | null
  >(null);

  const routeParams = new URLSearchParams(location.search);
  const focusedDocumentId = routeParams.get('documentId');
  const focusedOrcamentoId = routeParams.get('orcamentoId');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const arquivo = params.get('arquivo');

    if (arquivo) {
      const syncSearch = window.setTimeout(() => setDocumentSearchTerm(arquivo), 0);
      return () => window.clearTimeout(syncSearch);
    }
  }, [location.search]);

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
    }
  });

  // 2. Fetch Agenda Compromissos
  const { data: compromissos = [], isLoading: loadingCompromissos } = useQuery<ClienteCompromisso[]>({
    queryKey: ['cliente-central-compromissos', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/compromissos?clienteId=${id}`);
      if (!res.ok) return [];
      return res.json();
    }
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

  const { data: clienteGeoFiles = [] } = useQuery<ClienteGeoFileItem[]>({
    queryKey: ['cliente-geo', id],
    queryFn: async () => {
      const res = await apiFetch(`/api/arquivos/cliente/${id}/geo`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.geoFeatures || [];
    },
    enabled: !!id
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
    queryFn: () => apiFetch(`/api/financeiro/orcamentos?clienteId=${id}`).then(res => res.json()),
    enabled: !!id
  });

  const clientOrcamentos = orcamentos;

  // 5. Fetch Client Files
  const { data: filesData = { files: [], path: '' }, isLoading: loadingFiles } = useQuery<{
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
    enabled: !!id
  });

  const { data: documentCategoryOptions = [] } = useQuery<DocumentoCategoria[]>({
    queryKey: ['documento-categorias'],
    queryFn: async () => {
      const res = await apiFetch('/api/arquivos/categorias');
      if (!res.ok) return [];
      return res.json();
    }
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
      queryClient.invalidateQueries({ queryKey: ['cliente-arquivos', id] });
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
      formData.append('clienteId', id!);
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
        queryClient.invalidateQueries({ queryKey: ['cliente-arquivos', id] });
        queryClient.invalidateQueries({ queryKey: ['cliente-geo', id] });
        queryClient.invalidateQueries({ queryKey: ['cliente-central-arquivos', id] });
        queryClient.invalidateQueries({ queryKey: ['documento-categorias'] });
        queryClient.invalidateQueries({ queryKey: ['cliente-historico', id] });
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
        queryClient.invalidateQueries({ queryKey: ['cliente-arquivos', id] });
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
  const totalAreaCadastroM2 = clientProjetos.reduce((acc: number, cur) => acc + ((Number(cur.areaHa) || 0) * 10000), 0);
  const totalAreaPoligonoM2 = clienteGeoFiles.reduce((acc, item) => acc + featureCollectionAreaM2(item.data), 0);
  const totalAreaMapeadaM2 = totalAreaPoligonoM2 > 0 ? totalAreaPoligonoM2 : totalAreaCadastroM2;
  const areaSource = totalAreaPoligonoM2 > 0
    ? 'Calculada pelo polígono'
    : totalAreaCadastroM2 > 0
      ? 'Informada no cadastro'
      : 'Sem área informada';
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
  const featuredProjectLocation = featuredProject
    ? [featuredProject.cidade, featuredProject.municipio].filter(Boolean).join(' / ') || fullAddressValue || 'Localidade não informada'
    : fullAddressValue || 'Localidade não informada';
  const operationalProjectName = featuredProject?.nome || 'Cliente sem projeto vinculado';
  // A data pertence ao projeto; o campo do cliente é apenas um fallback para cadastros legados.
  const deliveryForecast = featuredProject?.dataEntrega || cliente.previsaoEntrega || '';
  const featuredProjectRegistries = featuredProject
    ? [
        { label: 'CAR', value: featuredProject.car },
        { label: 'Matrícula', value: featuredProject.matricula },
        { label: 'CCIR', value: featuredProject.ccir },
        { label: 'ITR', value: featuredProject.itr }
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
      onClick: () => navigate('/orcamentos', { state: { createForClienteId: id } }),
      className: 'border-sky-200/80 bg-sky-50/90 text-sky-900 hover:border-sky-300 hover:bg-sky-100/90 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/20'
    },
    {
      label: 'Alertas',
      icon: <Warning className="h-6 w-6 text-amber-600 dark:text-amber-300" />,
      onClick: () => setShowAlertasModal(true),
      className: 'border-amber-200/80 bg-amber-50/90 text-amber-900 hover:border-amber-300 hover:bg-amber-100/90 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20'
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
      id: 'servicos' as const,
      label: 'Serviços',
      count: clientProjetos.length,
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
      count: clientFiles.length,
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
          className="w-10 h-10 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-950 transition-colors"
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
          <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-base xl:whitespace-nowrap">
            Perfil detalhado, propriedades, serviços, orçamentos, financeiro e central de controle do relacionamento.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 items-stretch gap-x-5 gap-y-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(310px,0.8fr)] xl:grid-rows-[auto_auto]">
        <div
          className="grid h-full items-stretch gap-4 lg:grid-cols-[92px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_auto] xl:col-start-1 xl:row-start-1"
        >
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            <div className="flex min-w-max gap-2 rounded-2xl border border-zinc-200/80 bg-white/90 p-1.5 shadow-sm dark:border-zinc-700/70 dark:bg-zinc-800/80 lg:min-w-0 lg:flex-col">
              <p className="hidden w-full px-1 py-1.5 text-center text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400 lg:block">
                AÇÕES
              </p>
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition-all active:scale-[0.98] lg:h-auto lg:min-h-[50px] lg:flex-col lg:gap-1.5 lg:px-1 lg:py-2.5 shadow-sm ${action.className}`}
                >
                  {action.icon}
                  <span className="max-w-full leading-tight text-center text-[11px] lg:text-[10px]">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-[420px] md:min-h-[500px] lg:min-h-0">
            <ClienteMapaCard clienteId={id!} className="h-full" />
          </div>

          <div className={cn(geoTabListClass, 'min-w-0 overflow-hidden lg:col-span-2')}>
            <div className="flex w-full items-stretch gap-1 overflow-x-auto" role="tablist" aria-label="Central do Cliente">
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
          </div>
        </div>

        {activeTab === 'visao-geral' && (
        <div
          id="cliente-panel-visao-geral"
          role="tabpanel"
          aria-labelledby="cliente-tab-visao-geral"
          className="h-full xl:col-start-1 xl:row-start-2"
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

      {/* Bento Grid layout for basic info and KPIs */}
      <div className="grid gap-4 content-start xl:contents">
        <div className="grid gap-4 content-start xl:col-start-2 xl:row-start-1">
        {/* Client details card */}
        <div className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-sm ring-1 ring-zinc-950/[0.03] dark:border-zinc-800 dark:bg-zinc-900/90 dark:ring-white/[0.04]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2.5 text-lg font-semibold text-zinc-950 dark:text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <IdentificationCard className="h-4 w-4" />
                </span>
                Contato do Cliente
              </h3>
              <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Canais principais, documento e origem do relacionamento.
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${getStatusColor(cliente.situacao)}`}>
              {cliente.situacao || 'Ativo'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm text-zinc-600">
            {cliente.email && (
              <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                  <EnvelopeSimple className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">E-mail</p>
                  <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{cliente.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyContact('email', cliente.email)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-500 transition-colors hover:border-sky-200 hover:text-sky-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-sky-500/30 dark:hover:text-sky-300"
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
                >
                  <ArrowSquareOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {primaryPhoneValue && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Phone className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {cliente.celular ? 'Celular' : 'Telefone'}
                    </p>
                    <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{formatPhoneBR(primaryPhoneValue)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyContact('telefone-principal', formatPhoneBR(primaryPhoneValue))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-emerald-200 hover:text-emerald-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-500/30 dark:hover:text-emerald-300"
                    title="Copiar telefone"
                  >
                    <CopySimple className="h-3.5 w-3.5" />
                  </button>
                  {whatsappUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(whatsappUrl)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                      title="Abrir WhatsApp"
                    >
                      <WhatsappLogo className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {secondaryPhoneValue && (
                  <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lime-50 text-lime-600 dark:bg-lime-500/10 dark:text-lime-300">
                      <Phone className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Telefone</p>
                      <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{formatPhoneBR(secondaryPhoneValue)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyContact('telefone-secundario', formatPhoneBR(secondaryPhoneValue))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-lime-200 hover:text-lime-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-lime-500/30 dark:hover:text-lime-300"
                      title="Copiar telefone"
                    >
                      <CopySimple className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {(documentValue || fullAddressValue) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {documentValue && (
                  <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                      <IdentificationCard className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{documentPrefix}</p>
                      <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{documentValue}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyContact('documento', documentValue)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-amber-200 hover:text-amber-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-amber-500/30 dark:hover:text-amber-300"
                      title="Copiar documento"
                    >
                      <CopySimple className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {fullAddressValue && (
                  <div className="flex items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                      <MapPin className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Endereço</p>
                      <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">{fullAddressValue}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyContact('endereco', fullAddressValue)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:border-rose-200 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-rose-500/30 dark:hover:text-rose-300"
                      title="Copiar endereço"
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

              <div className="grid gap-3 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-200/80">
                      <MapTrifold weight="duotone" className="h-3.5 w-3.5 text-emerald-400" />
                      Área Total Mapeada
                    </p>
                    <FormSelect
                      value={areaUnit}
                      onChange={(event) => setAreaUnit(event.target.value as AreaUnit)}
                      className="h-7 rounded-xl border border-emerald-400/20 bg-stone-900 px-2 text-xs font-semibold text-stone-100 outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="ha">ha</option>
                      <option value="m2">m²</option>
                    </FormSelect>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-emerald-400">
                    {formatAreaValue(totalAreaMapeadaM2, areaUnit)} {areaUnit === 'ha' ? 'ha' : 'm²'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-emerald-100/45">{areaSource}</p>
                </div>

                <div className="rounded-2xl border border-stone-700 bg-stone-900/70 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-400">
                    <FileText weight="duotone" className="h-3.5 w-3.5 text-amber-400" />
                    Registros Fundiários
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {featuredProjectRegistries.length > 0 ? (
                      featuredProjectRegistries.map((reg) => (
                        <span
                          key={reg.label}
                          className="rounded-full border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs font-semibold text-stone-300"
                        >
                          {reg.label}: {reg.value}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs font-semibold text-stone-500">
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
                      <span className="rounded-full border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs font-semibold text-stone-500">
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


        <div className={`flex min-h-0 flex-col gap-4 xl:col-start-2 xl:row-start-2 ${activeTab === 'visao-geral' ? 'h-full' : 'self-start'}`}>
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
            <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${taskProgress}%` }} />
          </div>

          <button
            type="button"
            onClick={() => setShowTaskForm(value => !value)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20 px-4 py-3 text-sm font-semibold text-indigo-700 transition-all duration-200"
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
              <button type="submit" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-white transition-all shadow-sm">
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
                  <div key={tarefa.id} className={`group rounded-2xl border border-l-4 border-zinc-200/80 dark:border-zinc-700/70 p-3 hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-300 shadow-sm ${priorityTone.cardClass}`}>
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
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all disabled:cursor-wait disabled:opacity-50"
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
              <button type="submit" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-white transition-all shadow-sm">
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
                <div key={compromisso.id} className="rounded-2xl border border-zinc-200/80 dark:border-zinc-700/70 bg-zinc-50/80 dark:bg-zinc-800/70 p-3 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-300">
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
      </div>

      {/* Tab Contents */}
      {activeTab !== 'visao-geral' && (
      <div
        id={`cliente-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`cliente-tab-${activeTab}`}
        className="min-h-[300px] xl:col-start-1 xl:row-start-2"
      >
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
                onClick={() => navigate('/projetos', { state: { createForClienteId: id, openCreateModal: true, contexto: 'ambiental' } })}
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
                      <Link
                        to={`/ambiental/${project.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-300"
                      >
                        Abrir demanda
                        <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
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
                  onClick={() => navigate('/projetos', { state: { createForClienteId: id, modalTab: 'projeto' } })}
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
                  className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-300 rounded-2xl p-6 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
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
                        <Link to={`/projetos/${proj.id}`}>{proj.nome}</Link>
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
                    <Link 
                      to={`/projetos/${proj.id}`}
                      className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950 rounded-xl text-xs font-bold transition-all"
                    >
                      Detalhes
                    </Link>
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
                  onClick={() => navigate('/orcamentos', { state: { createForClienteId: id } })}
                  className="mt-4 px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950 rounded-xl text-sm font-semibold transition-all"
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
                      onClick={() => navigate('/orcamentos', { state: { createForClienteId: id } })}
                      className="p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950 rounded-xl text-zinc-600 transition-all flex items-center justify-center gap-1.5 text-xs font-semibold"
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
                          onClick={() => handlePreviewFile(file)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-300 transition-all shadow-sm"
                          title={canPreviewFile(file) ? 'Visualizar no GeoGestor' : 'Abrir arquivo'}
                        >
                          <Eye weight="bold" className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenFile(file.path)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-50 dark:bg-violet-950/40 hover:bg-violet-100 border border-violet-200/80 dark:border-violet-800/60 text-violet-600 dark:text-violet-300 transition-all shadow-sm"
                          title="Abrir no aplicativo padrão"
                        >
                          <ArrowSquareOut weight="bold" className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => window.open(getDownloadUrl(file.path))}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 border border-sky-200/80 dark:border-sky-800/60 text-sky-600 dark:text-sky-300 transition-all shadow-sm"
                          title="Baixar Arquivo"
                        >
                          <DownloadSimple weight="bold" className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFileDelete(file.path, file.name)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-950/40 hover:bg-red-100 border border-red-200/80 dark:border-red-800/60 text-red-600 dark:text-red-400 transition-all shadow-sm"
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
      </div>
      )}
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
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  <ArrowSquareOut className="h-4 w-4" />
                  Abrir fora
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition-all hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
      {/* Modal de Alertas Operacionais */}
      <Modal
        isOpen={showAlertasModal}
        onClose={() => setShowAlertasModal(false)}
        title="Alertas Operacionais"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
          {alertasOperacionaisResumo.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
              <CheckCircle className="w-10 h-10 text-emerald-500 mb-3" />
              <p className="text-sm font-medium text-zinc-950 dark:text-white">Tudo em ordem!</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Nenhum alerta operacional para este cliente.</p>
            </div>
          ) : (
            alertasOperacionaisResumo.map((alerta, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-500/5 p-4 shadow-sm"
              >
                <div className="rounded-full bg-amber-100 dark:bg-amber-500/20 p-2 shrink-0">
                  <Warning className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200 leading-snug">
                    {alerta}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === 'task') deleteTaskMutation.mutate(deleteTarget.item.id);
          if (deleteTarget?.type === 'agenda') deleteAgendaMutation.mutate(deleteTarget.item.id);
          if (deleteTarget?.type === 'category') deleteDocumentCategoryMutation.mutate(deleteTarget.item);
          if (deleteTarget?.type === 'file') deleteFileMutation.mutate(deleteTarget.filePath);
        }}
        title={deleteTarget?.type === 'task'
          ? `Excluir tarefa “${deleteTarget.item.titulo}”?`
          : deleteTarget?.type === 'agenda'
            ? `Excluir compromisso “${deleteTarget.item.titulo}”?`
            : deleteTarget?.type === 'category'
              ? `Excluir categoria “${deleteTarget.item.nome}”?`
              : `Excluir arquivo${deleteTarget?.fileName ? ` “${deleteTarget.fileName}”` : ''}?`}
        description={deleteTarget?.type === 'task'
          ? 'A tarefa será removida da central do cliente e do projeto vinculado, quando houver. Os cadastros relacionados serão preservados. Esta ação não pode ser desfeita.'
          : deleteTarget?.type === 'agenda'
            ? 'O compromisso será removido da agenda e da central do cliente. Os cadastros relacionados serão preservados. Esta ação não pode ser desfeita.'
            : deleteTarget?.type === 'category'
              ? 'A categoria será removida das opções documentais. Esta exclusão só é permitida quando nenhum arquivo está vinculado a ela. Esta ação não pode ser desfeita.'
              : 'O arquivo será removido permanentemente do disco local e deixará de aparecer nos documentos do cliente. Esta ação não pode ser desfeita.'}
        confirmText={deleteTarget?.type === 'task'
          ? 'Excluir tarefa'
          : deleteTarget?.type === 'agenda'
            ? 'Excluir compromisso'
            : deleteTarget?.type === 'category'
              ? 'Excluir categoria'
              : 'Excluir arquivo'}
        loading={deleteTaskMutation.isPending || deleteAgendaMutation.isPending || deleteDocumentCategoryMutation.isPending || deleteFileMutation.isPending}
      />

    </Layout>
  );
}
