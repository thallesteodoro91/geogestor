import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import {
  CheckCircle,
  Crosshair,
  Eye,
  EyeSlash,
  FilePdf,
  FileText,
  MapPin,
  MapTrifold,
  Spinner,
  Trash,
  UploadSimple
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MapBaseNotice } from '../../../components/maps/MapBaseNotice';
import { Modal } from '../../../components/Modal';
import { createBaseTileLayer, createNeutralGridLayer } from '../../../utils/mapTiles';
import { apiFetch, getAuthenticatedAssetUrl } from '../../../services/apiClient';
import { loadPdfMake } from '../../../utils/loadPdfMake';
import { primarySmallActionButtonClass, secondarySmallActionButtonClass } from '../../../utils/actionStyles';
import { cn } from '../../../utils/cn';
import {
  MBTILES_SURVEY_GUIDANCE,
  RASTER_SURVEY_GUIDANCE,
  SHAPEFILE_COMPONENT_EXTENSIONS,
  VECTOR_SURVEY_ACCEPT,
  VECTOR_SURVEY_GUIDANCE,
  classifyVectorSurveyFileName,
  fileExtension
} from '../../../utils/geospatialFilePolicy';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIconRetinaUrl,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
});

type AreaUnit = 'ha' | 'm2';

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

interface ClienteGeoFileItem {
  contentKind?: 'vector';
  id: string;
  documentId: string;
  projectId?: string | null;
  fileName: string;
  name?: string;
  type: string;
  format?: string;
  data?: object | null;
  status?: 'ready' | 'needs_crs' | 'needs_review' | 'error';
  sourceCrs?: string | null;
  sourceEpsg?: number | null;
  featureCount?: number;
  vertexCount?: number;
  geometryTypes?: string[];
  bbox?: [number, number, number, number] | null;
  representativePoint?: { latitude: number; longitude: number } | null;
  projectLocation?: { latitude: number; longitude: number } | null;
  locationDifferenceM?: number | null;
  areaM2?: number | null;
  perimeterM?: number | null;
  warnings?: string[];
  topologyIssues?: Array<{ code: string; severity: 'info' | 'warning' | 'blocking'; message: string; featureIndex?: number; repairAvailable?: boolean }>;
  repairs?: string[];
  errorMessage?: string | null;
  processingStage?: string;
  processingProgress?: number;
  sourceDetection?: string | null;
  crsConfidence?: 'high' | 'medium' | 'low' | null;
  axisOrder?: 'longitude-latitude' | 'latitude-longitude';
  representativePointMethod?: string | null;
  simplifiedForDisplay?: boolean;
  precisionCacheBytes?: number;
  displayCacheBytes?: number;
  visible?: boolean;
  color?: string;
  opacity?: number;
}

interface OfflineBasemapItem {
  kind: 'offline-basemap';
  id: string;
  name: string;
  format: string;
  minZoom?: number | null;
  maxZoom?: number | null;
  attribution?: string | null;
  sizeBytes: number;
  active: boolean;
}

interface CrsCatalogItem {
  code: string;
  name: string;
  datum: string;
  kind: string;
  zone?: number;
}

interface CrsPreviewResult {
  documentId: string;
  fileName: string;
  layers: Array<{
    name: string;
    sourceCrs: string;
    axisOrder: string;
    targetCrs: string;
    bbox: [number, number, number, number];
    representativePoint: { latitude: number; longitude: number };
    featureCount: number;
    vertexCount: number;
    overlapsBrazil: boolean;
    warnings: string[];
    axisComparison?: Array<{
      axisOrder: string;
      bbox: [number, number, number, number];
      representativePoint: { latitude: number; longitude: number };
      overlapsBrazil: boolean;
      warnings: string[];
    }>;
  }>;
}

interface TechnicalHistoryEvent {
  id: string;
  description: string;
  createdAt: string;
  type: string;
}

interface TechnicalReportData {
  error?: string;
  fileName?: string;
  layer?: string;
  relativePath?: string;
  importedAt?: string;
  result?: string;
  format?: string;
  layersFound?: string[];
  ignoredRasterLayers?: string[];
  sourceCrs?: string;
  sourceDetection?: string;
  crsConfidence?: string;
  targetCrs?: string;
  axisOrder?: string;
  featureCount?: number;
  vertexCount?: number;
  geometryTypes?: string[];
  bbox?: unknown;
  representativePoint?: unknown;
  areaM2?: number;
  perimeterM?: number;
  distanceToProjectM?: number | null;
  originalSizeBytes?: number;
  cache?: { precisionBytes?: number; displayBytes?: number };
  metricMethod?: string;
  warnings?: string[];
  topologyIssues?: Array<{ message: string }>;
  simplifiedForDisplay?: boolean;
  history?: TechnicalHistoryEvent[];
}

interface GeospatialCacheStatus {
  activeFiles: number;
  activeBytes: number;
  orphanFiles: number;
  orphanBytes: number;
  removedFiles?: number;
}

