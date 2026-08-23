import type { GeoFeatureCollection, GeoGeometry, Position } from './geospatial-types';

function sqDistance(a: Position, b: Position) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function sqSegmentDistance(point: Position, start: Position, end: Position) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx || dy) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = end[0]; y = end[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyLine(points: Position[], tolerance: number) {
  if (points.length <= 2) return points;
  const sqTolerance = tolerance * tolerance;
  const radial: Position[] = [points[0]];
  let previous = points[0];
  for (let index = 1; index < points.length; index += 1) {
    if (sqDistance(points[index], previous) > sqTolerance) {
      radial.push(points[index]);
      previous = points[index];
    }
  }
  if (previous !== points.at(-1)) radial.push(points.at(-1)!);
  const markers = new Uint8Array(radial.length);
  markers[0] = markers[radial.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, radial.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let max = sqTolerance;
    let selected = -1;
    for (let index = first + 1; index < last; index += 1) {
      const distance = sqSegmentDistance(radial[index], radial[first], radial[last]);
      if (distance > max) { selected = index; max = distance; }
    }
    if (selected > 0) {
      markers[selected] = 1;
      stack.push([first, selected], [selected, last]);
    }
  }
  return radial.filter((_point, index) => markers[index]);
}

function simplifyGeometry(geometry: GeoGeometry | null, tolerance: number): GeoGeometry | null {
  if (!geometry || geometry.type === 'Point' || geometry.type === 'MultiPoint') return geometry;
  if (geometry.type === 'GeometryCollection') return { ...geometry, geometries: (geometry.geometries || []).map((item) => simplifyGeometry(item, tolerance) as GeoGeometry) };
  const coordinates = geometry.coordinates as any;
  if (geometry.type === 'LineString') return { ...geometry, coordinates: simplifyLine(coordinates, tolerance) };
  if (geometry.type === 'MultiLineString') return { ...geometry, coordinates: coordinates.map((line: Position[]) => simplifyLine(line, tolerance)) };
  const simplifyRing = (ring: Position[]) => {
    const closed = ring.length > 1 && ring[0][0] === ring.at(-1)?.[0] && ring[0][1] === ring.at(-1)?.[1];
    const core = closed ? ring.slice(0, -1) : ring;
    const simplified = simplifyLine(core, tolerance);
    if (simplified.length < 3) return ring;
    return [...simplified, [...simplified[0]]];
  };
  if (geometry.type === 'Polygon') return { ...geometry, coordinates: coordinates.map(simplifyRing) };
  if (geometry.type === 'MultiPolygon') return { ...geometry, coordinates: coordinates.map((polygon: Position[][]) => polygon.map(simplifyRing)) };
  return geometry;
}

export function countVertices(collection: GeoFeatureCollection) {
  let total = 0;
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') { total += 1; return; }
    value.forEach(visit);
  };
  const geometry = (item: GeoGeometry | null) => {
    if (!item) return;
    if (item.type === 'GeometryCollection') (item.geometries || []).forEach(geometry);
    else visit(item.coordinates);
  };
  collection.features.forEach((feature) => geometry(feature.geometry));
  return total;
}

export function buildDisplayCollections(collection: GeoFeatureCollection, vertexCount = countVertices(collection)) {
  const shouldSimplify = vertexCount > 10_000 || collection.features.length > 5_000;
  const make = (tolerance: number, featureLimit: number) => ({
    ...collection,
    features: (collection.features.length <= featureLimit
      ? collection.features
      : Array.from({ length: featureLimit }, (_item, index) => collection.features[Math.floor(index * collection.features.length / featureLimit)]))
      .map((feature) => ({ ...feature, geometry: simplifyGeometry(feature.geometry, tolerance) }))
  });
  return {
    simplified: shouldSimplify,
    levels: shouldSimplify
      ? { low: make(0.01, 5_000), medium: make(0.001, 20_000), high: make(0.0001, 75_000) }
      : { low: collection, medium: collection, high: collection }
  };
}

export function cropCollectionToBbox(collection: GeoFeatureCollection, bbox?: [number, number, number, number] | null) {
  if (!bbox) return collection;
  const intersects = (geometry: GeoGeometry | null) => {
    if (!geometry) return false;
    if (geometry.type === 'GeometryCollection') return (geometry.geometries || []).some(intersects);
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    const visit = (value: unknown) => {
      if (!Array.isArray(value)) return;
      if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
        minX = Math.min(minX, value[0]); minY = Math.min(minY, value[1]);
        maxX = Math.max(maxX, value[0]); maxY = Math.max(maxY, value[1]);
        return;
      }
      value.forEach(visit);
    };
    visit(geometry.coordinates);
    return maxX >= bbox[0] && minX <= bbox[2] && maxY >= bbox[1] && minY <= bbox[3];
  };
  return { ...collection, features: collection.features.filter((feature) => intersects(feature.geometry)) };
}

export function displayLevelForZoom(zoom: number) {
  if (zoom <= 8) return 'low' as const;
  if (zoom <= 14) return 'medium' as const;
  return 'high' as const;
}
