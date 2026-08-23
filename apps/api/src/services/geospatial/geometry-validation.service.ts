import type { GeoFeatureCollection, GeoGeometry, Position } from './geospatial-types';
import { transformPosition } from './crs-detection.service';

const EARTH_RADIUS_M = 6371008.8;
const BRAZIL_BOUNDS = [-74.5, -34.5, -32.0, 5.5] as const;

function mapCoordinates(value: unknown, mapper: (position: Position) => Position): unknown {
  if (!Array.isArray(value)) return value;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    return mapper(value as Position);
  }
  return value.map((item) => mapCoordinates(item, mapper));
}

export function mapGeometryPositions(geometry: GeoGeometry | null, mapper: (position: Position) => Position): GeoGeometry | null {
  if (!geometry) return null;
  if (geometry.type === 'GeometryCollection') {
    return { ...geometry, geometries: (geometry.geometries || []).map((item) => mapGeometryPositions(item, mapper) as GeoGeometry) };
  }
  return { ...geometry, coordinates: mapCoordinates(geometry.coordinates, mapper) };
}

export function normalizeCollection(
  collection: GeoFeatureCollection,
  sourceCrs: string,
  axisOrder: 'longitude-latitude' | 'latitude-longitude' = 'longitude-latitude'
): GeoFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => ({
      ...feature,
      geometry: mapGeometryPositions(feature.geometry, (position) => transformPosition(position, sourceCrs, axisOrder === 'latitude-longitude'))
    }))
  };
}

export function collectPositions(collection: GeoFeatureCollection): Position[] {
  const positions: Position[] = [];
  const collect = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
      positions.push(value as Position);
      return;
    }
    value.forEach(collect);
  };
  const visit = (geometry: GeoGeometry | null) => {
    if (!geometry) return;
    if (geometry.type === 'GeometryCollection') (geometry.geometries || []).forEach(visit);
    else collect(geometry.coordinates);
  };
  collection.features.forEach((feature) => visit(feature.geometry));
  return positions;
}

export function validateNormalizedCollection(collection: GeoFeatureCollection) {
  const warnings: string[] = [];
  if (!collection.features.length) throw new Error('O arquivo não contém feições geográficas.');
  const positions = collectPositions(collection);
  if (!positions.length) throw new Error('O arquivo não contém coordenadas utilizáveis.');
  for (const [longitude, latitude] of positions) {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      throw new Error('As coordenadas resultantes estão fora dos limites de longitude/latitude. Verifique o SRC e a ordem dos eixos.');
    }
  }
  const inBrazil = positions.some(([longitude, latitude]) => (
    longitude >= BRAZIL_BOUNDS[0] && longitude <= BRAZIL_BOUNDS[2]
      && latitude >= BRAZIL_BOUNDS[1] && latitude <= BRAZIL_BOUNDS[3]
  ));
  if (!inBrazil) warnings.push('A geometria está fora dos limites aproximados do Brasil. Confirme o SRC e a ordem dos eixos.');
  return warnings;
}

export function detectLikelySwappedBrazilianAxes(collection: GeoFeatureCollection) {
  const sample = collectPositions(collection).slice(0, 200);
  if (!sample.length) return false;
  const standard = sample.filter(([x, y]) => x >= -74.5 && x <= -32 && y >= -34.5 && y <= 5.5).length;
  const swapped = sample.filter(([x, y]) => y >= -74.5 && y <= -32 && x >= -34.5 && x <= 5.5).length;
  return swapped / sample.length > 0.8 && standard / sample.length < 0.2;
}

export function collectionBbox(collection: GeoFeatureCollection): [number, number, number, number] {
  const positions = collectPositions(collection);
  return positions.reduce<[number, number, number, number]>((box, [x, y]) => [
    Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)
  ], [Infinity, Infinity, -Infinity, -Infinity]);
}

function toRadians(value: number) { return value * Math.PI / 180; }

function haversine(a: Position, b: Position) {
  const dLat = toRadians(b[1] - a[1]);
  const dLon = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function ringArea(ring: Position[]) {
  let sum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    sum += toRadians(next[0] - current[0]) * (2 + Math.sin(toRadians(current[1])) + Math.sin(toRadians(next[1])));
  }
  return Math.abs(sum * EARTH_RADIUS_M * EARTH_RADIUS_M / 2);
}

function lineLength(line: Position[]) {
  let total = 0;
  for (let index = 1; index < line.length; index += 1) total += haversine(line[index - 1], line[index]);
  return total;
}