export function ClienteMapaCard({ clienteId, clienteNome, className = '' }: { clienteId: string; clienteNome: string; className?: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geojsonLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const geojsonLayersRef = useRef(new Map<string, L.GeoJSON>());
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const neutralGridLayerRef = useRef<L.GridLayer | null>(null);
  const queryClient = useQueryClient();
  
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [baseMapUnavailable, setBaseMapUnavailable] = useState(() => !navigator.onLine);
  const [selectedBaseMap, setSelectedBaseMap] = useState('online');
  const [displayDataByLayer, setDisplayDataByLayer] = useState<Record<string, object | null>>({});
  const [crsSelections, setCrsSelections] = useState<Record<string, string>>({});
  const [crsSearches, setCrsSearches] = useState<Record<string, string>>({});
  const [crsPreviews, setCrsPreviews] = useState<Record<string, CrsPreviewResult | null>>({});
  const [favoriteCrs, setFavoriteCrs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('geogestor:crs-favorites') || '[]'); } catch { return []; }
  });
  const [recentCrs, setRecentCrs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('geogestor:crs-recents') || '[]'); } catch { return []; }
  });
  const [processingDocumentId, setProcessingDocumentId] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<{ stage: string; progress: number; cancelRequested?: boolean } | null>(null);
  const [axisSelections, setAxisSelections] = useState<Record<string, 'longitude-latitude' | 'latitude-longitude'>>({});
  const [locationPreview, setLocationPreview] = useState<null | {
    layer: ClienteGeoFileItem;
    projectName: string;
    fileName: string;
    layerName: string;
    current: { latitude: number; longitude: number } | null;
    proposed: { latitude: number; longitude: number };
    distanceM: number | null;
    sourceCrs: string | null;
    targetCrs: string;
    method: string;
  }>(null);
  const [locationWarningThresholdM, setLocationWarningThresholdM] = useState(() => {
    const stored = Number(localStorage.getItem('geogestor:location-warning-m'));
    return Number.isFinite(stored) && stored >= 0 ? stored : 100;
  });
  const [technicalReport, setTechnicalReport] = useState<{ layer: ClienteGeoFileItem; report: TechnicalReportData } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const basemapInputRef = useRef<HTMLInputElement>(null);

  const { data: offlineBasemaps = [] } = useQuery<OfflineBasemapItem[]>({
    queryKey: ['offline-basemaps'],
    queryFn: async () => {
      const response = await apiFetch('/api/arquivos/geospatial/basemaps');
      if (!response.ok) return [];
      return (await response.json()).basemaps || [];
    }
  });

  const { data: crsCatalog = [] } = useQuery<CrsCatalogItem[]>({
    queryKey: ['geospatial-crs-catalog'],
    queryFn: async () => {
      const response = await apiFetch('/api/arquivos/geospatial/crs-catalog');
      if (!response.ok) return [];
      return (await response.json()).items || [];
    },
    staleTime: Infinity
  });

  const { data: cacheStatus } = useQuery<GeospatialCacheStatus>({
    queryKey: ['geospatial-cache-status'],
    queryFn: async () => {
      const response = await apiFetch('/api/arquivos/geospatial/cache/maintenance');
      if (!response.ok) throw new Error('Não foi possível consultar o cache.');
      return response.json();
    }
  });

  const cacheCleanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch('/api/arquivos/geospatial/cache/orphans', { method: 'DELETE' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível limpar o cache.');
      return body as GeospatialCacheStatus;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['geospatial-cache-status'] });
      toast.success(`${result.removedFiles || 0} arquivo(s) órfão(s) removido(s); documentos originais preservados.`);
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const crsPreviewMutation = useMutation({
    mutationFn: async (layer: ClienteGeoFileItem) => {
      const response = await apiFetch(`/api/arquivos/geospatial/${layer.documentId}/preview-crs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCrs: crsSelections[layer.documentId] || layer.sourceCrs || 'EPSG:4326',
          axisOrder: axisSelections[layer.documentId] || 'longitude-latitude'
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível gerar a prévia do SRC.');
      return body as CrsPreviewResult;
    },
    onSuccess: (preview) => {
      setCrsPreviews((current) => ({ ...current, [preview.documentId]: preview }));
      const code = preview.layers[0]?.sourceCrs;
      if (code) setRecentCrs((current) => [code, ...current.filter((item) => item !== code)].slice(0, 6));
    },
    onError: (error: Error) => toast.error(error.message)
  });

  useEffect(() => { localStorage.setItem('geogestor:crs-favorites', JSON.stringify(favoriteCrs)); }, [favoriteCrs]);
  useEffect(() => { localStorage.setItem('geogestor:crs-recents', JSON.stringify(recentCrs)); }, [recentCrs]);
  useEffect(() => { localStorage.setItem('geogestor:location-warning-m', String(locationWarningThresholdM)); }, [locationWarningThresholdM]);

  const basemapUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const response = await apiFetch('/api/arquivos/geospatial/basemaps', { method: 'POST', body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível importar o MBTiles.');
      return body.basemap as OfflineBasemapItem;
    },
    onSuccess: (basemap) => {
      queryClient.invalidateQueries({ queryKey: ['offline-basemaps'] });
      setSelectedBaseMap(basemap.id);
      toast.success('Mapa-base MBTiles importado e ativado.');
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const reloadBaseMap = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);
    if (neutralGridLayerRef.current) map.removeLayer(neutralGridLayerRef.current);
    baseTileLayerRef.current = null;
    neutralGridLayerRef.current = null;
    if (selectedBaseMap === 'neutral') {
      neutralGridLayerRef.current = createNeutralGridLayer(map);
      setBaseMapUnavailable(true);
      return;
    }
    const offline = offlineBasemaps.find((item) => item.id === selectedBaseMap);
    if (offline?.active) {
      baseTileLayerRef.current = createBaseTileLayer(map, () => setBaseMapUnavailable(true), () => setBaseMapUnavailable(false), {
        url: getAuthenticatedAssetUrl(`/api/arquivos/geospatial/basemaps/${offline.id}/tiles/{z}/{x}/{y}`),
        attribution: offline.attribution || `${offline.name} · MBTiles local`,
        minZoom: offline.minZoom ?? 0,
        maxZoom: offline.maxZoom ?? 22
      });
      setBaseMapUnavailable(false);
      return;
    }
    if (offline && !offline.active) {
      neutralGridLayerRef.current = createNeutralGridLayer(map);
      setBaseMapUnavailable(true);
      return;
    }
    setBaseMapUnavailable(!navigator.onLine);
    baseTileLayerRef.current = createBaseTileLayer(map, () => {
      setBaseMapUnavailable(true);
      if (!neutralGridLayerRef.current) neutralGridLayerRef.current = createNeutralGridLayer(map);
    }, () => {
      setBaseMapUnavailable(false);
      if (neutralGridLayerRef.current) { map.removeLayer(neutralGridLayerRef.current); neutralGridLayerRef.current = null; }
    });
  }, [offlineBasemaps, selectedBaseMap]);

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

  useEffect(() => {
    if (mapInstanceRef.current) reloadBaseMap();
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
  const geoFilesRef = useRef(geoFiles);

  useEffect(() => {
    geoFilesRef.current = geoFiles;
  }, [geoFiles]);
  const mappedAreaM2 = useMemo(() => geoFiles.reduce((sum, item) => sum + Number(item.areaM2 || 0), 0), [geoFiles]);

  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('clienteId', clienteId);
      formData.append('category', 'Mapas');
      formData.append('uploadPurpose', 'vector-survey');
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
    onSuccess: (response) => {
      const layers = Array.isArray(response?.geospatialLayers) ? response.geospatialLayers as ClienteGeoFileItem[] : [];
      const attention = layers.find((layer) => layer.status === 'needs_crs' || layer.status === 'needs_review');
      const failed = layers.find((layer) => layer.status === 'error');
      if (failed) toast.error(`Arquivo armazenado, mas a camada não foi processada: ${failed.errorMessage || 'verifique o arquivo.'}`);
      else if (attention) toast.warning('Arquivo armazenado. Confirme o SRC ou a ordem dos eixos para posicionar a camada.');
      else if (layers.length) toast.success('Levantamento vetorial processado e posicionado no mapa.');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['cliente-arquivos', clienteId] });
        queryClient.invalidateQueries({ queryKey: ['cliente-geo', clienteId] });
        queryClient.invalidateQueries({ queryKey: ['cliente-central-arquivos', clienteId] });
        queryClient.invalidateQueries({ queryKey: ['cliente-historico', clienteId] });
      }, 10);
    },
    onError: (err: Error) => {
      toast.error(`Não foi possível importar o levantamento vetorial: ${err.message}`);
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });

  const layerActionMutation = useMutation({
    mutationFn: async (input: { layer: ClienteGeoFileItem; action: 'process' | 'style' | 'remove' | 'use-location' | 'undo-location' | 'repair' | 'undo-repair'; visible?: boolean; color?: string; opacity?: number }) => {
      const { layer } = input;
      const endpoint = input.action === 'process'
        ? `/api/arquivos/geospatial/${layer.documentId}/process`
        : input.action === 'use-location'
          ? `/api/arquivos/geospatial/${layer.id}/use-location`
          : input.action === 'undo-location'
            ? `/api/arquivos/geospatial/${layer.id}/undo-location`
            : input.action === 'repair'
              ? `/api/arquivos/geospatial/${layer.id}/repair`
              : input.action === 'undo-repair'
                ? `/api/arquivos/geospatial/${layer.id}/undo-repair`
          : `/api/arquivos/geospatial/${layer.id}`;
      const body = input.action === 'process'
        ? {
            sourceCrs: crsSelections[layer.documentId] || layer.sourceCrs || 'EPSG:4326',
            axisOrder: axisSelections[layer.documentId] || 'longitude-latitude'
          }
        : { visible: input.visible, color: input.color, opacity: input.opacity };
      const res = await apiFetch(endpoint, {
        method: input.action === 'remove' ? 'DELETE' : input.action === 'style' ? 'PATCH' : 'POST',
        headers: input.action === 'remove' || ['use-location', 'undo-location', 'repair', 'undo-repair'].includes(input.action) ? undefined : { 'Content-Type': 'application/json' },
        body: input.action === 'remove' || ['use-location', 'undo-location', 'repair', 'undo-repair'].includes(input.action) ? undefined : JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Não foi possível atualizar a camada.');
      }
      return res.json();
    },
    onSuccess: (_response, input) => {
      queryClient.invalidateQueries({ queryKey: ['cliente-geo', clienteId] });
      if (input.action === 'use-location') {
        queryClient.invalidateQueries({ queryKey: ['projetos', clienteId] });
        toast.success('Localização representativa aplicada ao projeto.');
      }
      if (input.action === 'undo-location') toast.success('Localização anterior do projeto restaurada.');
      if (input.action === 'repair') toast.success('Reparos topológicos seguros aplicados.');
      if (input.action === 'undo-repair') toast.success('Reparo topológico desfeito.');
    },
    onError: (error: Error) => toast.error(error.message),
    onMutate: (input) => {
      if (input.action === 'process') {
        setProcessingDocumentId(input.layer.documentId);
        setProcessingProgress({ stage: 'enviado', progress: 0 });
      }
    },
    onSettled: (_data, _error, input) => {
      if (input.action === 'process') {
        setProcessingProgress((current) => current?.stage === 'erro' ? current : { stage: 'concluido', progress: 100 });
        window.setTimeout(() => { setProcessingDocumentId(null); setProcessingProgress(null); }, 1200);
      }
    }
  });

  useEffect(() => {
    if (!processingDocumentId) return undefined;
    let active = true;
    const refresh = async () => {
      const response = await apiFetch(`/api/arquivos/geospatial/process/${processingDocumentId}/progress`);
      if (!active || !response.ok) return;
      setProcessingProgress(await response.json());
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 500);
    return () => { active = false; window.clearInterval(interval); };
  }, [processingDocumentId]);

  const openLocationPreview = async (layer: ClienteGeoFileItem) => {
    const response = await apiFetch(`/api/arquivos/geospatial/${layer.id}/location-preview`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(body.error || 'Pré-visualização indisponível.'); return; }
    setLocationPreview({ ...body, layer });
  };

  const exportTechnicalReport = async (layer: ClienteGeoFileItem, format: 'json' | 'pdf') => {
    const response = await apiFetch(`/api/arquivos/geospatial/${layer.id}/report`);
    const report: TechnicalReportData = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(report.error || 'Relatório indisponível.'); return; }
    const safeName = String(layer.name || layer.fileName || 'camada').replace(/[^a-z0-9_-]+/gi, '-');
    if (format === 'json') {
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `relatorio-geoespacial-${safeName}.json`; link.click(); URL.revokeObjectURL(url);
      return;
    }
    const pdfMake = await loadPdfMake();
    pdfMake.createPdf({
      content: [
        { text: 'GeoGestor · Relatório técnico de importação', style: 'header' },
        { text: `${report.fileName || layer.fileName} · ${report.layer || layer.name || ''}`, margin: [0, 4, 0, 12] },
        { table: { widths: ['38%', '*'], body: [
          ['Resultado', report.result || layer.status || '—'], ['Natureza', 'Levantamento vetorial'], ['Formato', report.format || '—'], ['Camadas vetoriais encontradas', (report.layersFound || []).join(', ')],
          ['Conteúdo raster ignorado', (report.ignoredRasterLayers || []).join(', ') || 'Nenhum'], ['SRC original', report.sourceCrs || 'Não informado'],
          ['Origem/confiança', `${report.sourceDetection || '—'} · ${report.crsConfidence || '—'}`], ['SRC normalizado', report.targetCrs || 'EPSG:4326'],
          ['Feições', String(report.featureCount || 0)], ['Vértices', String(report.vertexCount || 0)], ['Tipos geométricos', (report.geometryTypes || []).join(', ')],
          ['Bounding box', JSON.stringify(report.bbox || null)], ['Ponto representativo', JSON.stringify(report.representativePoint || null)],
          ['Área aproximada', report.areaM2 ? `${Number(report.areaM2).toLocaleString('pt-BR')} m²` : '—'], ['Perímetro aproximado', report.perimeterM ? `${Number(report.perimeterM).toLocaleString('pt-BR')} m` : '—'],
          ['Método métrico', report.metricMethod || '—'], ['Distância até o projeto', report.distanceToProjectM == null ? '—' : `${Number(report.distanceToProjectM).toLocaleString('pt-BR')} m`], ['Visualização simplificada', report.simplifiedForDisplay ? 'Sim; somente no mapa' : 'Não']
        ] } },
        { text: 'Alertas e validação', style: 'subheader', margin: [0, 14, 0, 5] },
        { ul: [...(report.warnings || []), ...(report.topologyIssues || []).map((issue: { message: string }) => issue.message)] }
      ],
      styles: { header: { fontSize: 17, bold: true, color: '#312e81' }, subheader: { fontSize: 12, bold: true } },
      defaultStyle: { fontSize: 9 }
    }).download(`relatorio-geoespacial-${safeName}.pdf`);
  };

  const openTechnicalReport = async (layer: ClienteGeoFileItem) => {
    const [response, historyResponse] = await Promise.all([
      apiFetch(`/api/arquivos/geospatial/${layer.id}/report`),
      apiFetch(`/api/arquivos/geospatial/${layer.id}/history`)
    ]);
    const report: TechnicalReportData = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(report.error || 'Relatório indisponível.'); return; }
    const history = historyResponse.ok ? (await historyResponse.json()).events || [] : [];
    setTechnicalReport({ layer, report: { ...report, history } });
  };

  const handleFiles = async (files: File[]) => {
    if (!files.length) return;
    const componentExtensions = new Set<string>(SHAPEFILE_COMPONENT_EXTENSIONS);
    const components = files.filter((file) => componentExtensions.has(fileExtension(file.name)));
    if (components.length) {
      const grouped = new Map<string, Set<string>>();
      for (const file of components) {
        const extension = fileExtension(file.name);
        const base = file.name.slice(0, -extension.length).toLocaleLowerCase('pt-BR');
        grouped.set(base, new Set([...(grouped.get(base) || []), extension]));
      }
      const incomplete = [...grouped.entries()].filter(([, extensions]) => !extensions.has('.shp') || !extensions.has('.shx'));
      if (incomplete.length) {
        toast.error(`Shapefile incompleto: ${incomplete.map(([base, extensions]) => `${base} (${extensions.has('.shp') ? 'falta .shx' : 'falta .shp'})`).join('; ')}.`);
        return;
      }
      const { zipSync } = await import('fflate');
      const entries: Record<string, Uint8Array> = {};
      for (const file of components) entries[file.name] = new Uint8Array(await file.arrayBuffer());
      const zip = zipSync(entries, { level: 6 });
      const packaged = new File([zip], `${components[0].name.replace(/\.[^.]+$/, '')}-shapefile.zip`, { type: 'application/zip' });
      setIsUploading(true);
      uploadFileMutation.mutate(packaged);
      return;
    }
    const file = files[0];
    const classification = classifyVectorSurveyFileName(file.name);
    if (classification === 'raster') {
      toast.error(RASTER_SURVEY_GUIDANCE);
      return;
    }
    if (classification === 'mbtiles') {
      toast.error(MBTILES_SURVEY_GUIDANCE);
      return;
    }
    if (classification !== 'vector') {
      toast.error(VECTOR_SURVEY_GUIDANCE);
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
      void handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame = 0;

    if (isLoading) return undefined;

    if (mapContainerRef.current && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([-15.793889, -47.882778], 4);

      const layerGroup = L.layerGroup().addTo(map);
      geojsonLayerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;
      reloadBaseMap();

      const refreshDisplayLevel = async () => {
        const zoom = map.getZoom();
        const bounds = map.getBounds();
        const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(',');
        const scalableLayers = geoFilesRef.current.filter((layer) => layer.simplifiedForDisplay);
        if (!scalableLayers.length) return;
        const entries = await Promise.all(scalableLayers.map(async (layer) => {
          const response = await apiFetch(`/api/arquivos/geospatial/${layer.id}/display?zoom=${zoom}&bbox=${encodeURIComponent(bbox)}`);
          const body = await response.json().catch(() => ({}));
          return [layer.id, response.ok ? body.data || null : null] as const;
        }));
        setDisplayDataByLayer((current) => ({ ...current, ...Object.fromEntries(entries) }));
      };
      map.on('zoomend', refreshDisplayLevel);
      map.on('moveend', refreshDisplayLevel);

      const scheduleMapResize = () => {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));
      };

      resizeObserver = new ResizeObserver(scheduleMapResize);
      resizeObserver.observe(mapContainerRef.current);
      if (mapContainerRef.current.parentElement) {
        resizeObserver.observe(mapContainerRef.current.parentElement);
      }
      window.addEventListener('resize', scheduleMapResize);

      scheduleMapResize();

      return () => {
        window.removeEventListener('resize', scheduleMapResize);
        resizeObserver?.disconnect();
        window.cancelAnimationFrame(resizeFrame);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.off('zoomend', refreshDisplayLevel);
          mapInstanceRef.current.off('moveend', refreshDisplayLevel);
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
          baseTileLayerRef.current = null;
          neutralGridLayerRef.current = null;
        }
      };
    }

    return undefined;
  }, [reloadBaseMap, isLoading]);

  useEffect(() => {
    if (!mapInstanceRef.current || !geojsonLayerGroupRef.current) return;

    geojsonLayerGroupRef.current.clearLayers();
    geojsonLayersRef.current.clear();

    const bounds = L.latLngBounds([]);
    let hasData = false;

    geoFiles.forEach((feature) => {
      try {
        const displayData = displayDataByLayer[feature.id] || feature.data;
        if (!feature || !displayData || feature.visible === false) return;
        const layerColor = feature.color || '#7c3aed';
        const layerOpacity = typeof feature.opacity === 'number' ? feature.opacity : 0.75;
        const layer = L.geoJSON(displayData as Parameters<typeof L.geoJSON>[0], {
          style: (item) => item?.properties?.__geogestor_invalid ? {
            color: '#dc2626', weight: 4, opacity: 1, fillColor: '#fca5a5', fillOpacity: 0.45, dashArray: '7 5'
          } : {
            color: layerColor, weight: 3, opacity: layerOpacity, fillColor: layerColor,
            fillOpacity: Math.min(0.5, layerOpacity * 0.35)
          },
          pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
            radius: 6,
            color: layerColor,
            weight: 2,
            fillColor: layerColor,
            fillOpacity: layerOpacity
          }),
          onEachFeature: (item, layerItem) => {
            const popup = document.createElement('div');
            const title = document.createElement('strong');
            title.textContent = String(item.properties?.name || feature.fileName);
            popup.appendChild(title);
            const issues = Array.isArray(item.properties?.__geogestor_issues) ? item.properties.__geogestor_issues : [];
            if (issues.length) {
              const message = document.createElement('p');
              message.className = 'mt-1 text-red-700';
              message.textContent = `Problema topológico: ${issues.join(' ')}`;
              popup.appendChild(message);
            }
            layerItem.bindPopup(popup);
          }
        });

        geojsonLayerGroupRef.current?.addLayer(layer);
        if (feature.id) geojsonLayersRef.current.set(feature.id, layer);
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
  }, [displayDataByLayer, geoFiles]);

  return (
    <div className={`geo-card flex h-full w-full min-w-0 flex-col overflow-hidden ${className}`}>
      <div className="border-b border-brand-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-indigo-50 text-brand-indigo-700 dark:bg-brand-indigo-400/12 dark:text-brand-indigo-100">
            <MapTrifold weight="duotone" className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">Mapa do Cliente</h3>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Levantamentos vetoriais e fundo cartográfico são gerenciados separadamente.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <section className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 dark:border-indigo-900 dark:bg-indigo-950/20" aria-labelledby="vector-survey-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0"><h4 id="vector-survey-title" className="text-sm font-semibold text-zinc-950 dark:text-white">Levantamentos e camadas vetoriais</h4><p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">O GeoGestor importa KML, KMZ, GeoJSON, Shapefile e GeoPackage vetorial. Arquivos raster não são utilizados como levantamento.</p></div>
              <span className="geo-badge-base geo-badge-primary px-3 py-1 text-xs uppercase tracking-wider" aria-live="polite">{isLoading ? 'Carregando…' : `${geoFiles.length} ${geoFiles.length === 1 ? 'camada vetorial' : 'camadas vetoriais'}`}</span>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept={VECTOR_SURVEY_ACCEPT} multiple aria-label="Selecionar levantamento vetorial" onChange={(event) => { if (event.target.files?.length) void handleFiles(Array.from(event.target.files)); event.target.value = ''; }} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className={cn(primarySmallActionButtonClass, 'mt-3 min-h-10 px-3')}>
              {isUploading ? <Spinner className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UploadSimple className="h-4 w-4" aria-hidden="true" />}
              {isUploading ? 'Importando levantamento…' : 'Adicionar levantamento vetorial'}
            </button>
          </section>
          <details className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900 dark:bg-sky-950/20">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-950 focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-white">Configurar mapa-base offline</summary>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">O MBTiles é utilizado somente como fundo cartográfico offline. Ele não altera coordenadas, geometrias, cálculos ou a localização do levantamento.</p>
            {!offlineBasemaps.length && <p role="status" className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Nenhum mapa-base MBTiles importado. A grade local neutra permanece disponível.</p>}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Fundo cartográfico<select value={selectedBaseMap} onChange={(event) => setSelectedBaseMap(event.target.value)} className="mt-1 block min-h-9 rounded-lg border border-zinc-300 bg-white px-2 text-xs text-zinc-900 focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"><option value="online">OpenStreetMap · online</option><option value="neutral">Grade local · offline</option>{offlineBasemaps.map((item) => <option key={item.id} value={item.id}>{item.name} · MBTiles {item.active ? 'ativo' : 'desativado'}</option>)}</select></label>
              <input ref={basemapInputRef} type="file" accept=".mbtiles" className="hidden" aria-label="Selecionar mapa-base MBTiles raster" onChange={(event) => { const file = event.target.files?.[0]; if (file) basemapUploadMutation.mutate(file); event.target.value = ''; }} />
              <button type="button" className={secondarySmallActionButtonClass} disabled={basemapUploadMutation.isPending} onClick={() => basemapInputRef.current?.click()}>{basemapUploadMutation.isPending ? <Spinner className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <MapTrifold className="h-3.5 w-3.5" aria-hidden="true" />}{basemapUploadMutation.isPending ? 'Importando mapa-base…' : 'Importar mapa-base MBTiles'}</button>
              {offlineBasemaps.some((item) => item.id === selectedBaseMap) && <button type="button" className={secondarySmallActionButtonClass} onClick={async () => { const current = offlineBasemaps.find((item) => item.id === selectedBaseMap)!; const response = await apiFetch(`/api/arquivos/geospatial/basemaps/${selectedBaseMap}/active`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !current.active }) }); if (!response.ok) { toast.error('Não foi possível alterar o mapa-base. Tente novamente.'); return; } if (current.active) setSelectedBaseMap('neutral'); queryClient.invalidateQueries({ queryKey: ['offline-basemaps'] }); toast.success(current.active ? 'Mapa-base offline desativado.' : 'Mapa-base offline ativado.'); }}>{offlineBasemaps.find((item) => item.id === selectedBaseMap)?.active ? <EyeSlash className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}{offlineBasemaps.find((item) => item.id === selectedBaseMap)?.active ? 'Desativar' : 'Ativar'} mapa-base</button>}
              {offlineBasemaps.some((item) => item.id === selectedBaseMap) && <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" onClick={async () => { if (!window.confirm('Remover somente este mapa-base offline? Levantamentos, documentos e projetos serão preservados.')) return; const response = await apiFetch(`/api/arquivos/geospatial/basemaps/${selectedBaseMap}`, { method: 'DELETE' }); if (!response.ok) { toast.error('Não foi possível remover o mapa-base. Tente novamente.'); return; } setSelectedBaseMap('neutral'); queryClient.invalidateQueries({ queryKey: ['offline-basemaps'] }); toast.success('Mapa-base offline removido; levantamentos preservados.'); }}><Trash className="h-3.5 w-3.5" aria-hidden="true" />Remover mapa-base</button>}
            </div>
          </details>
        </div>
      </div>

      <div 
        className="relative h-[340px] w-full min-w-0 flex-none bg-zinc-950 md:h-[420px] lg:h-[520px] xl:h-[560px]"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <MapBaseNotice unavailable={baseMapUnavailable} onRetry={reloadBaseMap} mode={selectedBaseMap === 'neutral' || offlineBasemaps.some((item) => item.id === selectedBaseMap && !item.active) ? 'neutral' : offlineBasemaps.some((item) => item.id === selectedBaseMap && item.active) ? 'offline' : 'online'} />
        <div ref={mapContainerRef} role="region" aria-label={`Mapa das propriedades de ${clienteNome}${mappedAreaM2 > 0 ? `, com ${formatAreaValue(mappedAreaM2, 'ha')} hectares mapeados` : ''}`} className="h-full w-full min-w-0" />
        
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
                <UploadSimple className="h-12 w-12 text-white mb-4 mx-auto animate-bounce" weight="duotone" aria-hidden="true" />
                <p className="text-xl font-bold text-white">Solte o levantamento vetorial aqui</p>
                <p className="mt-2 text-sm text-brand-primary-100">KML, KMZ, GeoJSON, Shapefile ZIP ou GeoPackage vetorial</p>
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
                  <Spinner className="mx-auto mb-4 h-10 w-10 text-brand-primary-400" aria-hidden="true" />
                </motion.div>
                <p className="text-base font-bold text-white" aria-live="polite">Processando levantamento…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!isLoading && geoFiles.length === 0 && !isDragging && !isUploading && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center bg-zinc-950/70 px-6 text-center backdrop-blur-[2px]">
            <div className="geo-surface-raised max-w-sm rounded-lg p-8">
              <MapTrifold weight="duotone" className="mx-auto mb-4 h-12 w-12 text-zinc-400" aria-hidden="true" />
              <p className="text-lg font-bold text-white">Nenhum levantamento vetorial cadastrado</p>
              <p className="mx-auto mt-2 text-sm font-medium leading-relaxed text-zinc-400">
                Importe KML, KMZ, GeoJSON, Shapefile ZIP ou GeoPackage vetorial. Raster não é aceito como levantamento.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(primarySmallActionButtonClass, 'mt-6 w-full')}
              >
                <UploadSimple className="h-4 w-4" weight="bold" aria-hidden="true" />
                Selecionar levantamento vetorial
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-brand-border bg-white/90 p-4 dark:bg-zinc-900/80">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-zinc-950 dark:text-white">Camadas técnicas vetoriais processadas</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">O arquivo vetorial original é preservado; o mapa utiliza uma cópia normalizada em EPSG:4326.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {cacheStatus && <button type="button" className={secondarySmallActionButtonClass} disabled={!cacheStatus.orphanFiles || cacheCleanMutation.isPending} onClick={() => {
              if (window.confirm(`Remover somente ${cacheStatus.orphanFiles} arquivo(s) órfão(s) do cache? Levantamentos e documentos originais não serão apagados.`)) cacheCleanMutation.mutate();
            }}><Trash className="h-4 w-4" aria-hidden="true" /> Cache: {formatFileSize(cacheStatus.activeBytes)}{cacheStatus.orphanFiles ? ` · ${cacheStatus.orphanFiles} órfão(s)` : ''}</button>}
            <button
              type="button"
              className={secondarySmallActionButtonClass}
              onClick={() => {
                const bounds = L.latLngBounds([]);
                geojsonLayersRef.current.forEach((layer) => {
                  const current = layer.getBounds();
                  if (current.isValid()) bounds.extend(current);
                });
                if (bounds.isValid()) mapInstanceRef.current?.fitBounds(bounds, { padding: [42, 42], maxZoom: 18 });
              }}
            >
              <Crosshair className="h-4 w-4" />
              Enquadrar levantamento
            </button>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {geoFiles.map((layer) => {
            const needsCrs = layer.status === 'needs_crs';
            const needsReview = layer.status === 'needs_review';
            const statusLabel = layer.status === 'error' ? 'Erro'
              : needsCrs ? 'SRC necessário'
                : needsReview ? 'Revisão necessária'
                  : 'Processada';
            const selectedCrs = crsSelections[layer.documentId] || layer.sourceCrs || 'EPSG:4326';
            const crsSearch = (crsSearches[layer.documentId] || '').trim().toLocaleLowerCase('pt-BR');
            const filteredCrs = crsCatalog.filter((item) => !crsSearch
              || `${item.code} ${item.name} ${item.datum} ${item.zone || ''}`.toLocaleLowerCase('pt-BR').includes(crsSearch))
              .sort((left, right) => {
                const rank = (code: string) => favoriteCrs.includes(code) ? 0 : recentCrs.includes(code) ? 1 : 2;
                return rank(left.code) - rank(right.code) || left.code.localeCompare(right.code);
              });
            const crsPreview = crsPreviews[layer.documentId];
            return (
              <article key={layer.id || `${layer.fileName}-${layer.name}`} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/70">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{layer.name || layer.fileName}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {(layer.format || layer.type).toUpperCase()} · {layer.sourceEpsg ? `EPSG:${layer.sourceEpsg}` : layer.sourceCrs || 'SRC não informado'} · {layer.featureCount || 0} feição(ões) · {layer.vertexCount || 0} vértices
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">SRC: {layer.sourceDetection || 'origem não informada'} · confiança {layer.crsConfidence === 'high' ? 'alta' : layer.crsConfidence === 'medium' ? 'média' : 'baixa'}{layer.simplifiedForDisplay ? ' · visualização simplificada' : ''}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">Cache de precisão: {formatFileSize(layer.precisionCacheBytes || 0)} · visualização: {formatFileSize(layer.displayCacheBytes || 0)}</p>
                  </div>
                  <span className={cn('geo-badge-base shrink-0', layer.status === 'error' ? 'geo-badge-danger' : needsCrs || needsReview ? 'geo-badge-warning' : 'geo-badge-success')}>
                    {statusLabel}
                  </span>
                </div>

                {(layer.errorMessage || (layer.warnings && layer.warnings.length > 0)) && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                    {layer.errorMessage || layer.warnings?.join(' ')}
                  </div>
                )}
                {processingDocumentId === layer.documentId && processingProgress && (
                  <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100" role="status" aria-live="polite">
                    <div className="flex items-center justify-between gap-3">
                      <strong>{({ enviado: 'Enviado', validando: 'Validando', processando: 'Processando', reprojetando: 'Reprojetando', preparando_visualizacao: 'Preparando visualização', concluido: 'Concluído', erro: 'Erro' } as Record<string, string>)[processingProgress.stage] || processingProgress.stage}</strong>
                      <span>{Math.round(processingProgress.progress)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950"><div className="h-full bg-indigo-600 transition-[width]" style={{ width: `${Math.max(0, Math.min(100, processingProgress.progress))}%` }} /></div>
                    {!processingProgress.cancelRequested && !['concluido', 'erro'].includes(processingProgress.stage) && (
                      <button type="button" className="mt-2 font-semibold underline" onClick={async () => {
                        const response = await apiFetch(`/api/arquivos/geospatial/process/${layer.documentId}/cancel`, { method: 'POST' });
                        if (response.ok) setProcessingProgress((current) => current ? { ...current, cancelRequested: true } : current);
                      }}>Cancelar com segurança</button>
                    )}
                    {processingProgress.cancelRequested && <p className="mt-2">Cancelamento solicitado; a etapa atômica atual será finalizada antes da interrupção.</p>}
                  </div>
                )}
                {Boolean(layer.topologyIssues?.length) && (
                  <details className="mt-2 rounded-lg border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                    <summary className="cursor-pointer font-semibold text-zinc-800 dark:text-zinc-100">Validação topológica · {layer.topologyIssues?.length} ocorrência(s)</summary>
                    <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300">
                      {layer.topologyIssues?.slice(0, 25).map((issue, index) => <li key={`${issue.code}-${index}`}><strong>{issue.severity === 'blocking' ? 'Erro' : issue.severity === 'warning' ? 'Alerta' : 'Informação'}:</strong> {issue.message}{issue.featureIndex !== undefined ? ` · feição ${issue.featureIndex + 1}` : ''}</li>)}
                    </ul>
                  </details>
                )}
                {layer.projectId && layer.representativePoint && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {layer.projectLocation
                      ? `A localização cadastrada no projeto está a ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(layer.locationDifferenceM || 0)} m do ponto representativo desta camada.`
                      : 'O projeto ainda não possui latitude e longitude cadastradas.'}
                  </p>
                )}

                {(needsCrs || needsReview) && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300 sm:col-span-2">
                      Pesquisar SRC brasileiro
                      <input
                        type="search"
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        value={crsSearches[layer.documentId] || ''}
                        placeholder="Ex.: SIRGAS, SAD69, 31982 ou UTM 22S"
                        onChange={(event) => setCrsSearches((current) => ({ ...current, [layer.documentId]: event.target.value }))}
                      />
                    </label>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      Sistema de Referência de Coordenadas
                      <span className="mt-1 flex gap-1">
                        <select
                          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          value={selectedCrs}
                          onChange={(event) => {
                            setCrsSelections((current) => ({ ...current, [layer.documentId]: event.target.value }));
                            setCrsPreviews((current) => ({ ...current, [layer.documentId]: null }));
                          }}
                        >
                          {!filteredCrs.some((item) => item.code === selectedCrs) && <option value={selectedCrs}>{selectedCrs} · definição selecionada</option>}
                          {filteredCrs.map((item) => <option key={item.code} value={item.code}>{favoriteCrs.includes(item.code) ? '★ ' : recentCrs.includes(item.code) ? '◷ ' : ''}{item.code} · {item.name}</option>)}
                        </select>
                        <button type="button" className="w-10 rounded-lg border border-zinc-300 bg-white text-base text-amber-500 dark:border-zinc-700 dark:bg-zinc-900" aria-label={favoriteCrs.includes(selectedCrs) ? 'Remover SRC dos favoritos' : 'Adicionar SRC aos favoritos'} title={favoriteCrs.includes(selectedCrs) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} onClick={() => setFavoriteCrs((current) => current.includes(selectedCrs) ? current.filter((item) => item !== selectedCrs) : [selectedCrs, ...current])}>{favoriteCrs.includes(selectedCrs) ? '★' : '☆'}</button>
                      </span>
                    </label>
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      Ordem dos eixos
                      <select
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        value={axisSelections[layer.documentId] || 'longitude-latitude'}
                        onChange={(event) => {
                          setAxisSelections((current) => ({ ...current, [layer.documentId]: event.target.value as 'longitude-latitude' | 'latitude-longitude' }));
                          setCrsPreviews((current) => ({ ...current, [layer.documentId]: null }));
                        }}
                      >
                        <option value="longitude-latitude">Longitude / latitude</option>
                        <option value="latitude-longitude">Latitude / longitude</option>
                      </select>
                    </label>
                    <details className="rounded-lg border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900 sm:col-span-2">
                      <summary className="cursor-pointer font-semibold text-zinc-700 dark:text-zinc-200">Definição técnica manual (EPSG, PROJ ou WKT)</summary>
                      <textarea
                        className="mt-2 min-h-20 w-full rounded-lg border border-zinc-300 bg-white px-2 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
                        value={selectedCrs}
                        maxLength={16_384}
                        onChange={(event) => {
                          setCrsSelections((current) => ({ ...current, [layer.documentId]: event.target.value }));
                          setCrsPreviews((current) => ({ ...current, [layer.documentId]: null }));
                        }}
                        aria-label="Definição manual do sistema de referência"
                      />
                      <p className="mt-1 text-zinc-500">A definição é validada no backend e nunca altera o arquivo original.</p>
                    </details>
                    <button type="button" className={secondarySmallActionButtonClass} disabled={crsPreviewMutation.isPending} onClick={() => crsPreviewMutation.mutate(layer)}>
                      {crsPreviewMutation.isPending ? <Spinner className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Pré-visualizar resultado
                    </button>
                    <button type="button" className={primarySmallActionButtonClass} disabled={layerActionMutation.isPending || !crsPreview} onClick={() => layerActionMutation.mutate({ layer, action: 'process' })}>
                      Confirmar SRC e processar
                    </button>
                    {!crsPreview && <p className="text-xs text-zinc-500 sm:col-span-2">Gere a prévia para habilitar a confirmação e evitar posicionamentos acidentais.</p>}
                    {crsPreview && (
                      <div className={cn('rounded-lg border p-3 text-xs sm:col-span-2', crsPreview.layers.every((item) => item.overlapsBrazil) ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100')}>
                        <p className="font-semibold">Prévia sem gravação · {crsPreview.layers.length} camada(s)</p>
                        {crsPreview.layers.map((item) => (
                          <div key={item.name} className="mt-2">
                            <p><strong>{item.name}:</strong> centro {item.representativePoint.latitude.toFixed(6)}, {item.representativePoint.longitude.toFixed(6)} · bbox {item.bbox.map((value) => value.toFixed(5)).join(', ')}</p>
                            <p>{item.featureCount.toLocaleString('pt-BR')} feições · {item.vertexCount.toLocaleString('pt-BR')} vértices · {item.overlapsBrazil ? 'intercepta o Brasil' : 'fora da extensão esperada para o Brasil'}</p>
                            {item.axisComparison && <p className="mt-1">Comparação de eixos: {item.axisComparison.map((axis) => `${axis.axisOrder === 'longitude-latitude' ? 'lon/lat' : 'lat/lon'} = ${axis.representativePoint.latitude.toFixed(4)}, ${axis.representativePoint.longitude.toFixed(4)} (${axis.overlapsBrazil ? 'Brasil' : 'fora'})`).join(' · ')}</p>}
                            {item.warnings.length > 0 && <p className="mt-1">{item.warnings.join(' ')}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {layer.data && (
                    <button type="button" className={secondarySmallActionButtonClass} onClick={() => {
                      const bounds = geojsonLayersRef.current.get(layer.id)?.getBounds();
                      if (bounds?.isValid()) mapInstanceRef.current?.fitBounds(bounds, { padding: [48, 48], maxZoom: 19 });
                    }}>
                      <Crosshair className="h-4 w-4" /> Ir para o levantamento
                    </button>
                  )}
                  <button type="button" className={secondarySmallActionButtonClass} onClick={() => layerActionMutation.mutate({ layer, action: 'style', visible: layer.visible === false })}>
                    {layer.visible === false ? <Eye className="h-4 w-4" /> : <EyeSlash className="h-4 w-4" />}
                    {layer.visible === false ? 'Mostrar' : 'Ocultar'}
                  </button>
                  <label className="flex items-center gap-1 text-xs text-zinc-500">
                    Cor
                    <input type="color" value={layer.color || '#7c3aed'} onChange={(event) => layerActionMutation.mutate({ layer, action: 'style', color: event.target.value })} className="h-8 w-9 cursor-pointer rounded border-0 bg-transparent" />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-500">
                    Opacidade
                    <input type="range" min="0.1" max="1" step="0.05" value={layer.opacity ?? 0.75} onChange={(event) => layerActionMutation.mutate({ layer, action: 'style', opacity: Number(event.target.value) })} className="w-20" />
                    <span className="w-8 text-right">{Math.round((layer.opacity ?? 0.75) * 100)}%</span>
                  </label>
                  {!needsCrs && <button type="button" className={secondarySmallActionButtonClass} disabled={layerActionMutation.isPending} onClick={() => layerActionMutation.mutate({ layer, action: 'process' })}><Spinner className={cn('h-4 w-4', layerActionMutation.isPending && 'animate-spin')} /> Reconstruir cache</button>}
                  {layer.projectId && layer.representativePoint && (
                    <button type="button" className={secondarySmallActionButtonClass} onClick={() => void openLocationPreview(layer)}>
                      <MapPin className="h-4 w-4" /> Usar localização no projeto
                    </button>
                  )}
                  {layer.topologyIssues?.some((issue) => issue.repairAvailable) && (
                    <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-xs font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200" onClick={() => {
                      if (window.confirm('Aplicar somente reparos topológicos seguros? O original será preservado e será possível desfazer.')) layerActionMutation.mutate({ layer, action: 'repair' });
                    }}><CheckCircle className="h-4 w-4" /> Reparar</button>
                  )}
                  {Boolean(layer.repairs?.length) && <button type="button" className={secondarySmallActionButtonClass} onClick={() => layerActionMutation.mutate({ layer, action: 'undo-repair' })}>Desfazer reparo</button>}
                  <button type="button" className={secondarySmallActionButtonClass} onClick={() => void openTechnicalReport(layer)}><Eye className="h-4 w-4" /> Ver relatório</button>
                  <button type="button" className={secondarySmallActionButtonClass} onClick={() => void exportTechnicalReport(layer, 'json')}><FileText className="h-4 w-4" /> Relatório JSON</button>
                  <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 text-xs font-semibold text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200" onClick={() => void exportTechnicalReport(layer, 'pdf')}><FilePdf className="h-4 w-4" /> Relatório PDF</button>
                  <button type="button" className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" onClick={() => {
                    if (window.confirm('Remover a camada processada? O arquivo original será preservado.')) layerActionMutation.mutate({ layer, action: 'remove' });
                  }}>
                    <Trash className="h-4 w-4" /> Remover camada
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <Modal isOpen={Boolean(technicalReport)} onClose={() => setTechnicalReport(null)} title="Relatório técnico da importação" maxWidth="max-w-4xl">
        {technicalReport && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="font-semibold text-zinc-950 dark:text-white">{technicalReport.report.fileName} · {technicalReport.report.layer || technicalReport.layer.name}</p>
              <p className="mt-1 text-xs text-zinc-500">{technicalReport.report.relativePath || 'Caminho relativo indisponível'} · {technicalReport.report.importedAt ? new Date(technicalReport.report.importedAt).toLocaleString('pt-BR') : ''}</p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Resultado', technicalReport.report.result], ['Natureza', 'Levantamento vetorial'], ['Formato', technicalReport.report.format], ['Camadas vetoriais encontradas', (technicalReport.report.layersFound || []).join(', ')],
                ['Conteúdo raster ignorado', (technicalReport.report.ignoredRasterLayers || []).join(', ') || 'Nenhum'],
                ['SRC original', technicalReport.report.sourceCrs || 'Não informado'], ['Origem / confiança', `${technicalReport.report.sourceDetection || '—'} / ${technicalReport.report.crsConfidence || '—'}`], ['SRC normalizado', technicalReport.report.targetCrs],
                ['Ordem dos eixos', technicalReport.report.axisOrder], ['Feições', Number(technicalReport.report.featureCount || 0).toLocaleString('pt-BR')], ['Vértices', Number(technicalReport.report.vertexCount || 0).toLocaleString('pt-BR')],
                ['Tipos geométricos', (technicalReport.report.geometryTypes || []).join(', ')], ['Bounding box', JSON.stringify(technicalReport.report.bbox)], ['Ponto representativo', JSON.stringify(technicalReport.report.representativePoint)],
                ['Área aproximada', technicalReport.report.areaM2 ? `${Number(technicalReport.report.areaM2).toLocaleString('pt-BR')} m²` : '—'], ['Perímetro aproximado', technicalReport.report.perimeterM ? `${Number(technicalReport.report.perimeterM).toLocaleString('pt-BR')} m` : '—'], ['Distância ao projeto', technicalReport.report.distanceToProjectM == null ? '—' : `${Number(technicalReport.report.distanceToProjectM).toLocaleString('pt-BR')} m`],
                ['Arquivo original', formatFileSize(Number(technicalReport.report.originalSizeBytes || 0))], ['Cache de precisão', formatFileSize(Number(technicalReport.report.cache?.precisionBytes || 0))], ['Cache visual', formatFileSize(Number(technicalReport.report.cache?.displayBytes || 0))]
              ].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</dt><dd className="mt-1 break-words text-zinc-900 dark:text-zinc-100">{String(value || '—')}</dd></div>)}
            </dl>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><strong>Método métrico:</strong> {technicalReport.report.metricMethod || 'Não informado.'} Os valores aproximados não substituem cálculo topográfico no SRC projetado adequado.</div>
            {Boolean(technicalReport.report.warnings?.length) && <details className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800" open><summary className="cursor-pointer font-semibold">Alertas ({technicalReport.report.warnings?.length ?? 0})</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{(technicalReport.report.warnings ?? []).map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
            {Boolean(technicalReport.report.history?.length) && <details className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><summary className="cursor-pointer font-semibold">Histórico e proveniência ({technicalReport.report.history?.length})</summary><ol className="mt-2 space-y-2 text-xs">{technicalReport.report.history?.map((event) => <li key={event.id} className="border-l-2 border-indigo-300 pl-3"><strong>{event.description}</strong><br /><span className="text-zinc-500">{new Date(event.createdAt).toLocaleString('pt-BR')} · {event.type}</span></li>)}</ol></details>}
            <div className="flex flex-wrap justify-end gap-2"><button type="button" className={secondarySmallActionButtonClass} onClick={() => void exportTechnicalReport(technicalReport.layer, 'json')}>Exportar JSON</button><button type="button" className={primarySmallActionButtonClass} onClick={() => void exportTechnicalReport(technicalReport.layer, 'pdf')}>Exportar PDF</button></div>
          </div>
        )}
      </Modal>
      <Modal isOpen={Boolean(locationPreview)} onClose={() => setLocationPreview(null)} title="Confirmar localização do projeto" maxWidth="max-w-3xl">
        {locationPreview && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Revise o deslocamento antes de alterar somente o projeto <strong>{locationPreview.projectName}</strong>.</p>
            {locationPreview.distanceM != null && locationPreview.distanceM > locationWarningThresholdM && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"><strong>Atenção:</strong> a mudança é de {locationPreview.distanceM.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m e supera o limite configurado de {locationWarningThresholdM.toLocaleString('pt-BR')} m.</div>}
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Avisar quando o deslocamento superar (m)<input type="number" min="0" step="10" value={locationWarningThresholdM} onChange={(event) => setLocationWarningThresholdM(Math.max(0, Number(event.target.value) || 0))} className="mt-1 block w-40 rounded-lg border border-zinc-300 bg-white px-2 py-2 dark:border-zinc-700 dark:bg-zinc-900" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><p className="text-xs font-semibold uppercase text-zinc-500">Coordenada atual</p><p className="mt-1 font-mono text-sm">{locationPreview.current ? `${locationPreview.current.latitude.toFixed(8)}, ${locationPreview.current.longitude.toFixed(8)}` : 'Não cadastrada'}</p></div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30"><p className="text-xs font-semibold uppercase text-indigo-600">Coordenada proposta</p><p className="mt-1 font-mono text-sm">{locationPreview.proposed.latitude.toFixed(8)}, {locationPreview.proposed.longitude.toFixed(8)}</p></div>
            </div>
            <div className="h-56 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800" ref={(element) => {
              if (!element || element.dataset.initialized) return;
              element.dataset.initialized = 'true';
              const map = L.map(element, { attributionControl: false }).setView([locationPreview.proposed.latitude, locationPreview.proposed.longitude], 16);
              createNeutralGridLayer(map);
              L.marker([locationPreview.proposed.latitude, locationPreview.proposed.longitude]).addTo(map).bindTooltip('Proposta', { permanent: true });
              if (locationPreview.current) {
                L.circleMarker([locationPreview.current.latitude, locationPreview.current.longitude], { color: '#dc2626', radius: 7 }).addTo(map).bindTooltip('Atual', { permanent: true });
                const line = L.polyline([[locationPreview.current.latitude, locationPreview.current.longitude], [locationPreview.proposed.latitude, locationPreview.proposed.longitude]], { color: '#7c3aed', dashArray: '6 6' }).addTo(map);
                map.fitBounds(line.getBounds(), { padding: [30, 30], maxZoom: 18 });
              }
            }} />
            <dl className="grid gap-2 text-xs sm:grid-cols-2"><div><dt className="font-semibold">Arquivo/camada</dt><dd>{locationPreview.fileName} · {locationPreview.layerName}</dd></div><div><dt className="font-semibold">SRC</dt><dd>{locationPreview.sourceCrs || 'não informado'} → {locationPreview.targetCrs}</dd></div><div><dt className="font-semibold">Método</dt><dd>{locationPreview.method}</dd></div><div><dt className="font-semibold">Distância</dt><dd>{locationPreview.distanceM == null ? 'Não aplicável' : `${locationPreview.distanceM.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m`}</dd></div></dl>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={secondarySmallActionButtonClass} onClick={() => setLocationPreview(null)}>Cancelar</button>
              <button type="button" className={primarySmallActionButtonClass} onClick={() => { layerActionMutation.mutate({ layer: locationPreview.layer, action: 'use-location' }); setLocationPreview(null); }}><MapPin className="h-4 w-4" /> Confirmar localização</button>
              {locationPreview.current && <button type="button" className={secondarySmallActionButtonClass} onClick={() => { layerActionMutation.mutate({ layer: locationPreview.layer, action: 'undo-location' }); setLocationPreview(null); }}>Desfazer última alteração</button>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
