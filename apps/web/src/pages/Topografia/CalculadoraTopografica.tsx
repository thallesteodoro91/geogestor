import { FormSelect } from '../../components/Form';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowsLeftRight,
  Calculator,
  Compass,
  Info,
  MapPin,
  Plus,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Layout } from '../../components/Layout';
import { PageHeader } from '../../components/PageHeader';
import { CalculationHistory, type SavedCalculation } from '../../components/CalculationHistory';
import { MapBaseNotice } from '../../components/maps/MapBaseNotice';
import { createBaseTileLayer } from '../../utils/mapTiles';
import {
  calcularAreaGeograficaEstimada,
  calcularAreaPoligono,
  calcularAzimuteGeodesicoInicial,
  calcularDistanciaGeografica,
  calcularPerimetro,
  calcularPerimetroGeografico,
  decimaisParaGMS,
  gmsParaDecimais,
  metrosQuadradosParaHectares,
  validarCoordenadas,
} from '../../core/topography';
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

type MainTab = 'conversor' | 'distancia' | 'poligono';
type CoordinateKind = 'latitude' | 'longitude';
type Hemisphere = 'N' | 'S' | 'E' | 'W';
type PolygonMode = 'geografica' | 'projetada';
type GeographicVertex = { lat: number; lng: number };
type ProjectedVertex = { x: number; y: number };

