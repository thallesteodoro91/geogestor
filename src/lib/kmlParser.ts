import { kml } from '@tmcw/togeojson';
import JSZip from 'jszip';
import * as turf from '@turf/turf';

export interface ParsedGeometry {
  geojson: GeoJSON.FeatureCollection;
  areaHa: number;
  perimetroM: number;
  centroide: { lat: number; lng: number };
  glebas: Array<{
    nome: string;
    areaHa: number;
    perimetroM: number;
  }>;
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function parseKmlKmz(file: File): Promise<ParsedGeometry> {
  let kmlContent: string;

  if (file.name.toLowerCase().endsWith('.kmz')) {
    // Descompactar KMZ
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Procurar arquivo KML dentro do ZIP
    const kmlFile = Object.keys(zip.files).find(
      name => name.toLowerCase().endsWith('.kml')
    );
    
    if (!kmlFile) {
      throw new Error('Nenhum arquivo KML encontrado dentro do KMZ');
    }
    
    kmlContent = await zip.files[kmlFile].async('text');
  } else {
    // Ler KML diretamente
    kmlContent = await readFileAsText(file);
  }

  // Parsear KML para GeoJSON
  const parser = new DOMParser();
  const kmlDoc = parser.parseFromString(kmlContent, 'text/xml');
  const geojson = kml(kmlDoc) as GeoJSON.FeatureCollection;

  if (!geojson.features || geojson.features.length === 0) {
    throw new Error('Nenhuma geometria encontrada no arquivo');
  }

  // Filtrar apenas polígonos e multipolígonos
  const polygonFeatures = geojson.features.filter(
    f => f.geometry && 
    (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  );

  if (polygonFeatures.length === 0) {
    throw new Error('Nenhum polígono encontrado no arquivo. Apenas polígonos são suportados.');
  }

  // Calcular métricas
  let totalAreaHa = 0;
  let totalPerimetroM = 0;
  const glebas: ParsedGeometry['glebas'] = [];

  polygonFeatures.forEach((feature, index) => {
    const area = turf.area(feature); // em m²
    const areaHa = area / 10000; // converter para hectares
    
    // Calcular perímetro
    let perimetro = 0;
    if (feature.geometry.type === 'Polygon') {
      const line = turf.lineString(feature.geometry.coordinates[0]);
      perimetro = turf.length(line, { units: 'meters' });
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach(poly => {
        const line = turf.lineString(poly[0]);
        perimetro += turf.length(line, { units: 'meters' });
      });
    }

    totalAreaHa += areaHa;
    totalPerimetroM += perimetro;

    glebas.push({
      nome: (feature.properties?.name as string) || `Gleba ${index + 1}`,
      areaHa: Math.round(areaHa * 100) / 100,
      perimetroM: Math.round(perimetro * 100) / 100
    });
  });

  // Calcular centroide de todos os polígonos
  const allFeatures = turf.featureCollection(polygonFeatures);
  const centroid = turf.centroid(allFeatures);
  const [lng, lat] = centroid.geometry.coordinates;

  return {
    geojson: { type: 'FeatureCollection', features: polygonFeatures },
    areaHa: Math.round(totalAreaHa * 100) / 100,
    perimetroM: Math.round(totalPerimetroM * 100) / 100,
    centroide: { lat, lng },
    glebas
  };
}
