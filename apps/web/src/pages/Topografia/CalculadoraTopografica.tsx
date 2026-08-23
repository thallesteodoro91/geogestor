import { FormSelect } from '../../components/Form';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type SetStateAction } from 'react';
import {
  ArrowDown,
  ArrowCounterClockwise,
  ArrowClockwise,
  ArrowUp,
  Calculator,
  ClipboardText,
  Compass,
  Copy,
  DownloadSimple,
  FilePdf,
  Info,
  MapPin,
  PencilSimple,
  Plus,
  SelectionAll,
  Swap,
  Trash,
  UploadSimple,
  WarningCircle,
} from '@phosphor-icons/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { Layout } from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader';
import { CalculationHistory, type SavedCalculation } from '../../components/CalculationHistory';
import { MapBaseNotice } from '../../components/maps/MapBaseNotice';
import { createBaseTileLayer } from '../../utils/mapTiles';
import {
  calcularAreaGeodesicaElipsoidal,
  calcularAreaPoligono,
  calcularAzimutePlano,
  calcularDistanciaElipsoidal,
  calcularPerimetro,
  calcularPerimetroElipsoidal,
  decimaisParaGMS,
  gmsParaDecimais,
  metrosQuadradosParaHectares,
  parseCoordinateText,
  validarCoordenadas,
} from '../../core/topography';
import {
  BRAZIL_SPATIAL_REFERENCES,
  DEFAULT_SPATIAL_REFERENCE_CODE,
  SPATIAL_REFERENCE_STORAGE_KEY,
  calculateUtmMetadata,
  geographicToProjected,
  getSpatialReference,
  parseStoredSpatialReference,
  projectedToGeographic,
  serializeSpatialReference,
  suggestSpatialReference,
  suggestUtmZone,
  transformGeographicDatum,
  transformProjectedPositions,
  validateGeographicPositions,
  validateProjectedPositions,
  wgs84MapPositionToProjected,
  type CoordinateMode,
  type GeographicPosition,
  type ProjectedPosition,
  type SpatialIssue,
} from '../../core/topographySpatial';
import {
  exportPolygon,
  validatePolygonVertices,
  type ExportFormat,
} from '../../core/topographyExchange';
import { buildTopographyReportDefinition } from '../../core/topographyReport';
import { loadPdfMake } from '../../utils/loadPdfMake';
import { TechnicalResultBadge } from './TechnicalResultBadge';
import { VertexImportPreview } from './VertexImportPreview';
import { shouldHandleHistoryShortcut, useVertexHistory } from './useVertexHistory';
import { cn } from '../../utils/cn';
import {
  geoFieldClass,
  geoPanelClass,
} from '../../utils/geoTheme';
import {
  localNavigationBarClass,
  localNavigationButtonClass,
  localNavigationIconClass,
} from '../../utils/localNavigationStyles';
import converterTabIcon from '../../assets/magnific-icons/repeat_5184145.png';
import distanceTabIcon from '../../assets/magnific-icons/compass_5759049.png';
import polygonTabIcon from '../../assets/magnific-icons/select_6791337.png';

type MainTab = 'conversor' | 'distancia' | 'poligono';
type ConverterMode = 'gms-decimal' | 'decimal-gms' | 'geographic-projected' | 'projected-geographic';
type CoordinateKind = 'latitude' | 'longitude';
type Hemisphere = 'N' | 'S' | 'E' | 'W';
type PolygonMode = CoordinateMode;
interface VertexMetadata {
  code?: string;
  description?: string;
  altitude?: number;
  precision?: string;
  notes?: string;
}
type GeographicVertex = GeographicPosition & VertexMetadata;
type ProjectedVertex = ProjectedPosition & VertexMetadata;
interface VertexState {
  geographic: GeographicVertex[];
  projected: ProjectedVertex[];
}

const tabs: Array<{ id: MainTab; label: string; icon: string }> = [
  { id: 'conversor', label: 'Conversor GMS / Decimal', icon: converterTabIcon },
  { id: 'distancia', label: 'Distância e azimute', icon: distanceTabIcon },
  { id: 'poligono', label: 'Área e perímetro', icon: polygonTabIcon },
];
const converterModes: Array<{ id: ConverterMode; label: string }> = [
  { id: 'gms-decimal', label: 'GMS → decimal' },
  { id: 'decimal-gms', label: 'Decimal → GMS' },
  { id: 'geographic-projected', label: 'Latitude/longitude → X/Y' },
  { id: 'projected-geographic', label: 'X/Y → latitude/longitude' },
];

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
});
const coordinateFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 6,
  maximumFractionDigits: 8,
  useGrouping: false,
});
const projectedCoordinateFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const meterFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const squareMeterFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const hectareFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const kilometerFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const degreeFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const SPATIAL_FAVORITES_STORAGE_KEY = 'geogestor:topography:spatial-favorites';
const SPATIAL_RECENTS_STORAGE_KEY = 'geogestor:topography:spatial-recents';

