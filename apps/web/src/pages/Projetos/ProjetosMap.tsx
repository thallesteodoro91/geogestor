import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet';
import { useEffect, useState, type ComponentProps } from 'react';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { apiFetch } from '../../services/apiClient';
import { MapBaseNotice } from '../../components/maps/MapBaseNotice';
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../../utils/mapTiles';

// @ts-expect-error - Leaflet _getIconUrl is an internal property without official TypeScript definitions
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export interface ProjetoMapItem {
  id: string;
  nome: string;
  clienteNome?: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  areaHa?: number | string | null;
}

export interface ProjetosMapProps {
  projetos: ProjetoMapItem[];
}

interface ImportedGeoFeature {
  data?: ComponentProps<typeof GeoJSON>['data'];
  visible?: boolean;
  projetoId?: string;
  fileName?: string;
  color?: string;
  opacity?: number;
}

const getStatusColor = (status?: string) => {
  if (status === 'Concluído' || status === 'Finalizado') return '#10b981'; // emerald-500
  if (status === 'Em Andamento') return '#f59e0b'; // amber-500
  if (status === 'Atrasado') return '#ef4444'; // red-500
  if (status === 'Em Análise') return '#3b82f6'; // blue-500
  return '#71717a'; // zinc-500
};

const getCustomIcon = (status?: string) => {
  const color = getStatusColor(status);
  
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: center; position: relative;">
      <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>
      <div style="position: absolute; bottom: -8px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid ${color};"></div>
    </div>`,
    className: 'custom-leaflet-marker',
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -32]
  });
};

function FitImportedSurveyBounds({ projetos, geoFeatures }: { projetos: ProjetoMapItem[]; geoFeatures: ImportedGeoFeature[] }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([]);
    projetos.forEach((projeto) => {
      if (projeto.latitude != null && projeto.longitude != null) bounds.extend([projeto.latitude, projeto.longitude]);
    });
    geoFeatures.forEach((feature) => {
      if (!feature?.data || feature.visible === false) return;
      try {
        const layerBounds = L.geoJSON(feature.data).getBounds();
        if (layerBounds.isValid()) bounds.extend(layerBounds);
      } catch {
        // O backend expõe o erro da camada; uma geometria inválida não deve impedir as demais.
      }
    });
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 });
  }, [geoFeatures, map, projetos]);
  return null;
}

export function ProjetosMap({ projetos }: ProjetosMapProps) {
  const [geoFeatures, setGeoFeatures] = useState<ImportedGeoFeature[]>([]);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [baseMapUnavailable, setBaseMapUnavailable] = useState(() => !navigator.onLine);
  const [tileRetryKey, setTileRetryKey] = useState(0);

  useEffect(() => {
    const offline = () => setBaseMapUnavailable(true);
    const online = () => setTileRetryKey((value) => value + 1);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, []);

  useEffect(() => {
    if (projetos.length === 0) return;

    setTimeout(() => setLoadingGeo(true), 0);
    apiFetch('/api/arquivos/projetos/geo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projetoIds: projetos.map(p => p.id) })
    })
      .then(async (res) => await res.json() as { geoFeatures?: ImportedGeoFeature[] })
      .then(data => {
        if (data.geoFeatures) setGeoFeatures(data.geoFeatures);
        setLoadingGeo(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingGeo(false);
      });
  }, [projetos]);

  // Filter projects that have valid latitude and longitude
  const mapProjetos = projetos.filter(
    p => p.latitude !== null && p.latitude !== undefined && p.longitude !== null && p.longitude !== undefined
  );

  // Default center (Brazil) if no projects have coordinates
  const defaultCenter: [number, number] = [-14.2350, -51.9253];
  
  // Calculate center based on first project if available, or calculate an average
  const center: [number, number] = mapProjetos.length > 0
    ? [mapProjetos[0].latitude as number, mapProjetos[0].longitude as number]
    : defaultCenter;

  const zoom = mapProjetos.length > 0 ? 10 : 4;

  return (
    <div className="w-full h-[600px] rounded-[2rem] overflow-hidden shadow-[0_10px_30px_-10px_rgba(0,0,0,0.03)] ring-1 ring-zinc-900/5 relative z-0">
      {loadingGeo && (
        <div role="status" aria-live="polite" className="absolute right-4 top-4 z-[1000] flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-zinc-700 shadow-sm ring-1 ring-zinc-900/5 backdrop-blur-sm dark:bg-zinc-900/90 dark:text-zinc-200">
          <div aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent motion-reduce:animate-none"></div>
          <span className="text-xs font-medium">Carregando polígonos…</span>
        </div>
      )}
      <MapBaseNotice
        unavailable={baseMapUnavailable}
        onRetry={() => {
          setBaseMapUnavailable(!navigator.onLine);
          setTileRetryKey((value) => value + 1);
        }}
      />
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <FitImportedSurveyBounds projetos={mapProjetos} geoFeatures={geoFeatures} />
        <TileLayer
          key={tileRetryKey}
          attribution={MAP_TILE_ATTRIBUTION}
          url={MAP_TILE_URL}
          eventHandlers={{
            tileerror: () => setBaseMapUnavailable(true),
            load: () => setBaseMapUnavailable(false)
          }}
        />
        {mapProjetos.map((projeto) => (
          <Marker 
            key={projeto.id} 
            position={[projeto.latitude as number, projeto.longitude as number]}
            icon={getCustomIcon(projeto.status)}
          >
            <Popup className="rounded-xl overflow-hidden">
              <div className="p-1">
                <h3 className="font-bold text-zinc-950 dark:text-white mb-1">{projeto.nome}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{projeto.clienteNome}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  <span className="inline-block px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded text-xs uppercase font-semibold">
                    {projeto.status}
                  </span>
                  {projeto.areaHa && (
                    <span className="inline-block px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded text-xs uppercase font-semibold">
                      {projeto.areaHa} ha
                    </span>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        {geoFeatures.map((feature, i) => {
          if (!feature.data || feature.visible === false) return null;
          const proj = projetos.find(p => p.id === feature.projetoId);
          const color = getStatusColor(proj?.status);
          
          return (
            <GeoJSON 
              key={`geo-${i}`} 
              data={feature.data}
              style={{
                color: typeof feature.color === 'string' ? feature.color : color,
                weight: 2,
                opacity: typeof feature.opacity === 'number' ? feature.opacity : 0.8,
                fillColor: typeof feature.color === 'string' ? feature.color : color,
                fillOpacity: Math.min(0.55, (typeof feature.opacity === 'number' ? feature.opacity : 0.8) * 0.45)
              }}
              onEachFeature={(f, layer) => {
                const name = f.properties?.name || feature.fileName;
                layer.bindPopup(`
                  <div class="p-1">
                    <h3 class="font-bold text-zinc-950 mb-1">${proj?.nome || 'Projeto'}</h3>
                    <p class="text-xs text-zinc-500">${name}</p>
                  </div>
                `);
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
