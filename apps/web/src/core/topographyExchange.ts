import type { CoordinateMode, GeographicPosition, ProjectedPosition, SpatialReference } from './topographySpatial';

export interface PolygonVertexMetadata {
  code?: string;
  description?: string;
  altitude?: number;
  precision?: string;
  notes?: string;
}
export type PolygonVertex = (GeographicPosition | ProjectedPosition) & PolygonVertexMetadata;
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

export function parseSavedPolygonVertices(value: unknown, mode: CoordinateMode): PolygonVertex[] | null {
  if (!Array.isArray(value) || value.length > 10_000) return null;
  const parsed: PolygonVertex[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
    const record = candidate as Record<string, unknown>;
    const first = mode === 'geografica' ? record.lat : record.x;
    const second = mode === 'geografica' ? record.lng : record.y;
    if (typeof first !== 'number' || !Number.isFinite(first) || typeof second !== 'number' || !Number.isFinite(second)) return null;
    if (mode === 'geografica' && (first < -90 || first > 90 || second < -180 || second > 180)) return null;
    if (record.altitude !== undefined && (typeof record.altitude !== 'number' || !Number.isFinite(record.altitude))) return null;
    if (['code', 'description', 'precision', 'notes'].some((key) => record[key] !== undefined && typeof record[key] !== 'string')) return null;
    const metadata: PolygonVertexMetadata = {
      code: typeof record.code === 'string' ? record.code : undefined,
      description: typeof record.description === 'string' ? record.description : undefined,
      altitude: typeof record.altitude === 'number' ? record.altitude : undefined,
      precision: typeof record.precision === 'string' ? record.precision : undefined,
      notes: typeof record.notes === 'string' ? record.notes : undefined,
    };
    parsed.push(mode === 'geografica'
      ? { lat: first, lng: second, ...metadata }
      : { x: first, y: second, ...metadata });
  }
  return parsed;
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
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSegment = (p: ProjectedPosition, q: ProjectedPosition, r: ProjectedPosition) =>
    q.x >= Math.min(p.x, r.x) - 1e-12 && q.x <= Math.max(p.x, r.x) + 1e-12
    && q.y >= Math.min(p.y, r.y) - 1e-12 && q.y <= Math.max(p.y, r.y) + 1e-12;
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  if (Math.abs(o1) <= 1e-12 && onSegment(a, c, b)) return true;
  if (Math.abs(o2) <= 1e-12 && onSegment(a, d, b)) return true;
  if (Math.abs(o3) <= 1e-12 && onSegment(c, a, d)) return true;
  return Math.abs(o4) <= 1e-12 && onSegment(c, b, d);
}

function csvValue(value: unknown) {
  if (value === undefined || value === null) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text) && typeof value === 'string') text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function xmlValue(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function exportPolygon(
  vertices: PolygonVertex[],
  mode: CoordinateMode,
  format: ExportFormat,
  reference: SpatialReference,
  sourceReference: SpatialReference = reference,
): { content: string; mimeType: string; extension: string } {
  if (vertices.length < 3) throw new Error('Adicione ao menos três vértices antes de exportar.');
  const validation = validatePolygonVertices(vertices, mode);
  if (validation.messages.length) throw new Error(`A geometria é inválida: ${validation.messages.join(' ')}`);
  if (format === 'dxf' && mode !== 'projetada') {
    throw new Error('DXF está disponível somente para coordenadas X/Y projetadas.');
  }
  const generatedAt = new Date().toISOString();
  const metadata = { datum: reference.datum, epsg: reference.code, sourceDatum: sourceReference.datum, sourceEpsg: sourceReference.code, zone: sourceReference.zone ?? null, hemisphere: sourceReference.hemisphere ?? null, unit: mode === 'projetada' ? 'm' : 'grau', generatedAt };

  if (format === 'csv') {
    const header = mode === 'geografica'
      ? 'Vertice;Latitude;Longitude;Codigo;Descricao;Altitude_m;Precisao;Observacoes'
      : 'Vertice;X_Este_m;Y_Norte_m;Codigo;Descricao;Altitude_m;Precisao;Observacoes';
    const rows = vertices.map((vertex, index) => mode === 'geografica'
      ? [`V${index + 1}`, (vertex as GeographicPosition).lat, (vertex as GeographicPosition).lng, vertex.code, vertex.description, vertex.altitude, vertex.precision, vertex.notes].map(csvValue).join(';')
      : [`V${index + 1}`, (vertex as ProjectedPosition).x, (vertex as ProjectedPosition).y, vertex.code, vertex.description, vertex.altitude, vertex.precision, vertex.notes].map(csvValue).join(';'));
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
      content: JSON.stringify({ type: 'Feature', properties: { ...metadata, vertices: vertices.map(({ code, description, altitude, precision, notes }, index) => ({ index: index + 1, code: code ?? null, description: description ?? null, altitude: altitude ?? null, precision: precision ?? null, notes: notes ?? null })) }, geometry: { type: 'Polygon', coordinates: [coordinates] } }, null, 2),
      mimeType: 'application/geo+json;charset=utf-8',
      extension: 'geojson',
    };
  }

  if (format === 'kml') {
    if (mode !== 'geografica') throw new Error('KML exige que as coordenadas X/Y sejam transformadas para longitude/latitude antes da exportação.');
    const coordinates = vertices.map((vertex) => `${(vertex as GeographicPosition).lng},${(vertex as GeographicPosition).lat},${vertex.altitude ?? 0}`);
    coordinates.push(coordinates[0]);
    const vertexMetadata = JSON.stringify(vertices.map(({ code, description, altitude, precision, notes }, index) => ({ index: index + 1, code, description, altitude, precision, notes })));
    return {
      content: `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Polígono GeoGestor</name><ExtendedData><Data name="datum"><value>${xmlValue(metadata.datum)}</value></Data><Data name="epsg"><value>${xmlValue(metadata.epsg)}</value></Data><Data name="sourceEpsg"><value>${xmlValue(metadata.sourceEpsg)}</value></Data><Data name="generatedAt"><value>${xmlValue(generatedAt)}</value></Data><Data name="vertexMetadata"><value>${xmlValue(vertexMetadata)}</value></Data></ExtendedData><Placemark><Polygon><altitudeMode>absolute</altitudeMode><outerBoundaryIs><LinearRing><coordinates>${coordinates.join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`,
      mimeType: 'application/vnd.google-earth.kml+xml;charset=utf-8',
      extension: 'kml',
    };
  }

  const points = vertices as Array<ProjectedPosition & PolygonVertexMetadata>;
  const dxfVertices = points.flatMap((point) => ['0', 'VERTEX', '8', 'GEOGESTOR', '10', String(point.x), '20', String(point.y), '30', String(point.altitude ?? 0), ...(point.code ? ['999', `Codigo: ${point.code}`] : []), ...(point.description ? ['999', `Descricao: ${point.description}`] : [])]);
  return {
    content: ['999', `GeoGestor | ${reference.code} | ${reference.datum} | ${generatedAt}`, '0', 'SECTION', '2', 'ENTITIES', '0', 'POLYLINE', '8', 'GEOGESTOR', '66', '1', '70', '1', ...dxfVertices, '0', 'SEQEND', '0', 'ENDSEC', '0', 'EOF'].join('\r\n'),
    mimeType: 'application/dxf;charset=utf-8',
    extension: 'dxf',
  };
}