function parseStoredStringList(value: string | null): string[] {
  try {
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

const vertexPalette = [
  {
    border: 'border-l-slate-500 dark:border-l-slate-400',
    marker: '#64748b',
  },
  {
    border: 'border-l-violet-500 dark:border-l-violet-400',
    marker: '#7c3aed',
  },
  {
    border: 'border-l-cyan-500 dark:border-l-cyan-400',
    marker: '#0891b2',
  },
  {
    badge: 'bg-amber-700 text-white ring-amber-800',
    border: 'border-l-amber-500 dark:border-l-amber-400',
    marker: '#d97706',
  },
  {
    border: 'border-l-emerald-500 dark:border-l-emerald-400',
    marker: '#059669',
  },
  {
    border: 'border-l-rose-500 dark:border-l-rose-400',
    marker: '#e11d48',
  },
] as const;

const panelClass = cn(
  geoPanelClass,
  'rounded-2xl border border-zinc-200/80 p-5 shadow-sm dark:border-zinc-800 sm:p-6'
);

const compactPanelClass = cn(
  geoPanelClass,
  'rounded-2xl border border-zinc-200/80 p-4 shadow-sm dark:border-zinc-800'
);

function parseNumericInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function coordinateError(value: string, kind: CoordinateKind): string | null {
  const parsed = parseNumericInput(value);
  if (parsed === null) return `Informe uma ${kind === 'latitude' ? 'latitude' : 'longitude'} numérica.`;
  const limit = kind === 'latitude' ? 90 : 180;
  if (parsed < -limit || parsed > limit) {
    return `Use um valor entre ${-limit} e ${limit}.`;
  }
  return null;
}

function finiteNumberError(value: string, label: string): string | null {
  return parseNumericInput(value) === null ? `Informe ${label} com um valor numérico.` : null;
}

interface NumberFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  describedBy?: string;
  compact?: boolean;
}

function NumberField({
  id,
  name,
  label,
  value,
  onChange,
  error,
  placeholder,
  describedBy,
  compact = false,
}: NumberFieldProps) {
  const errorId = `${id}-error`;
  const descriptionIds = [describedBy, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionIds}
        className={cn(
          geoFieldClass,
          'w-full rounded-lg border px-3 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-cyan-500/30 dark:text-white',
          compact ? 'py-2' : 'py-2.5',
          error
            ? 'border-red-400 focus-visible:border-red-500 dark:border-red-500'
            : 'border-zinc-200 focus-visible:border-cyan-600 dark:border-zinc-700'
        )}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs leading-5 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

interface ResultCardProps {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
  tone?: 'neutral' | 'cyan' | 'violet';
  compact?: boolean;
}

function ResultCard({ label, value, detail, accent = false, tone, compact = false }: ResultCardProps) {
  const resolvedTone = tone ?? (accent ? 'cyan' : 'neutral');
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'min-w-0 border-l-2',
        compact ? 'px-3 py-1' : 'px-4 py-2',
        resolvedTone === 'cyan' && 'border-l-cyan-500',
        resolvedTone === 'violet' && 'border-l-violet-500',
        resolvedTone === 'neutral' && 'border-l-zinc-300 dark:border-l-zinc-700'
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={cn(
          'mt-1 break-words font-semibold tabular-nums tracking-tight',
          compact ? 'text-2xl' : 'text-2xl sm:text-3xl',
          resolvedTone === 'cyan' && 'text-cyan-700 dark:text-cyan-300',
          resolvedTone === 'violet' && 'text-violet-700 dark:text-violet-300',
          resolvedTone === 'neutral' && 'text-zinc-950 dark:text-white'
        )}
      >
        {value}
      </p>
      <p className={cn('text-xs text-zinc-500 dark:text-zinc-400', compact ? 'mt-0.5 leading-4' : 'mt-1 leading-5')}>{detail}</p>
    </div>
  );
}

export function CalculadoraTopografica() {
  const [activeTab, setActiveTab] = useState<MainTab>('conversor');
  const [spatialReferenceCode, setSpatialReferenceCode] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_SPATIAL_REFERENCE_CODE;
    return parseStoredSpatialReference(window.localStorage.getItem(SPATIAL_REFERENCE_STORAGE_KEY));
  });
  const spatialReference = getSpatialReference(spatialReferenceCode)
    ?? getSpatialReference(DEFAULT_SPATIAL_REFERENCE_CODE)!;
  const [technicalStatus, setTechnicalStatus] = useState('');

  const [coordinateKind, setCoordinateKind] = useState<CoordinateKind>('latitude');
  const [converterMode, setConverterMode] = useState<ConverterMode>('gms-decimal');
  const [hemisphere, setHemisphere] = useState<Hemisphere>('S');
  const [degreesInput, setDegreesInput] = useState('23');
  const [minutesInput, setMinutesInput] = useState('32');
  const [secondsInput, setSecondsInput] = useState('41,2');
  const [decimalInput, setDecimalInput] = useState('-46,6333');
  const [pairLatitudeInput, setPairLatitudeInput] = useState('27°35\'40,2"S');
  const [pairLongitudeInput, setPairLongitudeInput] = useState('48°32\'51,7"W');
  const [converterProjectedInput, setConverterProjectedInput] = useState({ x: '742003,210', y: '6945275,215' });

  const [distanceMode, setDistanceMode] = useState<CoordinateMode>('geografica');
  const [distanceMapTarget, setDistanceMapTarget] = useState<'origin' | 'destination'>('origin');
  const [point1, setPoint1] = useState({ lat: '-23,5505', lng: '-46,6333' });
  const [point2, setPoint2] = useState({ lat: '-22,9068', lng: '-43,1729' });
  const [projectedPoint1, setProjectedPoint1] = useState({ x: '735000,000', y: '6940000,000' });
  const [projectedPoint2, setProjectedPoint2] = useState({ x: '736000,000', y: '6941000,000' });

  const [polygonMode, setPolygonMode] = useState<PolygonMode>('geografica');
  const {
    state: vertexState,
    commit: commitVertices,
    undo: undoVertices,
    redo: redoVertices,
    canUndo: canUndoVertices,
    canRedo: canRedoVertices,
  } = useVertexHistory<VertexState>({
    geographic: [
      { lat: -15.793889, lng: -47.882778 },
      { lat: -15.798889, lng: -47.882778 },
      { lat: -15.798889, lng: -47.877778 },
      { lat: -15.793889, lng: -47.877778 },
    ],
    projected: [],
  });
  const geographicVertices = vertexState.geographic;
  const projectedVertices = vertexState.projected;
  const setGeographicVertices = useCallback((updater: SetStateAction<GeographicVertex[]>) => {
    commitVertices((current) => ({
      ...current,
      geographic: typeof updater === 'function' ? updater(current.geographic) : updater,
    }));
  }, [commitVertices]);
  const setProjectedVertices = useCallback((updater: SetStateAction<ProjectedVertex[]>) => {
    commitVertices((current) => ({
      ...current,
      projected: typeof updater === 'function' ? updater(current.projected) : updater,
    }));
  }, [commitVertices]);
  const [newGeographicVertex, setNewGeographicVertex] = useState({ lat: '', lng: '' });
  const [newProjectedVertex, setNewProjectedVertex] = useState({ x: '', y: '' });
  const [bulkVerticesInput, setBulkVerticesInput] = useState('');
  const [bulkImportErrors, setBulkImportErrors] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<{ text: string; fileName: string } | null>(null);
  const [vertexValidationVisible, setVertexValidationVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'vertex'; index: number } | { type: 'all' } | null>(null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [vertexEditor, setVertexEditor] = useState<{
    index: number;
    first: string;
    second: string;
    code: string;
    description: string;
    altitude: string;
    precision: string;
    notes: string;
  } | null>(null);
  const [pendingSpatialReferenceCode, setPendingSpatialReferenceCode] = useState<string | null>(null);
  const [spatialPanelExpanded, setSpatialPanelExpanded] = useState(false);
  const [spatialSearch, setSpatialSearch] = useState('');
  const [favoriteSpatialReferences, setFavoriteSpatialReferences] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : parseStoredStringList(window.localStorage.getItem(SPATIAL_FAVORITES_STORAGE_KEY)));
  const [recentSpatialReferences, setRecentSpatialReferences] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [spatialReference.code];
    const stored = parseStoredStringList(window.localStorage.getItem(SPATIAL_RECENTS_STORAGE_KEY));
    return [spatialReference.code, ...stored.filter((code) => code !== spatialReference.code)].slice(0, 5);
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFields, setReportFields] = useState({
    title: 'Relatório técnico de Topografia',
    client: '',
    project: '',
    responsible: '',
  });

  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapInstanceRef = useRef<L.Map | null>(null);
  const geometryLayerRef = useRef<L.LayerGroup | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const distanceMapContainerRef = useRef<HTMLDivElement>(null);
  const distanceMapTargetRef = useRef(distanceMapTarget);
  const distanceMapInstanceRef = useRef<L.Map | null>(null);
  const distanceLayerRef = useRef<L.LayerGroup | null>(null);
  const distanceBaseTileLayerRef = useRef<L.TileLayer | null>(null);
  const [baseMapUnavailable, setBaseMapUnavailable] = useState(() => !navigator.onLine);

  useEffect(() => {
    distanceMapTargetRef.current = distanceMapTarget;
  }, [distanceMapTarget]);

  useEffect(() => {
    window.localStorage.setItem(
      SPATIAL_REFERENCE_STORAGE_KEY,
      serializeSpatialReference(spatialReference.code),
    );
  }, [spatialReference.code]);

  const filteredSpatialReferences = useMemo(() => {
    const normalized = spatialSearch.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return BRAZIL_SPATIAL_REFERENCES;
    return BRAZIL_SPATIAL_REFERENCES.filter((reference) =>
      `${reference.name} ${reference.code} ${reference.datum} ${reference.zone ?? ''}${reference.hemisphere ?? ''}`
        .toLocaleLowerCase('pt-BR').includes(normalized));
  }, [spatialSearch]);

  function toggleFavoriteSpatialReference() {
    setFavoriteSpatialReferences((current) => {
      const next = current.includes(spatialReference.code)
        ? current.filter((code) => code !== spatialReference.code)
        : [...current, spatialReference.code];
      window.localStorage.setItem(SPATIAL_FAVORITES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function selectSpatialReferenceCode(code: string) {
    setSpatialReferenceCode(code);
    setRecentSpatialReferences((current) => {
      const next = [code, ...current.filter((currentCode) => currentCode !== code)].slice(0, 5);
      window.localStorage.setItem(SPATIAL_RECENTS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (activeTab !== 'poligono' || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      if (!shouldHandleHistoryShortcut(event.target)) return;
      event.preventDefault();
      if (event.shiftKey) redoVertices();
      else undoVertices();
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [activeTab, redoVertices, undoVertices]);

  const reloadBaseMap = useCallback(() => {
    const map = miniMapInstanceRef.current;
    setBaseMapUnavailable(!navigator.onLine);
    if (map) {
      if (baseTileLayerRef.current) map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = createBaseTileLayer(map, () => setBaseMapUnavailable(true), () => setBaseMapUnavailable(false));
    }
    const distanceMap = distanceMapInstanceRef.current;
    if (distanceMap) {
      if (distanceBaseTileLayerRef.current) distanceMap.removeLayer(distanceBaseTileLayerRef.current);
      distanceBaseTileLayerRef.current = createBaseTileLayer(distanceMap, () => setBaseMapUnavailable(true), () => setBaseMapUnavailable(false));
    }
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

  const maxDegrees = coordinateKind === 'latitude' ? 90 : 180;
  const degrees = parseNumericInput(degreesInput);
  const minutes = parseNumericInput(minutesInput);
  const seconds = parseNumericInput(secondsInput);
  const decimal = parseNumericInput(decimalInput);
  const angularValueExceedsLimit =
    degrees === maxDegrees && ((minutes !== null && minutes > 0) || (seconds !== null && seconds > 0));
  const degreesError =
    degrees === null
      ? 'Informe os graus.'
      : !Number.isInteger(degrees) || degrees < 0 || degrees > maxDegrees
        ? `Use graus inteiros entre 0 e ${maxDegrees}.`
        : angularValueExceedsLimit
          ? `Em ${maxDegrees}°, minutos e segundos devem ser zero.`
        : null;
  const minutesError =
    minutes === null
      ? 'Informe os minutos.'
      : !Number.isInteger(minutes) || minutes < 0 || minutes >= 60
        ? 'Use minutos inteiros entre 0 e 59.'
        : null;
  const secondsError =
    seconds === null || seconds < 0 || seconds >= 60
      ? 'Use segundos entre 0 e menos de 60.'
      : null;
  const decimalError = coordinateError(decimalInput, coordinateKind);
  const gmsIsValid = !degreesError && !minutesError && !secondsError;
  const gmsDecimalResult = gmsIsValid
    ? gmsParaDecimais(degrees ?? 0, minutes ?? 0, seconds ?? 0) *
      (hemisphere === 'S' || hemisphere === 'W' ? -1 : 1)
    : null;
  const decimalGmsResult = !decimalError && decimal !== null ? decimaisParaGMS(Math.abs(decimal)) : null;
  const decimalHemisphere =
    decimal !== null
      ? coordinateKind === 'latitude'
        ? decimal < 0
          ? 'S'
          : 'N'
        : decimal < 0
          ? 'W'
          : 'E'
      : null;
  const parsedPairLatitude = parseCoordinateText(pairLatitudeInput, 'latitude');
  const parsedPairLongitude = parseCoordinateText(pairLongitudeInput, 'longitude');
  const parsedGeographicPair = parsedPairLatitude.value !== null && parsedPairLongitude.value !== null
    ? { lat: parsedPairLatitude.value, lng: parsedPairLongitude.value }
    : null;
  const projectedPair = (() => {
    if (!parsedGeographicPair || spatialReference.mode !== 'projetada') return null;
    try {
      return geographicToProjected(parsedGeographicPair, spatialReference.code);
    } catch {
      return null;
    }
  })();
  const parsedConverterProjected = {
    x: parseNumericInput(converterProjectedInput.x),
    y: parseNumericInput(converterProjectedInput.y),
  };
  const converterProjectedErrors = {
    x: finiteNumberError(converterProjectedInput.x, 'a coordenada X / Este'),
    y: finiteNumberError(converterProjectedInput.y, 'a coordenada Y / Norte'),
  };
  const geographicPairFromProjected = (() => {
    if (converterProjectedErrors.x || converterProjectedErrors.y || spatialReference.mode !== 'projetada') return null;
    try {
      return projectedToGeographic(
        { x: parsedConverterProjected.x ?? 0, y: parsedConverterProjected.y ?? 0 },
        spatialReference.code,
      );
    } catch {
      return null;
    }
  })();
  const suggestedPairZone = parsedGeographicPair ? suggestUtmZone(parsedGeographicPair.lng) : null;
  const converterResultAvailable = converterMode === 'gms-decimal'
    ? gmsDecimalResult !== null
    : converterMode === 'decimal-gms'
      ? decimalGmsResult !== null
      : converterMode === 'geographic-projected'
        ? projectedPair !== null
        : geographicPairFromProjected !== null;

  const pointErrors = {
    point1Lat: coordinateError(point1.lat, 'latitude'),
    point1Lng: coordinateError(point1.lng, 'longitude'),
    point2Lat: coordinateError(point2.lat, 'latitude'),
    point2Lng: coordinateError(point2.lng, 'longitude'),
  };
  const pointsAreValid = Object.values(pointErrors).every((error) => !error);
  const parsedPoint1 = { lat: parseNumericInput(point1.lat), lng: parseNumericInput(point1.lng) };
  const parsedPoint2 = { lat: parseNumericInput(point2.lat), lng: parseNumericInput(point2.lng) };
  const pointsAreEqual =
    pointsAreValid &&
    parsedPoint1.lat === parsedPoint2.lat &&
    parsedPoint1.lng === parsedPoint2.lng;
  const ellipsoidalDistance = pointsAreValid
    ? calcularDistanciaElipsoidal(
        parsedPoint1.lat ?? 0,
        parsedPoint1.lng ?? 0,
        parsedPoint2.lat ?? 0,
        parsedPoint2.lng ?? 0,
        spatialReference.datum,
      )
    : null;
  const geographicDistance = ellipsoidalDistance?.distance ?? null;
  const initialBearing = !pointsAreEqual ? ellipsoidalDistance?.initialBearing ?? null : null;
  const distanceResultIsValid = geographicDistance !== null && Number.isFinite(geographicDistance);
  const bearingResultIsValid = initialBearing !== null && Number.isFinite(initialBearing);
  const parsedProjectedPoint1 = { x: parseNumericInput(projectedPoint1.x), y: parseNumericInput(projectedPoint1.y) };
  const parsedProjectedPoint2 = { x: parseNumericInput(projectedPoint2.x), y: parseNumericInput(projectedPoint2.y) };
  const projectedPointsAreValid = Object.values({
    p1x: finiteNumberError(projectedPoint1.x, 'a coordenada X da origem'),
    p1y: finiteNumberError(projectedPoint1.y, 'a coordenada Y da origem'),
    p2x: finiteNumberError(projectedPoint2.x, 'a coordenada X do destino'),
    p2y: finiteNumberError(projectedPoint2.y, 'a coordenada Y do destino'),
  }).every((error) => !error);
  const planarDistance = projectedPointsAreValid
    ? Math.hypot(
        (parsedProjectedPoint2.x ?? 0) - (parsedProjectedPoint1.x ?? 0),
        (parsedProjectedPoint2.y ?? 0) - (parsedProjectedPoint1.y ?? 0),
      )
    : null;
  const gridBearing = projectedPointsAreValid
    ? calcularAzimutePlano(
        parsedProjectedPoint1.x ?? 0,
        parsedProjectedPoint1.y ?? 0,
        parsedProjectedPoint2.x ?? 0,
        parsedProjectedPoint2.y ?? 0,
      )
    : null;
  const projectedOriginGeographic = (() => {
    if (!projectedPointsAreValid || spatialReference.mode !== 'projetada') return null;
    try {
      return projectedToGeographic(
        { x: parsedProjectedPoint1.x ?? 0, y: parsedProjectedPoint1.y ?? 0 },
        spatialReference.code,
      );
    } catch {
      return null;
    }
  })();
  const projectedDestinationGeographic = (() => {
    if (!projectedPointsAreValid || spatialReference.mode !== 'projetada') return null;
    try {
      return projectedToGeographic(
        { x: parsedProjectedPoint2.x ?? 0, y: parsedProjectedPoint2.y ?? 0 },
        spatialReference.code,
      );
    } catch {
      return null;
    }
  })();
  const utmMetadata = projectedOriginGeographic
    ? calculateUtmMetadata(projectedOriginGeographic, spatialReference)
    : null;
  const destinationUtmMetadata = projectedDestinationGeographic
    ? calculateUtmMetadata(projectedDestinationGeographic, spatialReference)
    : null;
  const projectedGeodesicResult = projectedOriginGeographic && projectedDestinationGeographic
    ? calcularDistanciaElipsoidal(
        projectedOriginGeographic.lat,
        projectedOriginGeographic.lng,
        projectedDestinationGeographic.lat,
        projectedDestinationGeographic.lng,
        spatialReference.datum,
      )
    : null;
  const projectedGeodesicDistance = projectedGeodesicResult?.distance ?? null;
  const gridGroundDifference = planarDistance !== null && projectedGeodesicDistance !== null
    ? planarDistance - projectedGeodesicDistance
    : null;
  const activeVertexCount =
    polygonMode === 'geografica' ? geographicVertices.length : projectedVertices.length;
  const geographicInputErrors = {
    lat: coordinateError(newGeographicVertex.lat, 'latitude'),
    lng: coordinateError(newGeographicVertex.lng, 'longitude'),
  };
  const projectedInputErrors = {
    x: finiteNumberError(newProjectedVertex.x, 'a coordenada X (E)'),
    y: finiteNumberError(newProjectedVertex.y, 'a coordenada Y (N)'),
  };
  const activeVertices = polygonMode === 'geografica' ? geographicVertices : projectedVertices;
  const polygonValidation = useMemo(
    () => validatePolygonVertices(activeVertices, polygonMode),
    [activeVertices, polygonMode],
  );
  const spatialIssues = useMemo<SpatialIssue[]>(() => {
    if (polygonMode === 'geografica') {
      return validateGeographicPositions(geographicVertices, spatialReference);
    }
    return validateProjectedPositions(projectedVertices, spatialReference);
  }, [geographicVertices, polygonMode, projectedVertices, spatialReference]);
  const blockingSpatialIssue = spatialIssues.find((issue) => issue.severity === 'error');
  const polygonMetrics = useMemo(() => {
    if (polygonValidation.messages.length > 0 || blockingSpatialIssue) return null;
    if (polygonMode === 'geografica') {
      if (geographicVertices.length < 3) return null;
      const area = calcularAreaGeodesicaElipsoidal(geographicVertices, spatialReference.datum);
      const perimeter = calcularPerimetroElipsoidal(geographicVertices, spatialReference.datum);
      return Number.isFinite(area) && Number.isFinite(perimeter) ? { area, perimeter } : null;
    }

    if (projectedVertices.length < 3) return null;
    const area = calcularAreaPoligono(projectedVertices);
    const perimeter = calcularPerimetro(projectedVertices);
    return Number.isFinite(area) && Number.isFinite(perimeter) ? { area, perimeter } : null;
  }, [blockingSpatialIssue, geographicVertices, polygonMode, polygonValidation.messages.length, projectedVertices, spatialReference.datum]);

  const mapVertices = useMemo(() => {
    if (polygonMode === 'geografica') {
      const sourceCode = spatialReference.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
      return geographicVertices.map((vertex) => transformGeographicDatum(vertex, sourceCode, 'EPSG:4326'));
    }
    if (spatialReference.mode !== 'projetada') return [];
    try {
      return projectedVertices.map((vertex) => projectedToGeographic(vertex, spatialReference.code));
    } catch {
      return [];
    }
  }, [geographicVertices, polygonMode, projectedVertices, spatialReference.code, spatialReference.datum, spatialReference.mode]);

  useEffect(() => {
    if (activeTab !== 'distancia' || !distanceMapContainerRef.current || distanceMapInstanceRef.current) return;
    const map = L.map(distanceMapContainerRef.current, { zoomControl: true, attributionControl: true })
      .setView([-27.59487, -48.54822], 12);
    distanceBaseTileLayerRef.current = createBaseTileLayer(map, () => setBaseMapUnavailable(true), () => setBaseMapUnavailable(false));
    distanceMapInstanceRef.current = map;
    distanceLayerRef.current = L.layerGroup().addTo(map);
    map.on('click', (event) => {
      const target = distanceMapTargetRef.current;
      const updateGeographic = (position: GeographicPosition) => {
        const formatted = { lat: String(position.lat).replace('.', ','), lng: String(position.lng).replace('.', ',') };
        if (target === 'origin') setPoint1(formatted); else setPoint2(formatted);
      };
      if (distanceMode === 'geografica') {
        const targetCode = spatialReference.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
        updateGeographic(transformGeographicDatum({ lat: event.latlng.lat, lng: event.latlng.lng }, 'EPSG:4326', targetCode));
      } else if (spatialReference.mode === 'projetada') {
        const projected = wgs84MapPositionToProjected({ lat: event.latlng.lat, lng: event.latlng.lng }, spatialReference.code);
        const formatted = { x: String(projected.x).replace('.', ','), y: String(projected.y).replace('.', ',') };
        if (target === 'origin') setProjectedPoint1(formatted); else setProjectedPoint2(formatted);
      } else {
        setTechnicalStatus('Selecione um SRC projetado antes de definir X/Y pelo mapa.');
      }
    });
    window.requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      distanceMapInstanceRef.current = null;
      distanceLayerRef.current = null;
      distanceBaseTileLayerRef.current = null;
    };
  }, [activeTab, distanceMode, spatialReference.code, spatialReference.datum, spatialReference.mode]);

  useEffect(() => {
    const map = distanceMapInstanceRef.current;
    const layer = distanceLayerRef.current;
    if (!map || !layer || activeTab !== 'distancia') return;
    layer.clearLayers();
    const geographicCode = spatialReference.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
    let distanceMapPoints: GeographicPosition[] = [];
    try {
      if (distanceMode === 'geografica' && pointsAreValid) {
        distanceMapPoints = [
          transformGeographicDatum({ lat: parseNumericInput(point1.lat) ?? 0, lng: parseNumericInput(point1.lng) ?? 0 }, geographicCode, 'EPSG:4326'),
          transformGeographicDatum({ lat: parseNumericInput(point2.lat) ?? 0, lng: parseNumericInput(point2.lng) ?? 0 }, geographicCode, 'EPSG:4326'),
        ];
      } else if (distanceMode === 'projetada' && projectedPointsAreValid && spatialReference.mode === 'projetada') {
        distanceMapPoints = [
          projectedToGeographic({ x: parseNumericInput(projectedPoint1.x) ?? 0, y: parseNumericInput(projectedPoint1.y) ?? 0 }, spatialReference.code),
          projectedToGeographic({ x: parseNumericInput(projectedPoint2.x) ?? 0, y: parseNumericInput(projectedPoint2.y) ?? 0 }, spatialReference.code),
        ].map((position) => transformGeographicDatum(position, geographicCode, 'EPSG:4326'));
      }
    } catch {
      distanceMapPoints = [];
    }
    if (distanceMapPoints.length !== 2) return;
    const latLngs = distanceMapPoints.map((position) => L.latLng(position.lat, position.lng));
    latLngs.forEach((latLng, index) => {
      const marker = L.marker(latLng, {
        draggable: true,
        icon: L.divIcon({
          className: '',
          html: `<span aria-hidden="true" style="display:flex;width:28px;height:28px;align-items:center;justify-content:center;border:2px solid white;border-radius:9999px;background:${index === 0 ? '#0891b2' : '#7c3aed'};color:white;font:700 11px/1 sans-serif;box-shadow:0 1px 4px rgb(0 0 0 / .35)">${index === 0 ? 'A' : 'B'}</span>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
        title: `${index === 0 ? 'Origem' : 'Destino'}. Arraste para reposicionar.`,
      }).addTo(layer);
      marker.on('dragend', () => {
        const moved = marker.getLatLng();
        const targetCode = spatialReference.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
        if (distanceMode === 'geografica') {
          const position = transformGeographicDatum({ lat: moved.lat, lng: moved.lng }, 'EPSG:4326', targetCode);
          const formatted = { lat: String(position.lat).replace('.', ','), lng: String(position.lng).replace('.', ',') };
          if (index === 0) setPoint1(formatted); else setPoint2(formatted);
        } else {
          const projected = wgs84MapPositionToProjected({ lat: moved.lat, lng: moved.lng }, spatialReference.code);
          const formatted = { x: String(projected.x).replace('.', ','), y: String(projected.y).replace('.', ',') };
          if (index === 0) setProjectedPoint1(formatted); else setProjectedPoint2(formatted);
        }
      });
    });
    L.polyline(latLngs, { color: '#0e7490', weight: 3, dashArray: '8 6' }).addTo(layer);
    map.fitBounds(L.latLngBounds(latLngs), { padding: [28, 28], maxZoom: 18 });
  }, [activeTab, distanceMode, point1.lat, point1.lng, point2.lat, point2.lng, pointsAreValid, projectedPoint1.x, projectedPoint1.y, projectedPoint2.x, projectedPoint2.y, projectedPointsAreValid, spatialReference.code, spatialReference.datum, spatialReference.mode]);

  useEffect(() => {
    if (
      activeTab !== 'poligono' ||
      !miniMapContainerRef.current ||
      miniMapInstanceRef.current
    ) {
      return;
    }

    const map = L.map(miniMapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([-15.793889, -47.882778], 14);

    baseTileLayerRef.current = createBaseTileLayer(
      map,
      () => setBaseMapUnavailable(true),
      () => setBaseMapUnavailable(false)
    );

    miniMapInstanceRef.current = map;
    geometryLayerRef.current = L.layerGroup().addTo(map);
    map.on('click', (event) => {
      if (polygonMode === 'geografica') {
        const targetCode = spatialReference.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
        const position = transformGeographicDatum(
          { lat: event.latlng.lat, lng: event.latlng.lng },
          'EPSG:4326',
          targetCode,
        );
        setGeographicVertices((vertices) => [...vertices, position]);
        return;
      }
      if (spatialReference.mode !== 'projetada') return;
      try {
        const projected = wgs84MapPositionToProjected(
          { lat: event.latlng.lat, lng: event.latlng.lng },
          spatialReference.code,
        );
        setProjectedVertices((vertices) => [...vertices, projected]);
      } catch {
        setTechnicalStatus('Não foi possível transformar o ponto clicado para o SRC selecionado.');
      }
    });
    window.requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      miniMapInstanceRef.current = null;
      geometryLayerRef.current = null;
      baseTileLayerRef.current = null;
    };
  }, [activeTab, polygonMode, setGeographicVertices, setProjectedVertices, spatialReference.code, spatialReference.datum, spatialReference.mode]);

  useEffect(() => {
    const map = miniMapInstanceRef.current;
    const layerGroup = geometryLayerRef.current;
    if (!map || !layerGroup || activeTab !== 'poligono') return;

    layerGroup.clearLayers();
    if (mapVertices.length === 0) {
      map.setView([-15.793889, -47.882778], 14);
      return;
    }

    const latLngs = mapVertices.map(({ lat, lng }) => L.latLng(lat, lng));
    latLngs.forEach((latLng, index) => {
      const vertexColor = vertexPalette[index % vertexPalette.length].marker;
      const isSelected = selectedVertexIndex === index;
      const markerSize = isSelected ? 30 : 24;
      const marker = L.marker(latLng, {
        draggable: true,
        icon: L.divIcon({
          className: '',
          html: `<span aria-hidden="true" style="display:flex;width:${markerSize}px;height:${markerSize}px;align-items:center;justify-content:center;border:${isSelected ? 4 : 2}px solid white;border-radius:9999px;background:${vertexColor};color:white;font:700 10px/1 sans-serif;box-shadow:0 1px 7px rgb(0 0 0 / .45)">${index + 1}</span>`,
          iconSize: [markerSize, markerSize],
          iconAnchor: [markerSize / 2, markerSize / 2],
        }),
        title: `Vértice ${index + 1}. Arraste para reposicionar.`,
      })
        .bindTooltip(`V${index + 1}`, {
          permanent: false,
          direction: 'top',
          offset: [0, -5],
          opacity: 0.92,
        })
        .addTo(layerGroup);
      marker.on('click', () => setSelectedVertexIndex(index));
      marker.on('dragend', () => {
        const moved = marker.getLatLng();
        if (polygonMode === 'geografica') {
          const targetCode = spatialReference.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
          const geographic = transformGeographicDatum(
            { lat: moved.lat, lng: moved.lng },
            'EPSG:4326',
            targetCode,
          );
          setGeographicVertices((vertices) => vertices.map((vertex, vertexIndex) =>
            vertexIndex === index ? geographic : vertex));
          return;
        }
        try {
          const projected = wgs84MapPositionToProjected({ lat: moved.lat, lng: moved.lng }, spatialReference.code);
          setProjectedVertices((vertices) => vertices.map((vertex, vertexIndex) =>
            vertexIndex === index ? projected : vertex));
        } catch {
          setTechnicalStatus('O vértice não pôde ser reposicionado no SRC selecionado.');
        }
      });
    });

    if (latLngs.length >= 3) {
      L.polygon(latLngs, {
        color: '#0e7490',
        fillColor: '#22d3ee',
        fillOpacity: 0.2,
        weight: 3,
      }).addTo(layerGroup);
    } else if (latLngs.length === 2) {
      L.polyline(latLngs, { color: '#0e7490', weight: 3 }).addTo(layerGroup);
    }

    if (latLngs.length === 1) {
      map.setView(latLngs[0], 17);
    } else {
      map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24], maxZoom: 18 });
    }
  }, [activeTab, mapVertices, polygonMode, selectedVertexIndex, setGeographicVertices, setProjectedVertices, spatialReference.code, spatialReference.datum]);

  function changeCoordinateKind(kind: CoordinateKind) {
    setCoordinateKind(kind);
    setHemisphere(kind === 'latitude' ? 'S' : 'W');
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setTechnicalStatus(`${label} copiado.`);
    } catch {
      setTechnicalStatus('Não foi possível copiar automaticamente. Selecione o valor e copie manualmente.');
    }
  }

  function swapCoordinatePair() {
    setPairLatitudeInput(pairLongitudeInput);
    setPairLongitudeInput(pairLatitudeInput);
    setTechnicalStatus('Os campos foram invertidos. Confira os limites e hemisférios antes de usar.');
  }

  function swapDistancePoints() {
    setPoint1(point2);
    setPoint2(point1);
    setProjectedPoint1(projectedPoint2);
    setProjectedPoint2(projectedPoint1);
    setDistanceMapTarget((target) => target === 'origin' ? 'destination' : 'origin');
    setTechnicalStatus('Origem e destino foram invertidos.');
  }

  function requestSpatialReferenceChange(code: string) {
    if (code === spatialReference.code) return;
    setSpatialPanelExpanded(false);
    if (activeVertexCount === 0) {
      selectSpatialReferenceCode(code);
      return;
    }
    setPendingSpatialReferenceCode(code);
  }

  function applySpatialReferenceChange(strategy: 'transform' | 'reinterpret') {
    if (!pendingSpatialReferenceCode) return;
    const targetReference = getSpatialReference(pendingSpatialReferenceCode);
    if (!targetReference) return;
    try {
      if (strategy === 'transform') {
        if (polygonMode === 'projetada') {
          const transformed = transformProjectedPositions(projectedVertices, spatialReference, targetReference);
          commitVertices({
            geographic: transformed.geographic.map((position, index) => ({ ...projectedVertices[index], ...position } as GeographicVertex)),
            projected: transformed.projected.map((position, index) => ({ ...projectedVertices[index], ...position } as ProjectedVertex)),
          });
          setPolygonMode(transformed.mode);
        } else {
          const sourceGeographicCode = spatialReference.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
          const targetGeographicCode = targetReference.datum === 'SIRGAS 2000' ? 'EPSG:4674' : 'EPSG:4326';
          const transformedGeographic = geographicVertices.map((vertex) => ({
            ...vertex,
            ...transformGeographicDatum(vertex, sourceGeographicCode, targetGeographicCode),
          }));
          if (targetReference.mode === 'projetada') {
            setProjectedVertices(transformedGeographic.map((vertex) => ({ ...vertex, ...geographicToProjected(vertex, targetReference.code) })));
            setPolygonMode('projetada');
          } else {
            setGeographicVertices(transformedGeographic);
          }
        }
        setTechnicalStatus(`Coordenadas transformadas para ${targetReference.code}.`);
      } else {
        setTechnicalStatus(`Valores mantidos e reinterpretados em ${targetReference.code}. Confira fuso, hemisfério e datum.`);
      }
      selectSpatialReferenceCode(targetReference.code);
    } catch (error) {
      setTechnicalStatus(error instanceof Error ? error.message : 'Não foi possível transformar as coordenadas.');
    } finally {
      setPendingSpatialReferenceCode(null);
    }
  }

  function applySuggestedSpatialReference() {
    const firstMapPosition = mapVertices[0];
    if (!firstMapPosition) {
      setTechnicalStatus('Adicione uma coordenada válida para obter a sugestão automática de SRC.');
      return;
    }
    const suggestion = suggestSpatialReference(firstMapPosition.lng, firstMapPosition.lat, spatialReference.datum);
    if (!suggestion) {
      setTechnicalStatus('Não foi encontrado um SRC UTM cadastrado para essa posição.');
      return;
    }
    requestSpatialReferenceChange(suggestion.code);
  }

  function importBulkVertices(text = bulkVerticesInput) {
    if (!text.trim()) {
      setBulkImportErrors(['Cole ou selecione um arquivo com coordenadas.']);
      return;
    }
    setBulkImportErrors([]);
    setImportPreview({ text, fileName: 'Texto colado' });
  }

  async function handleVertexFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000 || !/\.(csv|txt)$/i.test(file.name)) {
      setBulkImportErrors(['Use um arquivo CSV ou TXT de até 2 MB.']);
      return;
    }
    const content = await file.text();
    setBulkVerticesInput(content);
    setImportPreview({ text: content, fileName: file.name });
  }

  function applyImportedVertices(vertices: Array<GeographicPosition | ProjectedPosition>, strategy: 'append' | 'replace') {
    if (polygonMode === 'geografica') {
      const imported = vertices as GeographicVertex[];
      setGeographicVertices((current) => strategy === 'append' ? [...current, ...imported] : imported);
    } else {
      const imported = vertices as ProjectedVertex[];
      setProjectedVertices((current) => strategy === 'append' ? [...current, ...imported] : imported);
    }
    setTechnicalStatus(`${vertices.length} vértice(s) importado(s) após a conferência.`);
    setImportPreview(null);
  }

  function downloadPolygon(format: ExportFormat) {
    try {
      const requiresWgs84 = format === 'kml' || format === 'geojson';
      const verticesForExport = requiresWgs84 ? mapVertices : activeVertices;
      const modeForExport = requiresWgs84 ? 'geografica' : polygonMode;
      const outputReference = requiresWgs84 ? getSpatialReference('EPSG:4326')! : spatialReference;
      const exported = exportPolygon(verticesForExport, modeForExport, format, outputReference, spatialReference);
      const url = URL.createObjectURL(new Blob([exported.content], { type: exported.mimeType }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `poligono-topografia-${spatialReference.code.replace(':', '-')}.${exported.extension}`;
      anchor.click();
      URL.revokeObjectURL(url);
      setTechnicalStatus(`Arquivo ${format.toUpperCase()} gerado com metadados do SRC.`);
    } catch (error) {
      setTechnicalStatus(error instanceof Error ? error.message : 'Não foi possível exportar o polígono.');
    }
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: MainTab) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = tabs.findIndex((tab) => tab.id === currentTab);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : event.key === 'ArrowRight'
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex].id;
    setActiveTab(nextTab);
    document.getElementById(`topography-tab-${nextTab}`)?.focus();
  }

  function handleConverterModeKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentMode: ConverterMode) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = converterModes.findIndex((mode) => mode.id === currentMode);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? converterModes.length - 1
        : event.key === 'ArrowRight'
          ? (currentIndex + 1) % converterModes.length
          : (currentIndex - 1 + converterModes.length) % converterModes.length;
    const nextMode = converterModes[nextIndex].id;
    setConverterMode(nextMode);
    document.getElementById(`converter-mode-${nextMode}`)?.focus();
  }

  function addVertex() {
    setVertexValidationVisible(true);
    if (polygonMode === 'geografica') {
      if (geographicInputErrors.lat || geographicInputErrors.lng) return;
      const lat = parseNumericInput(newGeographicVertex.lat);
      const lng = parseNumericInput(newGeographicVertex.lng);
      if (lat === null || lng === null || !validarCoordenadas(lat, lng)) return;
      setGeographicVertices((vertices) => [...vertices, { lat, lng }]);
      setNewGeographicVertex({ lat: '', lng: '' });
    } else {
      if (projectedInputErrors.x || projectedInputErrors.y) return;
      const x = parseNumericInput(newProjectedVertex.x);
      const y = parseNumericInput(newProjectedVertex.y);
      if (x === null || y === null) return;
      setProjectedVertices((vertices) => [...vertices, { x, y }]);
      setNewProjectedVertex({ x: '', y: '' });
    }
    setVertexValidationVisible(false);
  }

  function removeVertex(index: number) {
    if (polygonMode === 'geografica') {
      setGeographicVertices((vertices) => vertices.filter((_, vertexIndex) => vertexIndex !== index));
    } else {
      setProjectedVertices((vertices) => vertices.filter((_, vertexIndex) => vertexIndex !== index));
    }
  }

  function moveVertex(index: number, direction: -1 | 1) {
    const move = <T,>(vertices: T[]) => {
      const destination = index + direction;
      if (destination < 0 || destination >= vertices.length) return vertices;
      const reordered = [...vertices];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    };

    if (polygonMode === 'geografica') {
      setGeographicVertices(move);
    } else {
      setProjectedVertices(move);
    }
  }

  function locateVertex(index: number) {
    const position = mapVertices[index];
    setSelectedVertexIndex(index);
    if (position && miniMapInstanceRef.current) miniMapInstanceRef.current.setView([position.lat, position.lng], 18);
  }

  function openVertexEditor(index: number) {
    const vertex = activeVertices[index];
    if (!vertex) return;
    setSelectedVertexIndex(index);
    setVertexEditor({
      index,
      first: polygonMode === 'geografica' && 'lat' in vertex ? String(vertex.lat).replace('.', ',') : 'x' in vertex ? String(vertex.x).replace('.', ',') : '',
      second: polygonMode === 'geografica' && 'lng' in vertex ? String(vertex.lng).replace('.', ',') : 'y' in vertex ? String(vertex.y).replace('.', ',') : '',
      code: vertex.code ?? '',
      description: vertex.description ?? '',
      altitude: vertex.altitude === undefined ? '' : String(vertex.altitude).replace('.', ','),
      precision: vertex.precision ?? '',
      notes: vertex.notes ?? '',
    });
  }

  function saveVertexEditor() {
    if (!vertexEditor) return;
    const first = parseNumericInput(vertexEditor.first);
    const second = parseNumericInput(vertexEditor.second);
    const altitude = vertexEditor.altitude.trim() ? parseNumericInput(vertexEditor.altitude) : undefined;
    const coordinateIsInvalid = polygonMode === 'geografica'
      ? first === null || second === null || !validarCoordenadas(first, second)
      : first === null || second === null;
    if (coordinateIsInvalid || altitude === null) {
      setTechnicalStatus('Corrija as coordenadas e a altitude antes de salvar o vértice.');
      return;
    }
    const metadata: VertexMetadata = {
      code: vertexEditor.code.trim() || undefined,
      description: vertexEditor.description.trim() || undefined,
      altitude,
      precision: vertexEditor.precision.trim() || undefined,
      notes: vertexEditor.notes.trim() || undefined,
    };
    if (polygonMode === 'geografica') {
      setGeographicVertices((vertices) => vertices.map((vertex, index) =>
        index === vertexEditor.index ? { ...vertex, ...metadata, lat: first!, lng: second! } : vertex));
    } else {
      setProjectedVertices((vertices) => vertices.map((vertex, index) =>
        index === vertexEditor.index ? { ...vertex, ...metadata, x: first!, y: second! } : vertex));
    }
    setVertexEditor(null);
    setTechnicalStatus(`Vértice V${vertexEditor.index + 1} atualizado.`);
  }

  async function generateTechnicalReport() {
    if (!polygonMetrics) return;
    try {
      const pdfMake = await loadPdfMake();
      const definition = buildTopographyReportDefinition({
        ...reportFields,
        mode: polygonMode,
        reference: spatialReference,
        vertices: activeVertices,
        area: polygonMetrics.area,
        perimeter: polygonMetrics.perimeter,
        method: polygonMode === 'geografica' ? 'Karney / GeographicLib no elipsoide' : 'Gauss e distância plana no SRC projetado',
        warnings: [
          ...polygonValidation.messages,
          ...spatialIssues.map((issue) => `${issue.message} ${issue.fix}`),
        ],
      });
      pdfMake.createPdf(definition).download(`relatorio-topografia-${spatialReference.code.replace(':', '-')}.pdf`);
      setReportOpen(false);
      setTechnicalStatus('Relatório técnico PDF gerado.');
    } catch (error) {
      setTechnicalStatus(error instanceof Error ? error.message : 'Não foi possível gerar o relatório PDF.');
    }
  }

  function confirmVertexDeletion() {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'all') {
      if (polygonMode === 'geografica') setGeographicVertices([]);
      else setProjectedVertices([]);
    } else {
      removeVertex(deleteTarget.index);
    }

    setDeleteTarget(null);
  }

  function reopenCalculation(calculation: SavedCalculation) {
    const saved = calculation.entradas as Record<string, unknown>;
    const savedReference = saved.spatialReference as { code?: unknown } | undefined;
    if (typeof savedReference?.code === 'string' && getSpatialReference(savedReference.code)) {
      selectSpatialReferenceCode(savedReference.code);
    }
    if (saved.coordinateKind === 'latitude' || saved.coordinateKind === 'longitude') {
      setActiveTab('conversor');
      if (converterModes.some((mode) => mode.id === saved.converterMode)) setConverterMode(saved.converterMode as ConverterMode);
      setCoordinateKind(saved.coordinateKind);
      if (saved.hemisphere === 'N' || saved.hemisphere === 'S' || saved.hemisphere === 'E' || saved.hemisphere === 'W') setHemisphere(saved.hemisphere);
      if (typeof saved.degreesInput === 'string') setDegreesInput(saved.degreesInput);
      if (typeof saved.minutesInput === 'string') setMinutesInput(saved.minutesInput);
      if (typeof saved.secondsInput === 'string') setSecondsInput(saved.secondsInput);
      if (typeof saved.decimalInput === 'string') setDecimalInput(saved.decimalInput);
      if (typeof saved.pairLatitudeInput === 'string') setPairLatitudeInput(saved.pairLatitudeInput);
      if (typeof saved.pairLongitudeInput === 'string') setPairLongitudeInput(saved.pairLongitudeInput);
      if (saved.converterProjectedInput) {
        const projected = saved.converterProjectedInput as { x?: unknown; y?: unknown };
        if (typeof projected.x === 'string' && typeof projected.y === 'string') setConverterProjectedInput({ x: projected.x, y: projected.y });
      }
      return;
    }
    if (saved.point1 && saved.point2) {
      const first = saved.point1 as { lat?: unknown; lng?: unknown };
      const second = saved.point2 as { lat?: unknown; lng?: unknown };
      if (typeof first.lat === 'string' && typeof first.lng === 'string' && typeof second.lat === 'string' && typeof second.lng === 'string') {
        setActiveTab('distancia');
        setPoint1({ lat: first.lat, lng: first.lng });
        setPoint2({ lat: second.lat, lng: second.lng });
        if (saved.distanceMode === 'projetada') setDistanceMode('projetada');
        if (saved.projectedPoint1 && saved.projectedPoint2) {
          const projectedFirst = saved.projectedPoint1 as { x?: unknown; y?: unknown };
          const projectedSecond = saved.projectedPoint2 as { x?: unknown; y?: unknown };
          if (typeof projectedFirst.x === 'string' && typeof projectedFirst.y === 'string' && typeof projectedSecond.x === 'string' && typeof projectedSecond.y === 'string') {
            setProjectedPoint1({ x: projectedFirst.x, y: projectedFirst.y });
            setProjectedPoint2({ x: projectedSecond.x, y: projectedSecond.y });
          }
        }
      }
      return;
    }
    if ((saved.polygonMode === 'geografica' || saved.polygonMode === 'projetada') && Array.isArray(saved.vertices)) {
      setActiveTab('poligono');
      setPolygonMode(saved.polygonMode);
      if (saved.polygonMode === 'geografica') setGeographicVertices(saved.vertices as GeographicVertex[]);
      else setProjectedVertices(saved.vertices as ProjectedVertex[]);
    }
  }

  return (
    <Layout compactBottom>
      <PageHeader
        eyebrow="Ferramentas técnicas"
        title="Topografia"
        description="Conversão de coordenadas e cálculos de apoio para conferência. Verifique o SRC, o datum e o método exigido antes de usar resultados em peças técnicas."
        className="mb-4"
        descriptionClassName="max-w-none"
        navigationClassName="mt-4"
        navigation={
          <div className={cn(localNavigationBarClass, 'flex min-w-0 items-center gap-3')}>
            <div
              role="tablist"
              aria-label="Ferramentas de topografia"
              className="flex min-w-max items-center gap-3"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  id={`topography-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`topography-panel-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                  className={localNavigationButtonClass(activeTab === tab.id, 'field')}
                >
                  <span
                    aria-hidden="true"
                    className={localNavigationIconClass(
                      activeTab === tab.id,
                      'field',
                      'overflow-hidden bg-transparent p-0 dark:bg-transparent',
                    )}
                  >
                    <img
                      src={tab.icon}
                      alt=""
                      width={26}
                      height={26}
                      className="h-[26px] w-[26px] object-contain"
                    />
                  </span>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="ml-auto shrink-0">
              <CalculationHistory
                type="topografico"
                suggestedName={activeTab === 'conversor' ? 'Conversão de coordenadas' : activeTab === 'distancia' ? 'Distância e azimute' : 'Área e perímetro'}
                inputs={activeTab === 'conversor'
                  ? { spatialReference, converterMode, coordinateKind, hemisphere, degreesInput, minutesInput, secondsInput, decimalInput, pairLatitudeInput, pairLongitudeInput, converterProjectedInput }
                  : activeTab === 'distancia'
                    ? { spatialReference, distanceMode, point1, point2, projectedPoint1, projectedPoint2 }
                    : { spatialReference, polygonMode, vertices: polygonMode === 'geografica' ? geographicVertices : projectedVertices }}
                result={activeTab === 'conversor'
                  ? converterMode === 'gms-decimal'
                    ? { decimal: gmsDecimalResult }
                    : converterMode === 'decimal-gms'
                      ? { gms: decimalGmsResult, hemisphere: decimalHemisphere }
                      : converterMode === 'geographic-projected'
                        ? projectedPair
                        : geographicPairFromProjected
                  : activeTab === 'distancia'
                    ? distanceMode === 'geografica'
                      ? { distanceMeters: geographicDistance, initialBearingDegrees: initialBearing }
                      : { distanceMeters: planarDistance, gridBearingDegrees: gridBearing, utmMetadata }
                    : polygonMetrics}
                unit={activeTab === 'distancia' ? 'm e graus' : activeTab === 'poligono' ? 'm², ha, km² e m' : 'graus e metros'}
                method={activeTab === 'conversor' ? `${converterModes.find((mode) => mode.id === converterMode)?.label} · ${spatialReference.code}` : activeTab === 'distancia' ? `${distanceMode === 'geografica' ? 'Karney / GeographicLib' : 'Plano/quadrícula'} · ${spatialReference.code}` : polygonMode === 'geografica' ? `Karney / GeographicLib · ${spatialReference.datum}` : `Gauss/Shoelace · ${spatialReference.code}`}
                disabled={activeTab === 'conversor' ? !converterResultAvailable : activeTab === 'distancia' ? distanceMode === 'geografica' ? !distanceResultIsValid : planarDistance === null : !polygonMetrics}
                onReopen={reopenCalculation}
              />
            </div>
          </div>
        }
      />

      <section className="mb-4 flex w-full min-w-0 flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm sm:w-fit sm:max-w-full dark:border-zinc-800 dark:bg-zinc-900" aria-labelledby="spatial-reference-title">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <MapPin className="h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="spatial-reference-title" className="sr-only">Referência espacial compartilhada</h2>
            <p className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-100" translate="no">
              {spatialReference.datum} · {spatialReference.zone ? `UTM ${spatialReference.zone}${spatialReference.hemisphere}` : 'Geográfico'} · {spatialReference.code}
            </p>
          </div>
        </div>
        {spatialIssues.length > 0 && <span className={cn('inline-flex min-h-7 items-center gap-1 rounded-full px-2 text-[10px] font-bold uppercase', blockingSpatialIssue ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200')}><WarningCircle className="h-3.5 w-3.5" aria-hidden="true" />{blockingSpatialIssue ? 'Incompatível' : 'Conferir SRC'}</span>}
        <button type="button" aria-haspopup="dialog" aria-expanded={spatialPanelExpanded} onClick={() => setSpatialPanelExpanded(true)} className="min-h-9 rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Configurar</button>
        <p className="sr-only" role="status" aria-live="polite">{technicalStatus}</p>
      </section>
      {technicalStatus && <p className="mb-3 text-xs font-medium text-emerald-700 dark:text-emerald-300" aria-hidden="true">{technicalStatus}</p>}

      {activeTab === 'conversor' && (
        <section
          id="topography-panel-conversor"
          role="tabpanel"
          aria-labelledby="topography-tab-conversor"
          tabIndex={0}
          className={cn(panelClass, 'border-l-4 border-l-violet-500 dark:border-l-violet-400')}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-400/20"><Calculator className="h-5 w-5" weight="bold" aria-hidden="true" /></span><div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">Conversor de coordenadas</p><h2 className="mt-0.5 text-lg font-semibold text-zinc-950 dark:text-white">{converterModes.find((mode) => mode.id === converterMode)?.label}</h2></div></div>
          </div>
          <div role="tablist" aria-label="Tipo de conversão" className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            {converterModes.map((mode) => <button key={mode.id} id={`converter-mode-${mode.id}`} type="button" role="tab" aria-selected={converterMode === mode.id} aria-controls="converter-workspace" tabIndex={converterMode === mode.id ? 0 : -1} onKeyDown={(event) => handleConverterModeKeyDown(event, mode.id)} onClick={() => setConverterMode(mode.id)} className={cn('min-h-10 rounded-lg px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40', converterMode === mode.id ? 'bg-violet-700 text-white shadow-sm dark:bg-violet-600' : 'text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800')}>{mode.label}</button>)}
          </div>

          <div id="converter-workspace" role="tabpanel" aria-labelledby={`converter-mode-${converterMode}`} aria-live="polite" className="mt-5 min-w-0">
            {converterMode === 'gms-decimal' && <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,.6fr)]"><div><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="gms-coordinate-kind" className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Tipo de coordenada</label><FormSelect id="gms-coordinate-kind" name="gms-coordinate-kind" value={coordinateKind} autoComplete="off" onChange={(event) => changeCoordinateKind(event.target.value as CoordinateKind)} className={cn(geoFieldClass, 'w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-700')}><option value="latitude">Latitude</option><option value="longitude">Longitude</option></FormSelect></div><div><label htmlFor="gms-hemisphere" className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Hemisfério</label><FormSelect id="gms-hemisphere" name="gms-hemisphere" value={hemisphere} autoComplete="off" onChange={(event) => setHemisphere(event.target.value as Hemisphere)} className={cn(geoFieldClass, 'w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-700')}><option value={coordinateKind === 'latitude' ? 'N' : 'E'}>{coordinateKind === 'latitude' ? 'Norte (N)' : 'Leste (E)'}</option><option value={coordinateKind === 'latitude' ? 'S' : 'W'}>{coordinateKind === 'latitude' ? 'Sul (S)' : 'Oeste (W)'}</option></FormSelect></div></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><NumberField id="gms-degrees" name="gms-degrees" label={`Graus · ° (0–${maxDegrees})`} value={degreesInput} onChange={setDegreesInput} error={degreesError} /><NumberField id="gms-minutes" name="gms-minutes" label="Minutos · ′ (0–59)" value={minutesInput} onChange={setMinutesInput} error={minutesError} /><NumberField id="gms-seconds" name="gms-seconds" label="Segundos · ″ (0–<60)" value={secondsInput} onChange={setSecondsInput} error={secondsError} /></div></div><div><ResultCard label="Coordenada decimal" value={gmsDecimalResult === null ? '—' : `${coordinateFormatter.format(gmsDecimalResult)}°`} detail={gmsDecimalResult === null ? 'Corrija os campos para calcular.' : `Hemisfério ${hemisphere}.`} tone="violet" />{gmsDecimalResult !== null && <button type="button" onClick={() => copyText(String(gmsDecimalResult), 'Coordenada decimal')} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-700"><Copy className="h-4 w-4" aria-hidden="true" />Copiar resultado</button>}</div></div>}

            {converterMode === 'decimal-gms' && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.7fr)]"><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="decimal-coordinate-kind" className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Tipo de coordenada</label><FormSelect id="decimal-coordinate-kind" name="decimal-coordinate-kind" value={coordinateKind} autoComplete="off" onChange={(event) => changeCoordinateKind(event.target.value as CoordinateKind)} className={cn(geoFieldClass, 'w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-700')}><option value="latitude">Latitude</option><option value="longitude">Longitude</option></FormSelect></div><NumberField id="decimal-coordinate" name="decimal-coordinate" label={coordinateKind === 'latitude' ? 'Latitude decimal (−90 a 90)' : 'Longitude decimal (−180 a 180)'} value={decimalInput} onChange={setDecimalInput} error={decimalError} placeholder={coordinateKind === 'latitude' ? '-27,5945' : '-48,5477'} /></div><div><ResultCard label="Coordenada em GMS" value={decimalGmsResult && decimalHemisphere ? `${numberFormatter.format(decimalGmsResult.graus)}° ${numberFormatter.format(decimalGmsResult.minutos)}′ ${numberFormatter.format(decimalGmsResult.segundos)}″ ${decimalHemisphere}` : '—'} detail={decimalGmsResult ? 'Conversão angular; não altera datum ou SRC.' : 'Corrija o valor decimal para converter.'} tone="cyan" /></div></div>}

            {converterMode === 'geographic-projected' && <div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-zinc-500 dark:text-zinc-400">Aceita decimal ou GMS com hemisfério. Usa <span translate="no">{spatialReference.code}</span>.</p><button type="button" onClick={swapCoordinatePair} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-700"><Swap className="h-4 w-4" aria-hidden="true" />Inverter campos</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><NumberField id="coordinate-pair-latitude" name="coordinate-pair-latitude" label="Latitude" value={pairLatitudeInput} onChange={setPairLatitudeInput} error={parsedPairLatitude.error} placeholder={'27°35\'40,2"S'} /><NumberField id="coordinate-pair-longitude" name="coordinate-pair-longitude" label="Longitude" value={pairLongitudeInput} onChange={setPairLongitudeInput} error={parsedPairLongitude.error} placeholder={'48°32\'51,7"W'} /></div><div className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800"><ResultCard compact label="Latitude decimal" value={parsedGeographicPair ? `${coordinateFormatter.format(parsedGeographicPair.lat)}°` : '—'} detail={parsedPairLatitude.error ?? 'Entrada interpretada.'} accent /><ResultCard compact label="Longitude decimal" value={parsedGeographicPair ? `${coordinateFormatter.format(parsedGeographicPair.lng)}°` : '—'} detail={suggestedPairZone ? `Fuso UTM sugerido: ${suggestedPairZone}${parsedGeographicPair && parsedGeographicPair.lat >= 0 ? 'N' : 'S'}` : parsedPairLongitude.error ?? 'Entrada interpretada.'} tone="violet" /><ResultCard compact label="X / Este" value={projectedPair ? `${projectedCoordinateFormatter.format(projectedPair.x)} m` : '—'} detail={spatialReference.mode === 'projetada' ? spatialReference.code : 'Configure um SRC projetado.'} /><ResultCard compact label="Y / Norte" value={projectedPair ? `${projectedCoordinateFormatter.format(projectedPair.y)} m` : '—'} detail={spatialReference.mode === 'projetada' ? `${spatialReference.zone}${spatialReference.hemisphere}` : 'Transformação indisponível.'} /></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!projectedPair} onClick={() => projectedPair && copyText(`${projectedPair.x}, ${projectedPair.y}`, 'Par projetado')} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700"><Copy className="h-4 w-4" aria-hidden="true" />Copiar X/Y</button></div></div>}

            {converterMode === 'projected-geographic' && <div><p className="text-sm text-zinc-500 dark:text-zinc-400">Informe X/Y no <span translate="no">{spatialReference.code}</span>. A transformação respeita datum, fuso e hemisfério.</p>{spatialReference.mode !== 'projetada' && <div role="alert" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Configure um SRC projetado antes de converter X/Y.</div>}<div className="mt-4 grid gap-4 sm:grid-cols-2"><NumberField id="converter-projected-x" name="converter-projected-x" label="X / Este (m)" value={converterProjectedInput.x} onChange={(x) => setConverterProjectedInput((current) => ({ ...current, x }))} error={converterProjectedErrors.x} /><NumberField id="converter-projected-y" name="converter-projected-y" label="Y / Norte (m)" value={converterProjectedInput.y} onChange={(y) => setConverterProjectedInput((current) => ({ ...current, y }))} error={converterProjectedErrors.y} /></div><div className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 sm:grid-cols-2 dark:border-zinc-800"><ResultCard label="Latitude" value={geographicPairFromProjected ? `${coordinateFormatter.format(geographicPairFromProjected.lat)}°` : '—'} detail={`${spatialReference.datum} · ${spatialReference.code}`} accent /><ResultCard label="Longitude" value={geographicPairFromProjected ? `${coordinateFormatter.format(geographicPairFromProjected.lng)}°` : '—'} detail="Coordenada geográfica transformada." tone="violet" /></div><button type="button" disabled={!geographicPairFromProjected} onClick={() => geographicPairFromProjected && copyText(`${geographicPairFromProjected.lat}, ${geographicPairFromProjected.lng}`, 'Par geográfico')} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-semibold disabled:opacity-40 dark:border-zinc-700"><Copy className="h-4 w-4" aria-hidden="true" />Copiar latitude/longitude</button></div>}
          </div>
        </section>
      )}

      {activeTab === 'distancia' && (
        <section
          id="topography-panel-distancia"
          role="tabpanel"
          aria-labelledby="topography-tab-distancia"
          tabIndex={0}
          className={panelClass}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Compass className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Distância e direção</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Escolha entre cálculo elipsoidal e cálculo plano de quadrícula.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-zinc-200 p-1 dark:border-zinc-700" aria-label="Tipo de coordenada para distância">
                {([['geografica', 'Latitude/longitude'], ['projetada', 'X/Y projetado']] as const).map(([mode, label]) => (
                  <button key={mode} type="button" aria-pressed={distanceMode === mode} onClick={() => setDistanceMode(mode)} className={cn('min-h-9 rounded-lg px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-cyan-500/40', distanceMode === mode ? 'bg-cyan-700 text-white' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800')}>{label}</button>
                ))}
              </div>
              <button type="button" onClick={swapDistancePoints} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:border-zinc-700 dark:hover:bg-zinc-800"><Swap className="h-4 w-4" aria-hidden="true" />Inverter origem/destino</button>
            </div>
          </div>

          {distanceMode === 'projetada' && spatialReference.mode !== 'projetada' && (
            <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><WarningCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Selecione um SRC projetado UTM para interpretar X/Y e calcular metadados de quadrícula.</div>
          )}

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {[
              { title: 'Ponto de partida', tone: 'border-l-cyan-400 dark:border-l-cyan-300', geographic: point1, setGeographic: setPoint1, projected: projectedPoint1, setProjected: setProjectedPoint1, prefix: 'point-1' },
              { title: 'Ponto de destino', tone: 'border-l-violet-400 dark:border-l-violet-300', geographic: point2, setGeographic: setPoint2, projected: projectedPoint2, setProjected: setProjectedPoint2, prefix: 'point-2' },
            ].map((entry) => (
              <fieldset key={entry.prefix} className={cn('rounded-xl border border-l-4 border-zinc-200 p-4 shadow-sm dark:border-zinc-800', entry.tone)}>
                <legend className="px-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100"><span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />{entry.title}</span></legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {distanceMode === 'geografica' ? (
                    <>
                      <NumberField id={`${entry.prefix}-latitude`} name={`${entry.prefix}-latitude`} label="Latitude (−90 a 90)" value={entry.geographic.lat} onChange={(lat) => entry.setGeographic((point) => ({ ...point, lat }))} error={coordinateError(entry.geographic.lat, 'latitude')} />
                      <NumberField id={`${entry.prefix}-longitude`} name={`${entry.prefix}-longitude`} label="Longitude (−180 a 180)" value={entry.geographic.lng} onChange={(lng) => entry.setGeographic((point) => ({ ...point, lng }))} error={coordinateError(entry.geographic.lng, 'longitude')} />
                    </>
                  ) : (
                    <>
                      <NumberField id={`${entry.prefix}-x`} name={`${entry.prefix}-x`} label="X / Este (m)" value={entry.projected.x} onChange={(x) => entry.setProjected((point) => ({ ...point, x }))} error={finiteNumberError(entry.projected.x, 'a coordenada X')} />
                      <NumberField id={`${entry.prefix}-y`} name={`${entry.prefix}-y`} label="Y / Norte (m)" value={entry.projected.y} onChange={(y) => entry.setProjected((point) => ({ ...point, y }))} error={finiteNumberError(entry.projected.y, 'a coordenada Y')} />
                    </>
                  )}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/60">
              <div><p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Definir pontos pelo mapa</p><p className="mt-0.5 text-xs text-zinc-500">Clique para definir o ponto selecionado ou arraste os marcadores A/B.</p></div>
              <div className="inline-flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700" aria-label="Ponto definido pelo próximo clique no mapa">
                <button type="button" aria-pressed={distanceMapTarget === 'origin'} onClick={() => setDistanceMapTarget('origin')} className={cn('min-h-8 rounded-md px-2.5 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-cyan-500/40', distanceMapTarget === 'origin' ? 'bg-cyan-700 text-white' : 'text-zinc-600 dark:text-zinc-300')}>Origem A</button>
                <button type="button" aria-pressed={distanceMapTarget === 'destination'} onClick={() => setDistanceMapTarget('destination')} className={cn('min-h-8 rounded-md px-2.5 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-violet-500/40', distanceMapTarget === 'destination' ? 'bg-violet-700 text-white' : 'text-zinc-600 dark:text-zinc-300')}>Destino B</button>
              </div>
            </div>
            <div className="relative h-[300px] bg-zinc-100 dark:bg-zinc-900">
              <MapBaseNotice unavailable={baseMapUnavailable} onRetry={reloadBaseMap} />
              <div ref={distanceMapContainerRef} role="region" aria-label="Mapa dos pontos de origem e destino" className="h-full w-full" />
            </div>
          </div>

          {distanceMode === 'geografica' && pointsAreEqual && (
            <div role="status" className="mt-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><WarningCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Os pontos são coincidentes. A distância é zero e o azimute não pode ser determinado.</div>
          )}

          <div className="mt-5 grid gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800 md:grid-cols-2">
            {distanceMode === 'geografica' ? (
              <>
                <ResultCard label="Distância geodésica" value={distanceResultIsValid ? `${kilometerFormatter.format((geographicDistance ?? 0) / 1000)} km` : '—'} detail={distanceResultIsValid ? `${meterFormatter.format(geographicDistance ?? 0)} m · Karney / GeographicLib sobre ${spatialReference.datum}` : 'Corrija as coordenadas para calcular.'} accent />
                <ResultCard label="Azimute geodésico inicial" value={bearingResultIsValid ? `${degreeFormatter.format(initialBearing ?? 0)}°` : '—'} detail={bearingResultIsValid ? `Norte verdadeiro · elipsoide ${spatialReference.datum}` : pointsAreEqual ? 'Indeterminado para pontos coincidentes.' : 'Corrija as coordenadas para calcular.'} />
              </>
            ) : (
              <>
                <ResultCard label="Distância de quadrícula" value={planarDistance !== null ? `${meterFormatter.format(planarDistance)} m` : '—'} detail={`${spatialReference.code} · cálculo plano por Pitágoras`} accent />
                <ResultCard label="Azimute de quadrícula" value={gridBearing !== null && Number.isFinite(gridBearing) ? `${degreeFormatter.format(gridBearing)}°` : '—'} detail="Referenciado ao norte da quadrícula." />
              </>
            )}
          </div>

          <details className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60">
            <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:text-zinc-200">Detalhes técnicos</summary>
            <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
              <div className="grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-[10px] font-bold uppercase text-zinc-500">Método</p><p className="mt-1 font-semibold">{distanceMode === 'geografica' ? 'Karney / GeographicLib' : 'Quadrícula e comparação elipsoidal'}</p></div><div><p className="text-[10px] font-bold uppercase text-zinc-500">Datum</p><p className="mt-1 font-semibold">{spatialReference.datum}</p></div><div><p className="text-[10px] font-bold uppercase text-zinc-500">SRC</p><p className="mt-1 font-semibold" translate="no">{spatialReference.code}</p></div></div>
              {distanceMode === 'projetada' && <div className="mt-3 grid gap-3 sm:grid-cols-2"><ResultCard compact label="Distância geodésica" value={projectedGeodesicDistance !== null ? `${meterFormatter.format(projectedGeodesicDistance)} m` : '—'} detail={`Karney / GeographicLib · ${spatialReference.datum}`} /><ResultCard compact label="Azimute geodésico inicial" value={projectedGeodesicResult && Number.isFinite(projectedGeodesicResult.initialBearing) ? `${degreeFormatter.format(projectedGeodesicResult.initialBearing)}°` : '—'} detail="Referenciado ao norte verdadeiro." /></div>}
              {distanceMode === 'projetada' && utmMetadata && <div className="mt-3 grid gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900"><div><p className="text-[10px] font-bold uppercase text-zinc-500">Convergência — origem/destino</p><p className="mt-1 font-semibold tabular-nums">{degreeFormatter.format(utmMetadata.convergenceDegrees)}° / {destinationUtmMetadata ? `${degreeFormatter.format(destinationUtmMetadata.convergenceDegrees)}°` : '—'}</p></div><div><p className="text-[10px] font-bold uppercase text-zinc-500">Fator de escala — origem/destino</p><p className="mt-1 font-semibold tabular-nums">{utmMetadata.scaleFactor.toFixed(8)} / {destinationUtmMetadata?.scaleFactor.toFixed(8) ?? '—'}</p><p className="mt-1 text-[10px] text-zinc-500">Médio: {destinationUtmMetadata ? ((utmMetadata.scaleFactor + destinationUtmMetadata.scaleFactor) / 2).toFixed(8) : '—'}</p></div><div><p className="text-[10px] font-bold uppercase text-zinc-500">Distância elipsoidal</p><p className="mt-1 font-semibold tabular-nums">{projectedGeodesicDistance === null ? '—' : `${meterFormatter.format(projectedGeodesicDistance)} m`}</p></div><div><p className="text-[10px] font-bold uppercase text-zinc-500">Quadrícula − elipsoide</p><p className="mt-1 font-semibold tabular-nums">{gridGroundDifference === null ? '—' : `${meterFormatter.format(gridGroundDifference)} m`}</p><p className="mt-1 text-[10px] text-zinc-500">Fuso {spatialReference.zone}{spatialReference.hemisphere}</p></div></div>}
              <div className="mt-3 flex gap-2 rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 text-xs leading-5 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100"><Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />Distância geodésica e distância de quadrícula são grandezas diferentes. Relevo e redução ao plano topográfico local não são aplicados automaticamente.</div>
            </div>
          </details>
        </section>
      )}

      {activeTab === 'poligono' && (
        <section
          id="topography-panel-poligono"
          role="tabpanel"
          aria-labelledby="topography-tab-poligono"
          tabIndex={0}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Tipo de coordenada do polígono">
            <div className="min-w-0 border-l-2 border-cyan-600 pl-3 dark:border-cyan-400"><h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Área e perímetro</h2><p className="mt-0.5 text-xs text-zinc-500">Mapa, vértices e resultados em uma única área de trabalho.</p></div>
            <div className="inline-flex w-fit max-w-full self-start rounded-lg border border-zinc-200 bg-white p-1 shadow-sm sm:self-auto dark:border-zinc-700 dark:bg-zinc-900">
              {([['geografica', 'Latitude/longitude'], ['projetada', 'X/Y projetado']] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={polygonMode === mode} onClick={() => { setPolygonMode(mode); setVertexValidationVisible(false); }} className={cn('min-h-9 rounded-md px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-cyan-500/40', polygonMode === mode ? mode === 'geografica' ? 'bg-cyan-700 text-white' : 'bg-violet-700 text-white' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800')}>{label}</button>)}
            </div>
          </div>

          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
            <div
              className={cn(
                'relative h-[380px] min-w-0 overflow-hidden rounded-2xl border bg-zinc-100 shadow-sm sm:h-[480px] lg:sticky lg:top-4 lg:h-[720px] dark:bg-zinc-900',
                polygonMode === 'geografica' || spatialReference.mode === 'projetada'
                  ? 'border-zinc-200 dark:border-zinc-800'
                  : 'border-dashed border-zinc-300 dark:border-zinc-700'
              )}
            >
              {polygonMode === 'geografica' || spatialReference.mode === 'projetada' ? (
                <>
                  <MapBaseNotice unavailable={baseMapUnavailable} onRetry={reloadBaseMap} />
                  <div
                    ref={miniMapContainerRef}
                    role="region"
                    aria-label="Mapa dos vértices do polígono"
                    className="h-full w-full"
                  />
                  {mapVertices.length === 0 && (
                    <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-white/70 p-6 backdrop-blur-sm dark:bg-zinc-950/70">
                      <div className="max-w-xs text-center">
                        <MapPin className="mx-auto h-7 w-7 text-zinc-500" aria-hidden="true" />
                        <p className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Mapa sem vértices</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Adicione coordenadas ou clique no mapa para criar a geometria.</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center bg-zinc-50 p-6 text-center dark:bg-zinc-900/60">
                  <div className="max-w-md">
                    <MapPin className="mx-auto h-7 w-7 text-zinc-400" aria-hidden="true" />
                    <h3 className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Mapa indisponível para X/Y sem SRC projetado</h3>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Selecione um EPSG UTM na configuração compartilhada para transformar X/Y e posicionar o polígono.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid min-w-0 gap-4">
              <div className={cn(compactPanelClass, 'order-2 border-l-4 border-l-rose-300 dark:border-l-rose-400')}>
                <div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Vértices do polígono</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      A ordem define as arestas. Use sentido horário ou anti-horário e evite cruzamentos.
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button type="button" onClick={undoVertices} disabled={!canUndoVertices} aria-label="Desfazer alteração nos vértices" title="Desfazer (Ctrl+Z)" className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-2 text-xs font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"><ArrowCounterClockwise className="h-4 w-4" aria-hidden="true" />Desfazer</button>
                    <button type="button" onClick={redoVertices} disabled={!canRedoVertices} aria-label="Refazer alteração nos vértices" title="Refazer (Ctrl+Shift+Z)" className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-2 text-xs font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"><ArrowClockwise className="h-4 w-4" aria-hidden="true" />Refazer</button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ type: 'all' })}
                      disabled={activeVertexCount === 0}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg bg-red-600 px-2 py-1.5 text-xs font-semibold text-white transition-[background-color,box-shadow,opacity] hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:bg-red-600 disabled:opacity-45 dark:bg-red-600 dark:hover:bg-red-500 dark:disabled:bg-red-600"
                    >
                      Limpar vértices
                    </button>
                  </div>
                </div>

                <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
                  {activeVertexCount === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-center dark:border-zinc-700">
                      <MapPin className="mx-auto h-5 w-5 text-zinc-400" aria-hidden="true" />
                      <p className="mt-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">Nenhum vértice neste modo</p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Adicione ao menos três vértices ordenados.</p>
                    </div>
                  ) : (
                    (polygonMode === 'geografica' ? geographicVertices : projectedVertices).map((vertex, index) => {
                      const palette = vertexPalette[index % vertexPalette.length];
                      const isGeographicVertex = polygonMode === 'geografica' && 'lat' in vertex;
                      const coordinateText =
                        isGeographicVertex
                          ? `${coordinateFormatter.format(vertex.lat)}°, ${coordinateFormatter.format(vertex.lng)}°`
                          : 'x' in vertex
                            ? `E ${projectedCoordinateFormatter.format(vertex.x)} m · N ${projectedCoordinateFormatter.format(vertex.y)} m`
                            : '';
                      return (
                        <div key={`${polygonMode}-${index}-${coordinateText}`} className={cn('flex min-w-0 items-center gap-2 rounded-lg border border-l-4 bg-zinc-50 p-2 dark:bg-zinc-950/70', palette.border, selectedVertexIndex === index ? 'border-cyan-500 ring-2 ring-cyan-500/30 dark:border-cyan-400' : 'border-zinc-200 dark:border-zinc-800')}>
                          <span className="flex h-8 w-9 shrink-0 items-center justify-center rounded-md bg-white text-xs font-bold text-zinc-800 ring-1 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700">V{index + 1}</span>
                          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" title={coordinateText}>
                            {isGeographicVertex ? (
                              <>
                                <span className="inline-flex min-w-0 items-baseline gap-1 text-xs tabular-nums text-cyan-700 dark:text-cyan-300">
                                  <span className="font-bold uppercase tracking-wide">Lat</span>
                                  <span className="font-semibold">{coordinateFormatter.format(vertex.lat)}°</span>
                                </span>
                                <span className="inline-flex min-w-0 items-baseline gap-1 text-xs tabular-nums text-indigo-700 dark:text-indigo-300">
                                  <span className="font-bold uppercase tracking-wide">Long</span>
                                  <span className="font-semibold">{coordinateFormatter.format(vertex.lng)}°</span>
                                </span>
                              </>
                            ) : 'x' in vertex ? (
                              <>
                                <span className="inline-flex min-w-0 items-baseline gap-1 text-xs tabular-nums text-cyan-700 dark:text-cyan-300">
                                  <span className="font-bold uppercase tracking-wide">E</span>
                                  <span className="font-semibold">{projectedCoordinateFormatter.format(vertex.x)} m</span>
                                </span>
                                <span className="inline-flex min-w-0 items-baseline gap-1 text-xs tabular-nums text-indigo-700 dark:text-indigo-300">
                                  <span className="font-bold uppercase tracking-wide">N</span>
                                  <span className="font-semibold">{projectedCoordinateFormatter.format(vertex.y)} m</span>
                                </span>
                              </>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" onClick={() => locateVertex(index)} aria-label={`Localizar vértice ${index + 1} no mapa`} className="rounded-md p-1.5 text-cyan-700 hover:bg-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:text-cyan-300 dark:hover:bg-cyan-950/40"><MapPin className="h-4 w-4" aria-hidden="true" /></button>
                            <button type="button" onClick={() => openVertexEditor(index)} aria-label={`Editar detalhes do vértice ${index + 1}`} className="rounded-md p-1.5 text-violet-700 hover:bg-violet-100 focus-visible:ring-2 focus-visible:ring-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-950/40"><PencilSimple className="h-4 w-4" aria-hidden="true" /></button>
                            <button type="button" onClick={() => moveVertex(index, -1)} disabled={index === 0} aria-label={`Mover vértice ${index + 1} para cima`} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-white">
                              <ArrowUp className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => moveVertex(index, 1)} disabled={index === activeVertexCount - 1} aria-label={`Mover vértice ${index + 1} para baixo`} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-white">
                              <ArrowDown className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => setDeleteTarget({ type: 'vertex', index })} aria-label={`Excluir vértice ${index + 1}`} className="rounded-md p-1.5 text-red-600 transition-[background-color,color] hover:bg-red-100 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-400 dark:hover:bg-red-950/50 dark:hover:text-red-200">
                              <Trash className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {activeVertexCount >= 3 && (
                  <p className="mt-2 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400"><SelectionAll className="h-4 w-4" aria-hidden="true" />Fechamento automático: V{activeVertexCount} → V1</p>
                )}

                <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Adicionar vértice</h3>
                  {polygonMode === 'geografica' ? (
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <NumberField compact id="new-vertex-latitude" name="new-vertex-latitude" label="Latitude (−90 a 90)" value={newGeographicVertex.lat} onChange={(lat) => setNewGeographicVertex((vertex) => ({ ...vertex, lat }))} error={vertexValidationVisible ? geographicInputErrors.lat : null} placeholder="-27,594500" />
                      <NumberField compact id="new-vertex-longitude" name="new-vertex-longitude" label="Longitude (−180 a 180)" value={newGeographicVertex.lng} onChange={(lng) => setNewGeographicVertex((vertex) => ({ ...vertex, lng }))} error={vertexValidationVisible ? geographicInputErrors.lng : null} placeholder="-48,547700" />
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <NumberField compact id="new-vertex-x" name="new-vertex-x" label="Coordenada X / Este (m)" value={newProjectedVertex.x} onChange={(x) => setNewProjectedVertex((vertex) => ({ ...vertex, x }))} error={vertexValidationVisible ? projectedInputErrors.x : null} placeholder="745000,000" />
                      <NumberField compact id="new-vertex-y" name="new-vertex-y" label="Coordenada Y / Norte (m)" value={newProjectedVertex.y} onChange={(y) => setNewProjectedVertex((vertex) => ({ ...vertex, y }))} error={vertexValidationVisible ? projectedInputErrors.y : null} placeholder="6940000,000" />
                    </div>
                  )}
                  <button type="button" onClick={addVertex} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-1.5 text-sm font-semibold text-white transition-[background-color,box-shadow,transform] hover:bg-cyan-800 active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/30 sm:min-h-9 dark:bg-cyan-600 dark:hover:bg-cyan-500">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Adicionar vértice
                  </button>
                </div>

                <details className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-900 focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:text-zinc-100">Importar vários vértices</summary>
                  <label htmlFor="bulk-vertices" className="mt-3 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Cole CSV ou TXT — Vértice; {polygonMode === 'geografica' ? 'Latitude; Longitude' : 'X; Y'}</label>
                  <textarea id="bulk-vertices" name="bulk_vertices" rows={4} value={bulkVerticesInput} onChange={(event) => setBulkVerticesInput(event.target.value)} placeholder={polygonMode === 'geografica' ? 'V1;-27,594500;-48,547700' : 'V1;745000,000;6940000,000'} className={cn(geoFieldClass, 'mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs tabular-nums focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:border-zinc-700')} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => importBulkVertices()} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-cyan-700 px-3 text-xs font-semibold text-white hover:bg-cyan-800 focus-visible:ring-2 focus-visible:ring-cyan-500/40"><ClipboardText className="h-4 w-4" aria-hidden="true" /> Importar texto</button>
                    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-semibold hover:bg-zinc-50 focus-within:ring-2 focus-within:ring-cyan-500/40 dark:border-zinc-700 dark:hover:bg-zinc-800"><UploadSimple className="h-4 w-4" aria-hidden="true" /> Selecionar CSV/TXT<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={handleVertexFile} className="sr-only" /></label>
                  </div>
                  {bulkImportErrors.length > 0 && <ul role="alert" className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-400">{bulkImportErrors.slice(0, 5).map((error) => <li key={error}>{error}</li>)}</ul>}
                </details>

                {activeVertexCount < 3 && (
                  <div role="status" className="mt-2 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs leading-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Adicione {3 - activeVertexCount} {3 - activeVertexCount === 1 ? 'vértice' : 'vértices'} para fechar o polígono e calcular área e perímetro.
                  </div>
                )}
                {(polygonValidation.messages.length > 0 || spatialIssues.length > 0) && <details className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-cyan-500/40">Advertências técnicas ({polygonValidation.messages.length + spatialIssues.length})</summary><div className="border-t border-zinc-200 p-2 dark:border-zinc-800">{polygonValidation.messages.length > 0 && <ul role="alert" className="space-y-1 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{polygonValidation.messages.map((message) => <li key={message}>{message}</li>)}</ul>}{spatialIssues.length > 0 && <ul role="alert" className={cn('space-y-2 rounded-lg p-2.5 text-xs', polygonValidation.messages.length > 0 && 'mt-2', blockingSpatialIssue ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200')}>{spatialIssues.map((issue) => <li key={`${issue.code}-${issue.message}`}><strong>{issue.message}</strong> {issue.fix}</li>)}</ul>}</div></details>}
              </div>

              <div className={cn(compactPanelClass, 'order-1 border-l-4 border-l-emerald-500 dark:border-l-emerald-400')} aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Resultados</h2>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {polygonMode === 'geografica' ? `Geodésico elipsoidal · ${spatialReference.datum}` : `Plano projetado · ${spatialReference.code}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{activeVertexCount} {activeVertexCount === 1 ? 'vértice' : 'vértices'}</span>
                </div>
                <div className="mt-2"><TechnicalResultBadge reliability={blockingSpatialIssue || polygonValidation.messages.length ? 'blocked' : spatialIssues.length ? 'review' : 'technical'} description={blockingSpatialIssue?.message ?? spatialIssues[0]?.message ?? 'Cálculo executado com método técnico e entradas espacialmente consistentes.'} /></div>
                <div className="mt-2 grid gap-2 border-t border-zinc-200 pt-2 sm:grid-cols-2 dark:border-zinc-800">
                  <ResultCard compact label={polygonMode === 'geografica' ? 'Área geodésica' : 'Área por Gauss'} value={polygonMetrics ? `${hectareFormatter.format(metrosQuadradosParaHectares(polygonMetrics.area))} ha` : '—'} detail={polygonMetrics ? `${squareMeterFormatter.format(polygonMetrics.area)} m² · ${(polygonMetrics.area / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 6 })} km²` : polygonValidation.messages[0] ?? 'Mínimo de três vértices.'} accent />
                  <ResultCard compact label={polygonMode === 'geografica' ? 'Perímetro geodésico' : 'Perímetro plano'} value={polygonMetrics ? `${meterFormatter.format(polygonMetrics.perimeter)} m` : '—'} detail={polygonMetrics ? `${kilometerFormatter.format(polygonMetrics.perimeter / 1000)} km · ${polygonMode === 'geografica' ? 'Karney / GeographicLib' : 'unidade linear do SRC'}` : blockingSpatialIssue?.message ?? polygonValidation.messages[0] ?? 'Mínimo de três vértices.'} />
                </div>
                <details className="mt-3 border-t border-zinc-200 pt-2 dark:border-zinc-800"><summary className="cursor-pointer rounded-lg py-2 text-xs font-semibold text-zinc-700 focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:text-zinc-300">Detalhes técnicos e exportações</summary><div className="pt-2">{polygonMode === 'geografica' ? <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs leading-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><WarningCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Área e perímetro calculados no elipsoide {spatialReference.datum} pelo algoritmo de Karney. Use como memória de cálculo; peças registrais devem ser verificadas conforme as normas aplicáveis.</div> : <div className="flex gap-2 rounded-lg bg-zinc-100 p-2.5 text-xs leading-4 text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />O cálculo usa X/Y em metros no {spatialReference.code}. O mapa transforma apenas a visualização.</div>}<p className="mt-3 text-xs font-bold uppercase tracking-wide text-zinc-500">Exportar geometria e metadados</p><div className="mt-2 flex flex-wrap gap-2">{(['csv', 'geojson', 'kml', 'dxf'] as const).map((format) => <button key={format} type="button" disabled={!polygonMetrics || (format === 'dxf' && polygonMode !== 'projetada') || ((format === 'kml' || format === 'geojson') && polygonMode === 'projetada' && spatialReference.mode !== 'projetada')} onClick={() => downloadPolygon(format)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-semibold uppercase hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"><DownloadSimple className="h-4 w-4" aria-hidden="true" />{format}</button>)}<button type="button" disabled={!polygonMetrics} onClick={() => setReportOpen(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-cyan-700 px-3 text-xs font-semibold text-white hover:bg-cyan-800 focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:opacity-40"><FilePdf className="h-4 w-4" aria-hidden="true" />Relatório PDF</button></div></div></details>
              </div>
            </div>
          </div>
        </section>
      )}

      <VertexImportPreview
        key={importPreview ? `${importPreview.fileName}-${importPreview.text.length}` : 'closed-import-preview'}
        open={importPreview !== null}
        text={importPreview?.text ?? ''}
        fileName={importPreview?.fileName ?? ''}
        mode={polygonMode}
        reference={spatialReference}
        onClose={() => setImportPreview(null)}
        onApply={applyImportedVertices}
      />

      <Modal isOpen={spatialPanelExpanded} onClose={() => setSpatialPanelExpanded(false)} title="Configurar referência espacial" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-800 dark:bg-cyan-500/10">
            <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">SRC atual</p>
            <p className="mt-1 text-sm font-semibold text-cyan-950 dark:text-cyan-100" translate="no">{spatialReference.datum} · {spatialReference.zone ? `UTM ${spatialReference.zone}${spatialReference.hemisphere}` : 'Geográfico'} · {spatialReference.code}</p>
          </div>
          <div>
            <label htmlFor="topography-spatial-search" className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Buscar por nome ou EPSG</label>
            <input id="topography-spatial-search" name="topography_spatial_search" type="search" autoComplete="off" value={spatialSearch} onChange={(event) => setSpatialSearch(event.target.value)} placeholder="Ex.: 31982, SIRGAS ou 22S" className={cn(geoFieldClass, 'min-h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm dark:border-zinc-700')} />
          </div>
          <div>
            <label htmlFor="topography-spatial-reference" className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Sistema de referência (SRC)</label>
            <select id="topography-spatial-reference" name="topography_spatial_reference" value={spatialReference.code} onChange={(event) => requestSpatialReferenceChange(event.target.value)} className={cn(geoFieldClass, 'min-h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-cyan-500/30 dark:border-zinc-700 dark:text-white')}>
              {!filteredSpatialReferences.some((reference) => reference.code === spatialReference.code) && <option value={spatialReference.code}>{spatialReference.name} — {spatialReference.code}</option>}
              {filteredSpatialReferences.map((reference) => <option key={reference.code} value={reference.code}>{reference.name} — {reference.code}</option>)}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[['Datum', spatialReference.datum], ['Tipo', spatialReference.mode === 'projetada' ? 'Projetado X/Y' : 'Geográfico'], ['Fuso / hemisfério', spatialReference.zone ? `${spatialReference.zone}${spatialReference.hemisphere}` : 'Não aplicável']].map(([label, value]) => <div key={label} className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800"><p className="text-[10px] font-bold uppercase text-zinc-500">{label}</p><p className="mt-1 text-xs font-semibold">{value}</p></div>)}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={favoriteSpatialReferences.includes(spatialReference.code)} onClick={toggleFavoriteSpatialReference} className="min-h-9 rounded-lg border border-zinc-200 px-3 text-xs font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:border-zinc-700 dark:hover:bg-zinc-800">{favoriteSpatialReferences.includes(spatialReference.code) ? '★ Remover favorito' : '☆ Favoritar SRC'}</button>
            {mapVertices.length > 0 && <button type="button" onClick={applySuggestedSpatialReference} className="min-h-9 rounded-lg border border-cyan-300 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:border-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-200">Sugerir UTM pelas coordenadas</button>}
          </div>
          {(favoriteSpatialReferences.length > 0 || recentSpatialReferences.length > 1) && <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800"><p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Favoritos e recentes</p><div className="mt-2 flex flex-wrap gap-2">{favoriteSpatialReferences.filter((code) => code !== spatialReference.code).slice(0, 4).map((code) => <button key={`favorite-${code}`} type="button" onClick={() => requestSpatialReferenceChange(code)} className="min-h-8 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-500/10 dark:text-amber-200" translate="no">★ {code}</button>)}{recentSpatialReferences.filter((code) => code !== spatialReference.code).slice(0, 4).map((code) => <button key={`recent-${code}`} type="button" onClick={() => requestSpatialReferenceChange(code)} className="min-h-8 rounded-lg bg-zinc-100 px-2.5 text-xs font-semibold dark:bg-zinc-800" translate="no">Recente: {code}</button>)}</div></div>}
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">Datum define o referencial geodésico; EPSG identifica a combinação oficial; fuso e hemisfério determinam a projeção UTM usada em X/Y. A preferência fica salva neste dispositivo.</p>
          <div className="flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-800"><button type="button" onClick={() => setSpatialPanelExpanded(false)} className="min-h-10 rounded-lg bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:ring-2 focus-visible:ring-cyan-500/40">Concluir</button></div>
        </div>
      </Modal>

      <Modal isOpen={pendingSpatialReferenceCode !== null} onClose={() => setPendingSpatialReferenceCode(null)} title="Alterar o sistema de referência?" maxWidth="max-w-xl">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Há {activeVertexCount} {activeVertexCount === 1 ? 'vértice' : 'vértices'} em uso. Escolha como os valores devem ser tratados ao passar de <strong translate="no">{spatialReference.code}</strong> para <strong translate="no">{pendingSpatialReferenceCode}</strong>.
          </p>
          <button type="button" onClick={() => applySpatialReferenceChange('transform')} className="w-full rounded-xl border border-cyan-300 bg-cyan-50 p-4 text-left hover:bg-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:border-cyan-700 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/15">
            <span className="block text-sm font-bold text-cyan-900 dark:text-cyan-100">Transformar coordenadas (recomendado)</span>
            <span className="mt-1 block text-xs leading-5 text-cyan-800 dark:text-cyan-200">Preserva a posição no terreno e recalcula os números no novo datum, fuso e hemisfério.</span>
          </button>
          <button type="button" onClick={() => applySpatialReferenceChange('reinterpret')} className="w-full rounded-xl border border-amber-300 bg-amber-50 p-4 text-left hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:border-amber-700 dark:bg-amber-500/10 dark:hover:bg-amber-500/15">
            <span className="block text-sm font-bold text-amber-900 dark:text-amber-100">Manter números e reinterpretar</span>
            <span className="mt-1 block text-xs leading-5 text-amber-800 dark:text-amber-200">Use somente quando os valores já pertencem ao novo SRC; a posição calculada poderá mudar.</span>
          </button>
          <div className="flex justify-end"><button type="button" onClick={() => setPendingSpatialReferenceCode(null)} className="min-h-10 rounded-lg border border-zinc-200 px-4 text-sm font-semibold hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-500/40 dark:border-zinc-700 dark:hover:bg-zinc-800">Cancelar</button></div>
        </div>
      </Modal>

      <Modal isOpen={vertexEditor !== null} onClose={() => setVertexEditor(null)} title={`Editar vértice V${vertexEditor ? vertexEditor.index + 1 : ''}`} maxWidth="max-w-2xl">
        {vertexEditor && <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField id="vertex-editor-first" name="vertex_editor_first" label={polygonMode === 'geografica' ? 'Latitude' : 'X / Este (m)'} value={vertexEditor.first} onChange={(first) => setVertexEditor((current) => current ? { ...current, first } : current)} />
            <NumberField id="vertex-editor-second" name="vertex_editor_second" label={polygonMode === 'geografica' ? 'Longitude' : 'Y / Norte (m)'} value={vertexEditor.second} onChange={(second) => setVertexEditor((current) => current ? { ...current, second } : current)} />
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Código<input type="text" name="vertex_code" autoComplete="off" value={vertexEditor.code} onChange={(event) => setVertexEditor((current) => current ? { ...current, code: event.target.value } : current)} className={cn(geoFieldClass, 'mt-1.5 min-h-10 w-full rounded-lg border border-zinc-200 px-3 dark:border-zinc-700')} /></label>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Descrição<input type="text" name="vertex_description" autoComplete="off" value={vertexEditor.description} onChange={(event) => setVertexEditor((current) => current ? { ...current, description: event.target.value } : current)} className={cn(geoFieldClass, 'mt-1.5 min-h-10 w-full rounded-lg border border-zinc-200 px-3 dark:border-zinc-700')} /></label>
            <NumberField id="vertex-editor-altitude" name="vertex_altitude" label="Altitude (m, opcional)" value={vertexEditor.altitude} onChange={(altitude) => setVertexEditor((current) => current ? { ...current, altitude } : current)} />
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Precisão<input type="text" name="vertex_precision" autoComplete="off" value={vertexEditor.precision} onChange={(event) => setVertexEditor((current) => current ? { ...current, precision: event.target.value } : current)} placeholder="Ex.: 0,02 m" className={cn(geoFieldClass, 'mt-1.5 min-h-10 w-full rounded-lg border border-zinc-200 px-3 dark:border-zinc-700')} /></label>
          </div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">Observações<textarea name="vertex_notes" rows={3} value={vertexEditor.notes} onChange={(event) => setVertexEditor((current) => current ? { ...current, notes: event.target.value } : current)} className={cn(geoFieldClass, 'mt-1.5 w-full rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700')} /></label>
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"><button type="button" onClick={() => setVertexEditor(null)} className="min-h-10 rounded-lg border border-zinc-200 px-4 text-sm font-semibold dark:border-zinc-700">Cancelar</button><button type="button" onClick={saveVertexEditor} className="min-h-10 rounded-lg bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:ring-2 focus-visible:ring-cyan-500/40">Salvar vértice</button></div>
        </div>}
      </Modal>

      <Modal isOpen={reportOpen} onClose={() => setReportOpen(false)} title="Gerar relatório técnico em PDF" maxWidth="max-w-xl">
        <div className="space-y-3">
          {(['title', 'client', 'project', 'responsible'] as const).map((field) => {
            const labels = { title: 'Título', client: 'Cliente', project: 'Projeto', responsible: 'Responsável técnico' };
            return <label key={field} className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">{labels[field]}<input type="text" name={`report_${field}`} autoComplete="off" value={reportFields[field]} onChange={(event) => setReportFields((current) => ({ ...current, [field]: event.target.value }))} className={cn(geoFieldClass, 'mt-1.5 min-h-10 w-full rounded-lg border border-zinc-200 px-3 dark:border-zinc-700')} /></label>;
          })}
          <p className="rounded-lg bg-zinc-100 p-3 text-xs leading-5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">O PDF incluirá SRC, método, coordenadas, área, perímetro, advertências automáticas e campo de assinatura.</p>
          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"><button type="button" onClick={() => setReportOpen(false)} className="min-h-10 rounded-lg border border-zinc-200 px-4 text-sm font-semibold dark:border-zinc-700">Cancelar</button><button type="button" onClick={generateTechnicalReport} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:ring-2 focus-visible:ring-cyan-500/40"><FilePdf className="h-4 w-4" aria-hidden="true" />Baixar PDF</button></div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmVertexDeletion}
        title={deleteTarget?.type === 'all' ? 'Limpar todos os vértices?' : `Excluir vértice V${deleteTarget?.index !== undefined ? deleteTarget.index + 1 : ''}?`}
        description={
          deleteTarget?.type === 'all'
            ? `Todos os ${activeVertexCount} vértices do modo atual serão removidos. Você poderá desfazer a alteração pelo histórico local.`
            : 'O vértice será removido e a área, o perímetro e o mapa serão recalculados. Você poderá desfazer a alteração.'
        }
        confirmText={deleteTarget?.type === 'all' ? 'Limpar vértices' : 'Excluir vértice'}
        variant="danger"
      />
    </Layout>
  );
}