const tabs: Array<{ id: MainTab; label: string }> = [
  { id: 'conversor', label: 'Conversor GMS / Decimal' },
  { id: 'distancia', label: 'Distância e azimute' },
  { id: 'poligono', label: 'Área e perímetro' },
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

  const [coordinateKind, setCoordinateKind] = useState<CoordinateKind>('latitude');
  const [hemisphere, setHemisphere] = useState<Hemisphere>('S');
  const [degreesInput, setDegreesInput] = useState('23');
  const [minutesInput, setMinutesInput] = useState('32');
  const [secondsInput, setSecondsInput] = useState('41,2');
  const [decimalInput, setDecimalInput] = useState('-46,6333');

  const [point1, setPoint1] = useState({ lat: '-23,5505', lng: '-46,6333' });
  const [point2, setPoint2] = useState({ lat: '-22,9068', lng: '-43,1729' });

  const [polygonMode, setPolygonMode] = useState<PolygonMode>('geografica');
  const [geographicVertices, setGeographicVertices] = useState<GeographicVertex[]>([
    { lat: -15.793889, lng: -47.882778 },
    { lat: -15.798889, lng: -47.882778 },
    { lat: -15.798889, lng: -47.877778 },
    { lat: -15.793889, lng: -47.877778 },
  ]);
  const [projectedVertices, setProjectedVertices] = useState<ProjectedVertex[]>([]);
  const [newGeographicVertex, setNewGeographicVertex] = useState({ lat: '', lng: '' });
  const [newProjectedVertex, setNewProjectedVertex] = useState({ x: '', y: '' });
  const [vertexValidationVisible, setVertexValidationVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'vertex'; index: number } | { type: 'all' } | null>(null);

  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapInstanceRef = useRef<L.Map | null>(null);
  const geometryLayerRef = useRef<L.LayerGroup | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const [baseMapUnavailable, setBaseMapUnavailable] = useState(() => !navigator.onLine);

  const reloadBaseMap = useCallback(() => {
    const map = miniMapInstanceRef.current;
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
  const geographicDistance = pointsAreValid
    ? calcularDistanciaGeografica(
        parsedPoint1.lat ?? 0,
        parsedPoint1.lng ?? 0,
        parsedPoint2.lat ?? 0,
        parsedPoint2.lng ?? 0
      )
    : null;
  const initialBearing = pointsAreValid && !pointsAreEqual
    ? calcularAzimuteGeodesicoInicial(
        parsedPoint1.lat ?? 0,
        parsedPoint1.lng ?? 0,
        parsedPoint2.lat ?? 0,
        parsedPoint2.lng ?? 0
      )
    : null;
  const distanceResultIsValid = geographicDistance !== null && Number.isFinite(geographicDistance);
  const bearingResultIsValid = initialBearing !== null && Number.isFinite(initialBearing);

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
  const polygonMetrics = useMemo(() => {
    if (polygonMode === 'geografica') {
      if (geographicVertices.length < 3) return null;
      const area = calcularAreaGeograficaEstimada(geographicVertices);
      const perimeter = calcularPerimetroGeografico(geographicVertices);
      return Number.isFinite(area) && Number.isFinite(perimeter) ? { area, perimeter } : null;
    }

    if (projectedVertices.length < 3) return null;
    const area = calcularAreaPoligono(projectedVertices);
    const perimeter = calcularPerimetro(projectedVertices);
    return Number.isFinite(area) && Number.isFinite(perimeter) ? { area, perimeter } : null;
  }, [geographicVertices, polygonMode, projectedVertices]);

  useEffect(() => {
    if (
      activeTab !== 'poligono' ||
      polygonMode !== 'geografica' ||
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
    window.requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      miniMapInstanceRef.current = null;
      geometryLayerRef.current = null;
      baseTileLayerRef.current = null;
    };
  }, [activeTab, polygonMode]);

  useEffect(() => {
    const map = miniMapInstanceRef.current;
    const layerGroup = geometryLayerRef.current;
    if (!map || !layerGroup || activeTab !== 'poligono' || polygonMode !== 'geografica') return;

    layerGroup.clearLayers();
    if (geographicVertices.length === 0) {
      map.setView([-15.793889, -47.882778], 14);
      return;
    }

    const latLngs = geographicVertices.map(({ lat, lng }) => L.latLng(lat, lng));
    latLngs.forEach((latLng, index) => {
      const vertexColor = vertexPalette[index % vertexPalette.length].marker;
      L.circleMarker(latLng, {
        radius: 6,
        color: '#ffffff',
        fillColor: vertexColor,
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(`V${index + 1}`, {
          permanent: true,
          direction: 'top',
          offset: [0, -5],
          opacity: 0.92,
        })
        .addTo(layerGroup);
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
  }, [activeTab, geographicVertices, polygonMode]);

  function changeCoordinateKind(kind: CoordinateKind) {
    setCoordinateKind(kind);
    setHemisphere(kind === 'latitude' ? 'S' : 'W');
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
    if (saved.coordinateKind === 'latitude' || saved.coordinateKind === 'longitude') {
      setActiveTab('conversor');
      setCoordinateKind(saved.coordinateKind);
      if (saved.hemisphere === 'N' || saved.hemisphere === 'S' || saved.hemisphere === 'E' || saved.hemisphere === 'W') setHemisphere(saved.hemisphere);
      if (typeof saved.degreesInput === 'string') setDegreesInput(saved.degreesInput);
      if (typeof saved.minutesInput === 'string') setMinutesInput(saved.minutesInput);
      if (typeof saved.secondsInput === 'string') setSecondsInput(saved.secondsInput);
      if (typeof saved.decimalInput === 'string') setDecimalInput(saved.decimalInput);
      return;
    }
    if (saved.point1 && saved.point2) {
      const first = saved.point1 as { lat?: unknown; lng?: unknown };
      const second = saved.point2 as { lat?: unknown; lng?: unknown };
      if (typeof first.lat === 'string' && typeof first.lng === 'string' && typeof second.lat === 'string' && typeof second.lng === 'string') {
        setActiveTab('distancia');
        setPoint1({ lat: first.lat, lng: first.lng });
        setPoint2({ lat: second.lat, lng: second.lng });
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

  const tabIcon = (tab: MainTab) => {
    if (tab === 'conversor') return <ArrowsLeftRight className="h-4 w-4" aria-hidden="true" />;
    if (tab === 'distancia') return <Compass className="h-4 w-4" aria-hidden="true" />;
    return <Calculator className="h-4 w-4" aria-hidden="true" />;
  };

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
                      'bg-transparent p-0 dark:bg-transparent',
                    )}
                  >
                    {tabIcon(tab.id)}
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
                  ? { coordinateKind, hemisphere, degreesInput, minutesInput, secondsInput, decimalInput }
                  : activeTab === 'distancia'
                    ? { point1, point2 }
                    : { polygonMode, vertices: polygonMode === 'geografica' ? geographicVertices : projectedVertices }}
                result={activeTab === 'conversor'
                  ? { decimal: gmsDecimalResult, gms: decimalGmsResult, hemisphere: decimalHemisphere }
                  : activeTab === 'distancia'
                    ? { distanceMeters: geographicDistance, initialBearingDegrees: initialBearing }
                    : polygonMetrics}
                unit={activeTab === 'distancia' ? 'm e graus' : activeTab === 'poligono' ? 'm² e m' : 'graus'}
                method={activeTab === 'conversor' ? 'Conversão GMS/decimal' : activeTab === 'distancia' ? 'Geodésico' : polygonMode === 'geografica' ? 'Geográfico estimado' : 'Coordenadas projetadas'}
                disabled={activeTab === 'conversor' ? !gmsDecimalResult && !decimalGmsResult : activeTab === 'distancia' ? !distanceResultIsValid : !polygonMetrics}
                onReopen={reopenCalculation}
              />
            </div>
          </div>
        }
      />

      {activeTab === 'conversor' && (
        <section
          id="topography-panel-conversor"
          role="tabpanel"
          aria-labelledby="topography-tab-conversor"
          tabIndex={0}
          className="grid gap-5 lg:grid-cols-2"
        >
          <div className={cn(panelClass, 'flex h-full flex-col border-l-4 border-l-violet-500 dark:border-l-violet-400')}>
            <div className="mb-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-400/20">
                  <Compass className="h-5 w-5" weight="bold" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">Entrada sexagesimal</p>
                  <h2 className="mt-0.5 text-lg font-semibold text-zinc-950 dark:text-white">GMS → Decimal</h2>
                </div>
              </div>
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                Informe graus sem sinal e selecione o hemisfério.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="gms-coordinate-kind" className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Tipo de coordenada
                </label>
                <FormSelect
                  id="gms-coordinate-kind"
                  name="gms-coordinate-kind"
                  value={coordinateKind}
                  autoComplete="off"
                  onChange={(event) => changeCoordinateKind(event.target.value as CoordinateKind)}
                  className={cn(geoFieldClass, 'w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-cyan-500/30 dark:border-zinc-700 dark:text-white')}
                >
                  <option value="latitude">Latitude</option>
                  <option value="longitude">Longitude</option>
                </FormSelect>
              </div>
              <div>
                <label htmlFor="gms-hemisphere" className="mb-1.5 block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Hemisfério
                </label>
                <FormSelect
                  id="gms-hemisphere"
                  name="gms-hemisphere"
                  value={hemisphere}
                  autoComplete="off"
                  onChange={(event) => setHemisphere(event.target.value as Hemisphere)}
                  className={cn(geoFieldClass, 'w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-950 focus-visible:ring-2 focus-visible:ring-cyan-500/30 dark:border-zinc-700 dark:text-white')}
                >
                  {coordinateKind === 'latitude' ? (
                    <>
                      <option value="N">Norte (N)</option>
                      <option value="S">Sul (S)</option>
                    </>
                  ) : (
                    <>
                      <option value="E">Leste (E)</option>
                      <option value="W">Oeste (W)</option>
                    </>
                  )}
                </FormSelect>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <NumberField id="gms-degrees" name="gms-degrees" label={`Graus · ° (0–${maxDegrees})`} value={degreesInput} onChange={setDegreesInput} error={degreesError} />
              <NumberField id="gms-minutes" name="gms-minutes" label="Minutos · ′ (0–59)" value={minutesInput} onChange={setMinutesInput} error={minutesError} />
              <NumberField id="gms-seconds" name="gms-seconds" label="Segundos · ″ (0–<60)" value={secondsInput} onChange={setSecondsInput} error={secondsError} />
            </div>

            <div className="mt-auto border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <ResultCard
                label="Coordenada decimal"
                value={gmsDecimalResult === null ? '—' : `${coordinateFormatter.format(gmsDecimalResult)}°`}
                detail={gmsDecimalResult === null ? 'Corrija os campos para calcular.' : `Hemisfério ${hemisphere}.`}
                tone="violet"
              />
            </div>
          </div>

          <div className={cn(panelClass, 'flex h-full flex-col border-l-4 border-l-cyan-500 dark:border-l-cyan-400')}>
            <div className="mb-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-200 dark:ring-cyan-400/20">
                  <Calculator className="h-5 w-5" weight="bold" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">Entrada decimal</p>
                  <h2 className="mt-0.5 text-lg font-semibold text-zinc-950 dark:text-white">Decimal → GMS</h2>
                </div>
              </div>
              <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                O limite acompanha o tipo de coordenada selecionado ao lado.
              </p>
            </div>
            <NumberField
              id="decimal-coordinate"
              name="decimal-coordinate"
              label={coordinateKind === 'latitude' ? 'Latitude decimal (−90 a 90)' : 'Longitude decimal (−180 a 180)'}
              value={decimalInput}
              onChange={setDecimalInput}
              error={decimalError}
              placeholder={coordinateKind === 'latitude' ? '-27,5945' : '-48,5477'}
            />
            <div className="mt-auto border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <ResultCard
                label="Coordenada em GMS"
                value={
                  decimalGmsResult && decimalHemisphere
                    ? `${numberFormatter.format(decimalGmsResult.graus)}° ${numberFormatter.format(decimalGmsResult.minutos)}′ ${numberFormatter.format(decimalGmsResult.segundos)}″ ${decimalHemisphere}`
                    : '—'
                }
                detail={decimalGmsResult ? 'Conversão angular; não altera datum ou SRC.' : 'Corrija o valor decimal para converter.'}
                tone="cyan"
              />
            </div>
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
          <div className="mb-5 flex items-start gap-3">
            <Compass className="mt-0.5 h-5 w-5 shrink-0 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Coordenadas geográficas</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                Distância Haversine e azimute inicial em modelo esférico, referenciado ao norte verdadeiro.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <fieldset className="rounded-xl border border-l-4 border-zinc-200 border-l-cyan-400 p-4 shadow-sm dark:border-zinc-800 dark:border-l-cyan-300">
              <legend className="px-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />Ponto de partida</span>
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField id="point-1-latitude" name="point-1-latitude" label="Latitude (−90 a 90)" value={point1.lat} onChange={(lat) => setPoint1((point) => ({ ...point, lat }))} error={pointErrors.point1Lat} />
                <NumberField id="point-1-longitude" name="point-1-longitude" label="Longitude (−180 a 180)" value={point1.lng} onChange={(lng) => setPoint1((point) => ({ ...point, lng }))} error={pointErrors.point1Lng} />
              </div>
            </fieldset>
            <fieldset className="rounded-xl border border-l-4 border-zinc-200 border-l-violet-400 p-4 shadow-sm dark:border-zinc-800 dark:border-l-violet-300">
              <legend className="px-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-violet-700 dark:text-violet-300" aria-hidden="true" />Ponto de destino</span>
              </legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField id="point-2-latitude" name="point-2-latitude" label="Latitude (−90 a 90)" value={point2.lat} onChange={(lat) => setPoint2((point) => ({ ...point, lat }))} error={pointErrors.point2Lat} />
                <NumberField id="point-2-longitude" name="point-2-longitude" label="Longitude (−180 a 180)" value={point2.lng} onChange={(lng) => setPoint2((point) => ({ ...point, lng }))} error={pointErrors.point2Lng} />
              </div>
            </fieldset>
          </div>

          {pointsAreEqual && (
            <div role="status" className="mt-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Os pontos são coincidentes. A distância é zero e o azimute não pode ser determinado.
            </div>
          )}

          <div className="mt-5 grid gap-4 border-t border-zinc-200 pt-5 dark:border-zinc-800 md:grid-cols-2">
            <ResultCard
              label="Distância geográfica estimada"
              value={distanceResultIsValid ? `${kilometerFormatter.format((geographicDistance ?? 0) / 1000)} km` : '—'}
              detail={distanceResultIsValid ? `${meterFormatter.format(geographicDistance ?? 0)} m · Haversine, Terra esférica` : 'Corrija as coordenadas para calcular.'}
              accent
            />
            <ResultCard
              label="Azimute inicial geodésico"
              value={bearingResultIsValid ? `${degreeFormatter.format(initialBearing ?? 0)}°` : '—'}
              detail={bearingResultIsValid ? 'Modelo esférico · norte verdadeiro' : pointsAreEqual ? 'Indeterminado para pontos coincidentes.' : 'Corrija as coordenadas para calcular.'}
            />
          </div>

          <div className="mt-4 flex gap-2 rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 text-xs leading-5 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            Não confunda este azimute com azimute de quadrícula ou topográfico. Convergência meridiana,
            fator de escala, relevo e solução elipsoidal não são aplicados aqui.
          </div>
        </section>
      )}

      {activeTab === 'poligono' && (
        <section
          id="topography-panel-poligono"
          role="tabpanel"
          aria-labelledby="topography-tab-poligono"
          tabIndex={0}
        >
          <div className="mb-3" aria-label="Tipo de coordenada do polígono">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-6">
            <button
              type="button"
              aria-pressed={polygonMode === 'geografica'}
              onClick={() => { setPolygonMode('geografica'); setVertexValidationVisible(false); }}
              className={cn(
                'group flex min-w-0 items-start gap-2.5 rounded-lg border border-l-4 p-3 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40',
                polygonMode === 'geografica'
                  ? 'border-cyan-300 border-l-cyan-600 bg-cyan-50/70 shadow-sm dark:border-cyan-500/30 dark:border-l-cyan-400 dark:bg-cyan-500/[0.08]'
                  : 'border-zinc-200 border-l-zinc-300 bg-transparent hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:border-l-zinc-700 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60'
              )}
            >
              <MapPin className={cn('mt-0.5 h-5 w-5 shrink-0', polygonMode === 'geografica' ? 'text-cyan-700 dark:text-cyan-300' : 'text-zinc-400')} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-950 dark:text-white">Coordenadas geodésicas</span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">Latitude/longitude · área apenas estimativa</span>
              </span>
              {polygonMode === 'geografica' && <span className="shrink-0 rounded-full bg-cyan-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-800 dark:bg-cyan-400/15 dark:text-cyan-200">Selecionado</span>}
            </button>
            <button
              type="button"
              aria-pressed={polygonMode === 'projetada'}
              onClick={() => { setPolygonMode('projetada'); setVertexValidationVisible(false); }}
              className={cn(
                'group flex min-w-0 items-start gap-2.5 rounded-lg border border-l-4 p-3 text-left transition-[border-color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40',
                polygonMode === 'projetada'
                  ? 'border-violet-300 border-l-violet-600 bg-violet-50/70 shadow-sm dark:border-violet-500/30 dark:border-l-violet-400 dark:bg-violet-500/[0.08]'
                  : 'border-zinc-200 border-l-zinc-300 bg-transparent hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:border-l-zinc-700 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60'
              )}
            >
              <Calculator className={cn('mt-0.5 h-5 w-5 shrink-0', polygonMode === 'projetada' ? 'text-violet-700 dark:text-violet-300' : 'text-zinc-400')} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-zinc-950 dark:text-white">Coordenadas projetadas X/Y</span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">Metros no mesmo SRC · Gauss/Shoelace</span>
              </span>
              {polygonMode === 'projetada' && <span className="shrink-0 rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800 dark:bg-violet-400/15 dark:text-violet-200">Selecionado</span>}
            </button>
            </div>
          </div>

          <div className="grid min-w-0 items-stretch gap-6 lg:grid-cols-2">
            <div
              className={cn(
                'relative h-[360px] min-w-0 overflow-hidden rounded-2xl border bg-zinc-100 shadow-sm sm:h-[440px] lg:h-full lg:min-h-[520px] dark:bg-zinc-900',
                polygonMode === 'geografica'
                  ? 'border-zinc-200 dark:border-zinc-800'
                  : 'border-dashed border-zinc-300 dark:border-zinc-700'
              )}
            >
              {polygonMode === 'geografica' ? (
                <>
                  <MapBaseNotice unavailable={baseMapUnavailable} onRetry={reloadBaseMap} />
                  <div
                    ref={miniMapContainerRef}
                    role="region"
                    aria-label="Mini-mapa dos vértices geodésicos"
                    className="h-full w-full"
                  />
                  {geographicVertices.length === 0 && (
                    <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-white/70 p-6 backdrop-blur-sm dark:bg-zinc-950/70">
                      <div className="max-w-xs text-center">
                        <MapPin className="mx-auto h-7 w-7 text-zinc-500" aria-hidden="true" />
                        <p className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Mapa sem vértices</p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Adicione coordenadas geodésicas para visualizar a geometria.</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full items-center justify-center bg-zinc-50 p-6 text-center dark:bg-zinc-900/60">
                  <div className="max-w-md">
                    <MapPin className="mx-auto h-7 w-7 text-zinc-400" aria-hidden="true" />
                    <h3 className="mt-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Mapa indisponível para X/Y sem SRC</h3>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Para posicionar coordenadas projetadas no OpenStreetMap seria necessário informar o sistema de referência e aplicar uma transformação para latitude/longitude.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-4">
              <div className={cn(compactPanelClass, 'border-l-4 border-l-rose-300 dark:border-l-rose-400')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Vértices do polígono</h2>
                    <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      A ordem define as arestas. Use sentido horário ou anti-horário e evite cruzamentos.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ type: 'all' })}
                    disabled={activeVertexCount === 0}
                    className="inline-flex min-h-9 items-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-[background-color,box-shadow,opacity] hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:bg-red-600 disabled:opacity-45 dark:bg-red-600 dark:hover:bg-red-500 dark:disabled:bg-red-600"
                  >
                    Limpar vértices
                  </button>
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
                        <div key={`${polygonMode}-${index}-${coordinateText}`} className={cn('flex min-w-0 items-center gap-2 rounded-lg border border-l-4 border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950/70', palette.border)}>
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

                {activeVertexCount < 3 && (
                  <div role="status" className="mt-2 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs leading-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Adicione {3 - activeVertexCount} {3 - activeVertexCount === 1 ? 'vértice' : 'vértices'} para fechar o polígono e calcular área e perímetro.
                  </div>
                )}
              </div>

              <div className={cn(compactPanelClass, 'border-l-4 border-l-emerald-500 dark:border-l-emerald-400')} aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-zinc-950 dark:text-white">Resultados</h2>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {polygonMode === 'geografica' ? 'Prévia geodésica estimativa' : 'Coordenadas projetadas em metros'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{activeVertexCount} {activeVertexCount === 1 ? 'vértice' : 'vértices'}</span>
                </div>
                <div className="mt-2 grid gap-2 border-t border-zinc-200 pt-2 sm:grid-cols-2 dark:border-zinc-800">
                  <ResultCard compact label={polygonMode === 'geografica' ? 'Área estimada' : 'Área por Gauss'} value={polygonMetrics ? `${hectareFormatter.format(metrosQuadradosParaHectares(polygonMetrics.area))} ha` : '—'} detail={polygonMetrics ? `${squareMeterFormatter.format(polygonMetrics.area)} m²` : 'Mínimo de três vértices.'} accent />
                  <ResultCard compact label={polygonMode === 'geografica' ? 'Perímetro estimado' : 'Perímetro plano'} value={polygonMetrics ? `${meterFormatter.format(polygonMetrics.perimeter)} m` : '—'} detail={polygonMetrics ? (polygonMode === 'geografica' ? 'Soma de arcos Haversine.' : 'Mesma unidade linear das coordenadas.') : 'Mínimo de três vértices.'} />
                </div>
                {polygonMode === 'geografica' && (
                  <div className="mt-2 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs leading-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    Área estimada por projeção equiretangular local. Não use como área topográfica, registral ou geodésica de precisão.
                  </div>
                )}
                {polygonMode === 'projetada' && (
                  <div className="mt-2 flex gap-2 rounded-lg bg-zinc-100 p-2.5 text-xs leading-4 text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-300">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    O cálculo pressupõe X/Y em metros, no mesmo SRC projetado e com vértices sem auto-interseção. Datum, fuso e fator de escala devem ser conferidos no levantamento.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmVertexDeletion}
        title={deleteTarget?.type === 'all' ? 'Limpar todos os vértices?' : `Excluir vértice V${deleteTarget?.index !== undefined ? deleteTarget.index + 1 : ''}?`}
        description={
          deleteTarget?.type === 'all'
            ? `Todos os ${activeVertexCount} vértices do modo atual serão removidos. Esta ação não pode ser desfeita.`
            : 'O vértice será removido e a área, o perímetro e o mapa serão recalculados. Esta ação não pode ser desfeita.'
        }
        confirmText={deleteTarget?.type === 'all' ? 'Limpar vértices' : 'Excluir vértice'}
        variant="danger"
      />
    </Layout>
  );
}
