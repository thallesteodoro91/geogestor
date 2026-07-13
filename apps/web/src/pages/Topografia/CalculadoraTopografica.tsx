import { useState, useEffect, useRef } from 'react';
import { Layout } from '../../components/Layout';
import { motion } from 'framer-motion';
import { Compass, Calculator, MapPin, Plus, Trash, Info, ArrowsLeftRight } from '@phosphor-icons/react';
import { 
  decimaisParaGMS, 
  gmsParaDecimais, 
  calcularDistanciaGeografica, 
  calcularAzimute, 
  calcularAreaPoligono, 
  calcularPerimetro, 
  metrosQuadradosParaHectares 
} from '../../core/topography';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '../../utils/cn';
import { geoTabButtonClass, geoTabListClass } from '../../utils/geoTheme';

export function CalculadoraTopografica() {
  const [activeTab, setActiveTab] = useState<'conversor' | 'distancia' | 'poligono'>('conversor');
  const topographyTabClass = (tab: typeof activeTab) =>
    cn(geoTabButtonClass(activeTab === tab, 'field'), 'shrink-0 rounded-full px-6 py-3');

  // ================= TAB 1: CONVERSOR GMS =================
  // GMS to Dec
  const [graus, setGraus] = useState(23);
  const [minutos, setMinutos] = useState(32);
  const [segundos, setSegundos] = useState(41.2);
  // Dec to GMS
  const [decInput, setDecInput] = useState(-46.6333);

  // Derived state
  const decResult = gmsParaDecimais(graus, minutos, segundos);
  const gmsResult = decimaisParaGMS(decInput);

  // ================= TAB 2: DISTÂNCIA / AZIMUTE =================
  const [pt1, setPt1] = useState({ lat: -23.5505, lng: -46.6333 }); // SP
  const [pt2, setPt2] = useState({ lat: -22.9068, lng: -43.1729 }); // RJ

  // Derived state
  const distGeo = calcularDistanciaGeografica(pt1.lat, pt1.lng, pt2.lat, pt2.lng);
  const azimuteResult = calcularAzimute(pt1.lng, pt1.lat, pt2.lng, pt2.lat);

  // ================= TAB 3: POLÍGONO / ÁREA =================
  // Brasília vertices demo
  const [vertices, setVertices] = useState<Array<{ lat: number; lng: number }>>([
    { lat: -15.793889, lng: -47.882778 },
    { lat: -15.798889, lng: -47.882778 },
    { lat: -15.798889, lng: -47.877778 },
    { lat: -15.793889, lng: -47.877778 }
  ]);
  const [newLat, setNewLat] = useState(-15.80);
  const [newLng, setNewLng] = useState(-47.87);

  // Derived state for area and perimeter of the polygon
  let areaCalc = 0;
  let perimetroCalc = 0;
  if (vertices.length >= 3) {
    const coordsPlanas = vertices.map(v => {
      const R = 6371000;
      const x = v.lng * Math.PI / 180 * R * Math.cos(v.lat * Math.PI / 180);
      const y = v.lat * Math.PI / 180 * R;
      return { x, y };
    });
    areaCalc = calcularAreaPoligono(coordsPlanas);
    perimetroCalc = calcularPerimetro(coordsPlanas);
  }

  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);

  // Recalcular área e perímetro do polígono e atualizar Leaflet
  useEffect(() => {
    // Atualizar mapa Leaflet
    if (miniMapInstanceRef.current && vertices.length >= 3) {
      if (polygonLayerRef.current) {
        polygonLayerRef.current.setLatLngs(vertices.map(v => [v.lat, v.lng]));
      } else {
        const poly = L.polygon(vertices.map(v => [v.lat, v.lng]), {
          color: '#4f46e5',
          fillColor: '#818cf8',
          fillOpacity: 0.3,
          weight: 3
        }).addTo(miniMapInstanceRef.current);
        polygonLayerRef.current = poly;
      }
      
      const bounds = L.latLngBounds(vertices.map(v => [v.lat, v.lng]));
      miniMapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [vertices]);

  // Inicializar o mini mapa no Tab 3
  useEffect(() => {
    if (activeTab === 'poligono' && miniMapContainerRef.current && !miniMapInstanceRef.current) {
      const map = L.map(miniMapContainerRef.current, { zoomControl: false }).setView([-15.793889, -47.882778], 14);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: ''
      }).addTo(map);

      miniMapInstanceRef.current = map;
    }

    return () => {
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
        polygonLayerRef.current = null;
      }
    };
  }, [activeTab]);

  const handleAddVertex = () => {
    if (isNaN(newLat) || isNaN(newLng)) return;
    setVertices(prev => [...prev, { lat: newLat, lng: newLng }]);
  };

  const handleRemoveVertex = (index: number) => {
    setVertices(prev => prev.filter((_, i) => i !== index));
    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
      polygonLayerRef.current = null;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] font-medium bg-zinc-100 text-zinc-500 dark:text-zinc-400 mb-4">
            SIG & Matemática
          </span>
          <h1 className="text-5xl font-semibold tracking-tighter text-zinc-950 dark:text-white">
            Cálculos Topográficos
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400 font-medium">
            Biblioteca de equações espaciais, distâncias e conversor de coordenadas.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Abas da calculadora topográfica" className={cn(geoTabListClass, 'mb-12 flex items-center gap-2 overflow-x-auto')}>
        <button 
          role="tab"
          aria-selected={activeTab === 'conversor'}
          onClick={() => setActiveTab('conversor')}
          className={topographyTabClass('conversor')}
        >
          <ArrowsLeftRight className="w-4 h-4" /> Conversor GMS / Decimal
        </button>
        <button 
          role="tab"
          aria-selected={activeTab === 'distancia'}
          onClick={() => setActiveTab('distancia')}
          className={topographyTabClass('distancia')}
        >
          <Compass className="w-4 h-4" /> Distâncias e Azimute
        </button>
        <button 
          role="tab"
          aria-selected={activeTab === 'poligono'}
          onClick={() => setActiveTab('poligono')}
          className={topographyTabClass('poligono')}
        >
          <Calculator className="w-4 h-4" /> Cálculo de Área (Shoelace)
        </button>
      </div>

      {/* Content Boxes */}
      <div className="max-w-4xl mx-auto">
        {activeTab === 'conversor' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {/* Box GMS to Decimal */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm">
              <h3 className="text-xl font-semibold text-zinc-950 dark:text-white mb-6">Graus, Minutos e Segundos para Graus Decimais</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="input-graus" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Graus (°)</label>
                  <input id="input-graus" type="number" value={graus} onChange={e => setGraus(Number(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div>
                  <label htmlFor="input-minutos" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Minutos (')</label>
                  <input id="input-minutos" type="number" value={minutos} onChange={e => setMinutos(Number(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div>
                  <label htmlFor="input-segundos" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Segundos (")</label>
                  <input id="input-segundos" type="number" step="any" value={segundos} onChange={e => setSegundos(Number(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Grau Decimal Resultante</span>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{decResult.toFixed(6)}°</p>
                </div>
              </div>
            </div>

            {/* Box Decimal to GMS */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm">
              <h3 className="text-xl font-semibold text-zinc-950 dark:text-white mb-6">Graus Decimais para Graus, Minutos e Segundos</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="input-dec-val" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">Valor Decimal</label>
                  <input id="input-dec-val" type="number" step="any" value={decInput} onChange={e => setDecInput(Number(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div className="pt-12 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold">GMS Resultante</span>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {gmsResult.graus}° {gmsResult.minutos}' {gmsResult.segundos.toFixed(2)}"
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'distancia' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ponto 1 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><MapPin className="text-indigo-500" /> Ponto de Partida (Pt 1)</h4>
                <div>
                  <label htmlFor="pt1-lat" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Latitude</label>
                  <input id="pt1-lat" type="number" step="any" value={pt1.lat} onChange={e => setPt1(prev => ({ ...prev, lat: Number(e.target.value) }))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div>
                  <label htmlFor="pt1-lng" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Longitude</label>
                  <input id="pt1-lng" type="number" step="any" value={pt1.lng} onChange={e => setPt1(prev => ({ ...prev, lng: Number(e.target.value) }))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
              </div>

              {/* Ponto 2 */}
              <div className="space-y-4">
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><MapPin className="text-indigo-500" /> Ponto de Destino (Pt 2)</h4>
                <div>
                  <label htmlFor="pt2-lat" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Latitude</label>
                  <input id="pt2-lat" type="number" step="any" value={pt2.lat} onChange={e => setPt2(prev => ({ ...prev, lat: Number(e.target.value) }))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div>
                  <label htmlFor="pt2-lng" className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Longitude</label>
                  <input id="pt2-lng" type="number" step="any" value={pt2.lng} onChange={e => setPt2(prev => ({ ...prev, lng: Number(e.target.value) }))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Distância Geográfica (Haversine)</span>
                <p className="text-4xl font-bold text-zinc-950 dark:text-white mt-1">
                  {(distGeo / 1000).toFixed(3)} km
                </p>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">{(distGeo).toFixed(2)} metros</span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Rumo / Azimute Topográfico</span>
                <p className="text-4xl font-bold text-zinc-950 dark:text-white mt-1">
                  {azimuteResult.toFixed(2)}°
                </p>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">Medido a partir do Norte geográfico</span>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'poligono' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Input list (X/Y vertices) */}
            <div className="lg:col-span-5 bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 ring-1 ring-zinc-900/5 shadow-sm flex flex-col justify-between min-h-[500px]">
              <div>
                <h3 className="text-lg font-semibold text-zinc-950 dark:text-white mb-6">Tabela de Coordenadas dos Vértices</h3>
                
                <div className="max-h-[220px] overflow-y-auto space-y-2 mb-6">
                  {vertices.map((v, index) => (
                    <div key={index} className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl">
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">V{index+1}</span>
                      <span className="text-xs text-zinc-800 dark:text-zinc-200">{v.lat.toFixed(6)}, {v.lng.toFixed(6)}</span>
                      <button onClick={() => handleRemoveVertex(index)} className="text-zinc-300 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md">
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {vertices.length === 0 && <p className="text-zinc-500 dark:text-zinc-400 text-sm">Nenhum vértice adicionado.</p>}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div>
                    <label htmlFor="new-vertex-lat" className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Latitude</label>
                    <input id="new-vertex-lat" type="number" step="any" value={newLat} onChange={e => setNewLat(Number(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                  </div>
                  <div>
                    <label htmlFor="new-vertex-lng" className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Longitude</label>
                    <input id="new-vertex-lng" type="number" step="any" value={newLng} onChange={e => setNewLng(Number(e.target.value))} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-950 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                  </div>
                </div>

                <button 
                  onClick={handleAddVertex}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-500 py-3 text-xs font-semibold text-white shadow-lg shadow-sky-900/15 ring-1 ring-white/10 transition-[transform,box-shadow,filter] duration-200 hover:brightness-110 hover:shadow-sky-900/25 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/25"
                >
                  <Plus className="w-4 h-4" /> Adicionar Vértice
                </button>
              </div>

              <div className="pt-6 mt-6 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Área Calculada</span>
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {metrosQuadradosParaHectares(areaCalc).toFixed(4)} ha
                  </p>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{(areaCalc).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} m²</span>
                </div>
                <div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Perímetro</span>
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {perimetroCalc.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} m
                  </p>
                </div>
              </div>
            </div>

            {/* Map Preview */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div 
                ref={miniMapContainerRef} 
                className="h-[400px] w-full rounded-[2.5rem] overflow-hidden ring-1 ring-zinc-900/5 shadow-sm z-10"
              />
              <div className="bg-indigo-950 text-indigo-200 rounded-2xl p-4 flex gap-3 items-start">
                <Info className="w-5 h-5 text-indigo-300 flex-shrink-0" />
                <p className="text-xs leading-relaxed">
                  <strong>Fórmula de Gauss (Shoelace)</strong> está sendo aplicada para calcular a área a partir das coordenadas projetadas no mini-mapa. Adicione vértices ordenados no sentido horário ou anti-horário.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
