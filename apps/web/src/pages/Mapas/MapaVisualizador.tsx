import { FormSelect } from '../../components/Form';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Layout } from '../../components/Layout';
import { Globe, Compass, CloudArrowUp, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiFetch } from '../../services/apiClient';

// Corrigir ícones do Leaflet padrão
// @ts-expect-error - Leaflet _getIconUrl is an internal property without official TypeScript definitions
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface ClienteItem {
  id: string;
  nome: string;
  email?: string | null;
}

interface GeoFileItem {
  fileName: string;
  type: string;
  data: object;
}

export function MapaVisualizador() {
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<string>('');
  const [geoFiles, setGeoFiles] = useState<GeoFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geojsonLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // 1. Fetch clientes
  useEffect(() => {
    apiFetch('/api/clientes')
      .then(res => res.json())
      .then(data => {
        setClientes(data);
        if (data.length > 0) {
          setSelectedCliente(data[0].id);
        }
      });
  }, []);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      // Iniciar mapa centralizado no Brasil
      const map = L.map(mapContainerRef.current).setView([-15.793889, -47.882778], 4);
      
      // Adicionar camada do OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Camada para GeoJSONs/Polígonos do projeto
      const layerGroup = L.layerGroup().addTo(map);
      geojsonLayerGroupRef.current = layerGroup;

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 3. Fetch and Render GeoJSON/KML data when selected client changes
  useEffect(() => {
    if (!selectedCliente || !mapInstanceRef.current || !geojsonLayerGroupRef.current) return;

    setLoading(true);
    geojsonLayerGroupRef.current.clearLayers();

    apiFetch(`/api/arquivos/cliente/${selectedCliente}/geo`)
      .then(res => res.json())
      .then(data => {
        const features = (data.geoFeatures || []) as GeoFileItem[];
        setGeoFiles(features);

        const bounds = L.latLngBounds([]);
        let hasData = false;

        features.forEach((feature) => {
          if (feature.data) {
            // Plotar GeoJSON
            const geojsonLayer = L.geoJSON(feature.data as Parameters<typeof L.geoJSON>[0], {
              style: {
                color: '#4f46e5', // Indigo modern
                weight: 3,
                opacity: 0.8,
                fillColor: '#818cf8',
                fillOpacity: 0.3
              },
              onEachFeature: (f, layer) => {
                if (f.properties && f.properties.name) {
                  layer.bindPopup(`<strong>${f.properties.name}</strong>`);
                } else {
                  layer.bindPopup(`<strong>${feature.fileName}</strong>`);
                }
              }
            });

            if (geojsonLayerGroupRef.current) {
              geojsonLayerGroupRef.current.addLayer(geojsonLayer);
            }

            bounds.extend(geojsonLayer.getBounds());
            hasData = true;
          }
        });

        // Dar fitBounds se encontrou coordenadas
        if (mapInstanceRef.current) {
          if (hasData) {
            mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
          } else {
            // Reset para o Brasil se não tiver polígonos
            mapInstanceRef.current.setView([-15.793889, -47.882778], 4);
          }
        }

        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [selectedCliente, refreshKey]);



  const handleGeoUpload = async (file: File) => {
    if (!selectedCliente) {
      setUploadMessage('Selecione um cliente antes do upload.');
      return;
    }

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.kml', '.kmz', '.geojson', '.json'].includes(ext)) {
      setUploadMessage('Formato nao suportado. Envie KML, KMZ ou GeoJSON.');
      return;
    }

    setUploading(true);
    setUploadMessage('');

    try {
      const formData = new FormData();
      formData.append('clienteId', selectedCliente);
      formData.append('file', file);

      const res = await apiFetch('/api/arquivos/upload/stream', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao enviar arquivo');
      }

      setUploadMessage('Mapa enviado e vinculado ao cliente selecionado.');
      setRefreshKey((value) => value + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar mapa.';
      setUploadMessage(message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleGeoUpload(file);
    event.target.value = '';
  };

  const handleUploadDrag = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(event.type === 'dragenter' || event.type === 'dragover');
  };

  const handleUploadDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (file) await handleGeoUpload(file);
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
            SIG / Cartografia
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
            Painel de Mapas
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Visualização interativa das áreas e polígonos de seus projetos topográficos.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <FormSelect
            value={selectedCliente} 
            onChange={e => setSelectedCliente(e.target.value)}
            className="bg-white dark:bg-zinc-900 ring-1 ring-zinc-900/5 shadow-sm rounded-xl px-4 py-3 text-sm text-zinc-700 focus:outline-none min-w-[200px]"
          >
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </FormSelect>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar / Files detected */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03)] lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-semibold text-zinc-950 dark:text-white mb-6 flex items-center gap-3">
              <Compass weight="duotone" className="text-zinc-400 w-6 h-6" /> Camadas Geográficas
            </h3>
            
            <div
              onDragEnter={handleUploadDrag}
              onDragOver={handleUploadDrag}
              onDragLeave={handleUploadDrag}
              onDrop={handleUploadDrop}
              className={`mb-6 rounded-2xl border-2 border-dashed p-5 transition-all ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950 hover:border-emerald-300'
              }`}
            >
              <input
                id="geo-file-upload"
                type="file"
                accept=".kml,.kmz,.geojson,.json"
                className="hidden"
                onChange={handleFileChange}
                disabled={!selectedCliente || uploading}
              />
              <label htmlFor="geo-file-upload" className="flex cursor-pointer flex-col items-center gap-3 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 bg-white text-emerald-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-emerald-400">
                  <CloudArrowUp weight="duotone" className="h-6 w-6" />
                </span>
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {uploading ? 'Enviando mapa...' : 'Enviar KML/KMZ do cliente'}
                </span>
                <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  O arquivo sera salvo na pasta do cliente selecionado e carregado no mapa.
                </span>
              </label>
              {uploadMessage && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-zinc-600 ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10">
                  {uploadMessage.includes('enviado') ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                  ) : (
                    <WarningCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                  )}
                  <span>{uploadMessage}</span>
                </div>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-zinc-400">Analisando arquivos geo...</p>
            ) : geoFiles.length === 0 ? (
              <div className="text-zinc-400 text-sm space-y-2 leading-relaxed">
                <p>Nenhum arquivo de dados geográficos compatível foi encontrado na pasta deste projeto.</p>
                <p className="text-xs">Extensões suportadas para visualização instantânea:</p>
                <ul className="list-disc pl-4 text-xs space-y-1">
                  <li>.kml</li>
                  <li>.kmz</li>
                  <li>.geojson</li>
                  <li>.json (padrão GeoJSON)</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-3">
                {geoFiles.map(file => (
                  <div key={file.fileName} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl">
                    <Globe className="text-indigo-500 w-5 h-5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate" title={file.fileName}>
                        {file.fileName}
                      </p>
                      <p className="text-xs text-zinc-400 uppercase tracking-wider">{file.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-6 mt-6 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs uppercase font-bold text-zinc-400 tracking-widest block mb-2">Instrução</span>
            <p className="text-xs text-zinc-400 leading-relaxed">
              O visualizador carrega dinamicamente arquivos KML, KMZ ou GeoJSON da pasta local do cliente. Envie o mapa por aqui ou coloque os arquivos geograficos no diretorio do cliente.
            </p>
          </div>
        </div>

        {/* Map Container */}
        <div className="lg:col-span-3">
          <div 
            ref={mapContainerRef} 
            className="h-[600px] w-full rounded-[2.5rem] overflow-hidden ring-1 ring-zinc-900/5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.03)] z-10"
          />
        </div>
      </div>
    </Layout>
  );
}
