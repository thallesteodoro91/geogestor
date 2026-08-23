import type { CoordinateMode, GeographicPosition, ProjectedPosition, SpatialReference } from './topographySpatial';

export type PolygonVertex = GeographicPosition | ProjectedPosition;
export type ExportFormat = 'csv' | 'geojson' | 'kml' | 'dxf';

export interface VertexValidation {
  duplicateIndexes: number[];
  selfIntersects: boolean;
  degenerate: boolean;
  messages: string[];
}

export interface ParsedVertices {
  vertices: PolygonVertex[];
  errors: string[];
}

function parseLocaleNumber(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseVerticesText(text: string, mode: CoordinateMode): ParsedVertices {
  const vertices: PolygonVertex[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
    const columns = line.split(delimiter).map((column) => column.trim()).filter(Boolean);
    if (index === 0 && columns.some((column) => /latitude|longitude|coordenada|v[eé]rtice|este|norte|^x$|^y$/i.test(column))) {
      continue;
    }
    const numericColumns = columns
      .map((column) => parseLocaleNumber(column))
      .filter((value): value is number => value !== null);
    const values = numericColumns.length >= 2 ? numericColumns.slice(-2) : [];
    if (values.length !== 2) {
      errors.push(`Linha ${index + 1}: informe duas coordenadas numéricas.`);
      continue;
    }
    if (mode === 'geografica') {
      const [lat, lng] = values;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        errors.push(`Linha ${index + 1}: latitude ou longitude fora dos limites.`);
        continue;
      }
      vertices.push({ lat, lng });
    } else {
      const [x, y] = values;
      vertices.push({ x, y });
    }
  }

  return { vertices, errors };
}

export function validatePolygonVertices(vertices: PolygonVertex[], mode: CoordinateMode): VertexValidation {
  const duplicateIndexes: number[] = [];
  const tolerance = mode === 'geografica' ? 1e-10 : 1e-4;
  const points = vertices.map((vertex) => mode === 'geografica'
    ? { x: (vertex as GeographicPosition).lng, y: (vertex as GeographicPosition).lat }
    : vertex as ProjectedPosition);

  for (let index = 0; index < points.length; index += 1) {
    if (points.slice(0, index).some((point) => Math.abs(point.x - points[index].x) <= tolerance && Math.abs(point.y - points[index].y) <= tolerance)) {
      duplicateIndexes.push(index);
    }
  }

  let selfIntersects = false;
  if (points.length >= 4) {
    for (let first = 0; first < points.length && !selfIntersects; first += 1) {
      const firstNext = (first + 1) % points.length;
      for (let second = first + 1; second < points.length; second += 1) {
        const secondNext = (second + 1) % points.length;
        if (first === second || firstNext === second || secondNext === first) continue;
        if (segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) {
          selfIntersects = true;
          break;
        }
      }
    }
  }

  const doubledArea = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  const degenerate = points.length >= 3 && Math.abs(doubledArea) <= tolerance;
  const messages = [
    ...(duplicateIndexes.length ? [`Remova ${duplicateIndexes.length} vértice(s) duplicado(s).`] : []),
    ...(selfIntersects ? ['O polígono possui arestas que se cruzam. Reordene os vértices.'] : []),
    ...(degenerate ? ['O polígono é degenerado e possui área zero.'] : []),
  ];
  return { duplicateIndexes, selfIntersects, degenerate, messages };
}