function geometryMetrics(geometry: GeoGeometry | null): { area: number; perimeter: number } {
  if (!geometry) return { area: 0, perimeter: 0 };
  const c = geometry.coordinates as any;
  if (geometry.type === 'LineString') return { area: 0, perimeter: lineLength(c || []) };
  if (geometry.type === 'MultiLineString') return { area: 0, perimeter: (c || []).reduce((sum: number, line: Position[]) => sum + lineLength(line), 0) };
  if (geometry.type === 'Polygon') return {
    area: (c || []).reduce((sum: number, ring: Position[], index: number) => index === 0 ? sum + ringArea(ring) : sum - ringArea(ring), 0),
    perimeter: (c || []).reduce((sum: number, ring: Position[]) => sum + lineLength(ring), 0)
  };
  if (geometry.type === 'MultiPolygon') return (c || []).reduce((sum: { area: number; perimeter: number }, polygon: Position[][]) => {
    const metric = geometryMetrics({ type: 'Polygon', coordinates: polygon });
    return { area: sum.area + metric.area, perimeter: sum.perimeter + metric.perimeter };
  }, { area: 0, perimeter: 0 });
  if (geometry.type === 'GeometryCollection') return (geometry.geometries || []).reduce((sum, item) => {
    const metric = geometryMetrics(item);
    return { area: sum.area + metric.area, perimeter: sum.perimeter + metric.perimeter };
  }, { area: 0, perimeter: 0 });
  return { area: 0, perimeter: 0 };
}

export function collectionMetrics(collection: GeoFeatureCollection) {
  const types = new Set<string>();
  const metric = collection.features.reduce((total, feature) => {
    if (feature.geometry) types.add(feature.geometry.type);
    const current = geometryMetrics(feature.geometry);
    return { areaM2: total.areaM2 + current.area, perimeterM: total.perimeterM + current.perimeter };
  }, { areaM2: 0, perimeterM: 0 });
  return { ...metric, geometryTypes: [...types].sort() };
}

function pointInRing([x, y]: Position, ring: Position[]) {
  let inside = false;
  for (let currentIndex = 0, previousIndex = ring.length - 1; currentIndex < ring.length; previousIndex = currentIndex++) {
    const current = ring[currentIndex];
    const previous = ring[previousIndex];
    const crossesRay = (current[1] > y) !== (previous[1] > y)
      && x < ((previous[0] - current[0]) * (y - current[1])) / (previous[1] - current[1]) + current[0];
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: Position, rings: Position[][]) {
  return Boolean(rings[0]?.length && pointInRing(point, rings[0])
    && !rings.slice(1).some((hole) => pointInRing(point, hole)));
}

function polygonInteriorPoint(rings: Position[][]): Position | null {
  const outer = rings[0] || [];
  if (outer.length < 3) return null;

  const ys = [...new Set(outer.map((position) => position[1]).filter(Number.isFinite))].sort((a, b) => a - b);
  const scanlines = [
    (ys[0] + ys[ys.length - 1]) / 2,
    ...ys.slice(1).map((value, index) => (ys[index] + value) / 2)
  ].filter(Number.isFinite);
  let best: { point: Position; width: number } | null = null;

  for (const y of scanlines) {
    const intersections: number[] = [];
    for (const ring of rings) {
      for (let index = 0; index < ring.length; index += 1) {
        const start = ring[index];
        const end = ring[(index + 1) % ring.length];
        if ((start[1] > y) === (end[1] > y)) continue;
        intersections.push(start[0] + ((y - start[1]) * (end[0] - start[0])) / (end[1] - start[1]));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let index = 0; index < intersections.length - 1; index += 1) {
      const left = intersections[index];
      const right = intersections[index + 1];
      const candidate: Position = [(left + right) / 2, y];
      const width = right - left;
      if (width > 0 && pointInPolygon(candidate, rings) && (!best || width > best.width)) {
        best = { point: candidate, width };
      }
    }
  }
  return best?.point || null;
}

function geometryRepresentativePosition(geometry: GeoGeometry | null): Position | null {
  if (!geometry) return null;
  const coordinates = geometry.coordinates as any;
  if (geometry.type === 'Point') return coordinates as Position;
  if (geometry.type === 'MultiPoint') return coordinates?.[0] || null;
  if (geometry.type === 'LineString') return coordinates?.[Math.floor(coordinates.length / 2)] || null;
  if (geometry.type === 'MultiLineString') {
    const longest = [...(coordinates || [])].sort((a: Position[], b: Position[]) => b.length - a.length)[0];
    return longest?.[Math.floor(longest.length / 2)] || null;
  }
  if (geometry.type === 'Polygon') return polygonInteriorPoint(coordinates || []);
  if (geometry.type === 'MultiPolygon') {
    const polygons = [...(coordinates || [])].sort((a: Position[][], b: Position[][]) => ringArea(b[0] || []) - ringArea(a[0] || []));
    for (const polygon of polygons) {
      const point = polygonInteriorPoint(polygon);
      if (point) return point;
    }
  }
  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries || []) {
      const point = geometryRepresentativePosition(child);
      if (point) return point;
    }
  }
  return null;
}

export function representativePoint(collection: GeoFeatureCollection, bbox = collectionBbox(collection)) {
  for (const feature of collection.features) {
    const point = geometryRepresentativePosition(feature.geometry);
    if (point) return { longitude: point[0], latitude: point[1] };
  }
  // Centro dos limites é estável para o enquadramento; a interface o apresenta como localização representativa, não como vértice técnico.
  return { longitude: (bbox[0] + bbox[2]) / 2, latitude: (bbox[1] + bbox[3]) / 2 };
}