function segmentsIntersect(
  a: ProjectedPosition,
  b: ProjectedPosition,
  c: ProjectedPosition,
  d: ProjectedPosition,
) {
  const orientation = (p: ProjectedPosition, q: ProjectedPosition, r: ProjectedPosition) =>
    (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function exportPolygon(
  vertices: PolygonVertex[],
  mode: CoordinateMode,
  format: ExportFormat,
  reference: SpatialReference,
  sourceReference: SpatialReference = reference,
): { content: string; mimeType: string; extension: string } {
  if (vertices.length < 3) throw new Error('Adicione ao menos três vértices antes de exportar.');
  if (format === 'dxf' && mode !== 'projetada') {
    throw new Error('DXF está disponível somente para coordenadas X/Y projetadas.');
  }
  const generatedAt = new Date().toISOString();
  const metadata = { datum: reference.datum, epsg: reference.code, sourceDatum: sourceReference.datum, sourceEpsg: sourceReference.code, zone: sourceReference.zone ?? null, hemisphere: sourceReference.hemisphere ?? null, unit: mode === 'projetada' ? 'm' : 'grau', generatedAt };

  if (format === 'csv') {
    const header = mode === 'geografica' ? 'Vertice;Latitude;Longitude' : 'Vertice;X_Este_m;Y_Norte_m';
    const rows = vertices.map((vertex, index) => mode === 'geografica'
      ? `V${index + 1};${(vertex as GeographicPosition).lat};${(vertex as GeographicPosition).lng}`
      : `V${index + 1};${(vertex as ProjectedPosition).x};${(vertex as ProjectedPosition).y}`);
    return {
      content: [`# Datum: ${metadata.datum}`, `# SRC: ${metadata.epsg}`, `# SRC de origem: ${metadata.sourceEpsg}`, `# Fuso: ${metadata.zone ?? 'não aplicável'}`, `# Hemisfério: ${metadata.hemisphere ?? 'não aplicável'}`, `# Unidade: ${metadata.unit}`, `# Gerado em: ${generatedAt}`, header, ...rows].join('\r\n'),
      mimeType: 'text/csv;charset=utf-8',
      extension: 'csv',
    };
  }

  if (format === 'geojson') {
    const coordinates = vertices.map((vertex) => mode === 'geografica'
      ? [(vertex as GeographicPosition).lng, (vertex as GeographicPosition).lat]
      : [(vertex as ProjectedPosition).x, (vertex as ProjectedPosition).y]);
    coordinates.push([...coordinates[0]]);
    return {
      content: JSON.stringify({ type: 'Feature', properties: metadata, geometry: { type: 'Polygon', coordinates: [coordinates] } }, null, 2),
      mimeType: 'application/geo+json;charset=utf-8',
      extension: 'geojson',
    };
  }

  if (format === 'kml') {
    if (mode !== 'geografica') throw new Error('KML exige que as coordenadas X/Y sejam transformadas para longitude/latitude antes da exportação.');
    const coordinates = vertices.map((vertex) => `${(vertex as GeographicPosition).lng},${(vertex as GeographicPosition).lat},0`);
    coordinates.push(coordinates[0]);
    return {
      content: `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Polígono GeoGestor</name><ExtendedData><Data name="datum"><value>${metadata.datum}</value></Data><Data name="epsg"><value>${metadata.epsg}</value></Data><Data name="sourceEpsg"><value>${metadata.sourceEpsg}</value></Data><Data name="generatedAt"><value>${generatedAt}</value></Data></ExtendedData><Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates.join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`,
      mimeType: 'application/vnd.google-earth.kml+xml;charset=utf-8',
      extension: 'kml',
    };
  }

  const points = vertices as ProjectedPosition[];
  const dxfVertices = [...points, points[0]].flatMap((point) => ['0', 'VERTEX', '8', 'GEOGESTOR', '10', String(point.x), '20', String(point.y), '30', '0']);
  return {
    content: ['999', `GeoGestor | ${reference.code} | ${reference.datum} | ${generatedAt}`, '0', 'SECTION', '2', 'ENTITIES', '0', 'POLYLINE', '8', 'GEOGESTOR', '66', '1', '70', '1', ...dxfVertices, '0', 'SEQEND', '0', 'ENDSEC', '0', 'EOF'].join('\r\n'),
    mimeType: 'application/dxf;charset=utf-8',
    extension: 'dxf',
  };
}
