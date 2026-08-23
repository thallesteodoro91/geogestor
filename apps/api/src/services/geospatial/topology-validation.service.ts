import type { GeospatialTopologyIssue } from '@geogestor/contracts';
import type { GeoFeatureCollection, GeoGeometry, Position } from './geospatial-types';

const MAX_SEGMENTS_FOR_INTERSECTION_CHECK = 5_000;

function samePosition(a?: Position, b?: Position) {
  return Boolean(a && b && a[0] === b[0] && a[1] === b[1]);
}

function signedRingArea(ring: Position[]) {
  let sum = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    sum += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  return sum / 2;
}

function orientation(a: Position, b: Position, c: Position) {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-14) return 0;
  return value > 0 ? 1 : 2;
}

function segmentsIntersect(a: Position, b: Position, c: Position, d: Position) {
  return orientation(a, b, c) !== orientation(a, b, d)
    && orientation(c, d, a) !== orientation(c, d, b);
}

function pointInRing([x, y]: Position, ring: Position[]) {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const a = ring[current];
    const b = ring[previous];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function validateRing(ring: Position[], featureIndex: number, path: string, isOuter: boolean) {
  const issues: GeospatialTopologyIssue[] = [];
  if (!Array.isArray(ring) || ring.length < 4) {
    issues.push({ code: 'ring_too_short', severity: 'blocking', message: 'O anel possui menos de quatro posições.', featureIndex, geometryPath: path });
    return issues;
  }
  if (!samePosition(ring[0], ring.at(-1))) {
    issues.push({ code: 'ring_not_closed', severity: 'warning', message: 'O anel não está fechado.', featureIndex, geometryPath: path, repairAvailable: true });
  }
  if (ring.some((position) => !Array.isArray(position) || position.length < 2 || !Number.isFinite(position[0]) || !Number.isFinite(position[1]))) {
    issues.push({ code: 'invalid_coordinate', severity: 'blocking', message: 'O anel contém coordenada não numérica.', featureIndex, geometryPath: path });
  }
  if (ring.some((position, index) => index > 0 && samePosition(position, ring[index - 1]))) {
    issues.push({ code: 'consecutive_duplicate', severity: 'warning', message: 'O anel contém vértices consecutivos duplicados.', featureIndex, geometryPath: path, repairAvailable: true });
  }
  const area = signedRingArea(ring);
  if (Math.abs(area) < 1e-14) issues.push({ code: 'degenerate_ring', severity: 'blocking', message: 'O anel é degenerado e não possui área útil.', featureIndex, geometryPath: path });
  const expectedPositive = isOuter;
  if (Math.abs(area) >= 1e-14 && (area > 0) !== expectedPositive) {
    issues.push({ code: 'ring_orientation', severity: 'info', message: 'A orientação do anel difere da convenção GeoJSON.', featureIndex, geometryPath: path, repairAvailable: true });
  }
  const segmentCount = ring.length - 1;
  if (segmentCount <= MAX_SEGMENTS_FOR_INTERSECTION_CHECK) {
    outer: for (let first = 0; first < segmentCount; first += 1) {
      for (let second = first + 2; second < segmentCount; second += 1) {
        if (first === 0 && second === segmentCount - 1) continue;
        if (segmentsIntersect(ring[first], ring[first + 1], ring[second], ring[second + 1])) {
          issues.push({ code: 'self_intersection', severity: 'blocking', message: 'O anel possui autointerseção.', featureIndex, geometryPath: path });
          break outer;
        }
      }
    }
  } else {
    issues.push({ code: 'intersection_check_skipped', severity: 'info', message: 'A verificação de autointerseção foi abreviada devido ao número de vértices.', featureIndex, geometryPath: path });
  }
  return issues;
}

function validatePolygon(rings: Position[][], featureIndex: number, path: string) {
  if (!rings?.length) return [{ code: 'empty_polygon', severity: 'blocking', message: 'O polígono não possui anéis.', featureIndex, geometryPath: path }] satisfies GeospatialTopologyIssue[];
  const issues = rings.flatMap((ring, index) => validateRing(ring, featureIndex, `${path}.rings[${index}]`, index === 0));
  for (let index = 1; index < rings.length; index += 1) {
    const sample = rings[index]?.[0];
    if (sample && !pointInRing(sample, rings[0])) {
      issues.push({ code: 'hole_outside_shell', severity: 'blocking', message: 'Um anel interno está fora do anel externo.', featureIndex, geometryPath: `${path}.rings[${index}]` });
    }
  }
  return issues;
}

function validateGeometry(geometry: GeoGeometry | null, featureIndex: number, path: string): GeospatialTopologyIssue[] {
  if (!geometry) return [{ code: 'null_geometry', severity: 'warning', message: 'A feição não possui geometria.', featureIndex, geometryPath: path }];
  const coordinates = geometry.coordinates as any;
  if (geometry.type === 'GeometryCollection') {
    if (!geometry.geometries?.length) return [{ code: 'empty_geometry_collection', severity: 'warning', message: 'A coleção de geometrias está vazia.', featureIndex, geometryPath: path }];
    return geometry.geometries.flatMap((child, index) => validateGeometry(child, featureIndex, `${path}.geometries[${index}]`));
  }
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return [{ code: 'empty_geometry', severity: 'blocking', message: 'A geometria está vazia.', featureIndex, geometryPath: path }];
  }
  if (geometry.type === 'Polygon') return validatePolygon(coordinates, featureIndex, path);
  if (geometry.type === 'MultiPolygon') return coordinates.flatMap((polygon: Position[][], index: number) => validatePolygon(polygon, featureIndex, `${path}.polygons[${index}]`));
  return [];
}

export function validateTopology(collection: GeoFeatureCollection) {
  return collection.features.flatMap((feature, index) => validateGeometry(feature.geometry, index, `features[${index}].geometry`));
}

function repairRing(ring: Position[], isOuter: boolean) {
  const deduplicated = ring.filter((position, index) => index === 0 || !samePosition(position, ring[index - 1]));
  if (deduplicated.length && !samePosition(deduplicated[0], deduplicated.at(-1))) deduplicated.push([...deduplicated[0]]);
  if (deduplicated.length >= 4 && (signedRingArea(deduplicated) > 0) !== isOuter) deduplicated.reverse();
  return deduplicated;
}

export function repairSafeTopology(collection: GeoFeatureCollection) {
  const repairs = new Set<string>();
  const repairGeometry = (geometry: GeoGeometry | null): GeoGeometry | null => {
    if (!geometry) return null;
    if (geometry.type === 'GeometryCollection') return { ...geometry, geometries: (geometry.geometries || []).map((item) => repairGeometry(item) as GeoGeometry) };
    if (geometry.type === 'Polygon') {
      repairs.add('Fechamento, remoção de duplicatas e orientação de anéis');
      return { ...geometry, coordinates: (geometry.coordinates as Position[][]).map((ring, index) => repairRing(ring, index === 0)) };
    }
    if (geometry.type === 'MultiPolygon') {
      repairs.add('Fechamento, remoção de duplicatas e orientação de anéis');
      return { ...geometry, coordinates: (geometry.coordinates as Position[][][]).map((polygon) => polygon.map((ring, index) => repairRing(ring, index === 0))) };
    }
    return geometry;
  };
  return {
    collection: { ...collection, features: collection.features.map((feature) => ({ ...feature, geometry: repairGeometry(feature.geometry) })) },
    repairs: [...repairs]
  };
}

export function annotateProblemFeatures(collection: GeoFeatureCollection, issues: GeospatialTopologyIssue[]) {
  const byFeature = new Map<number, GeospatialTopologyIssue[]>();
  for (const issue of issues) {
    if (issue.featureIndex === undefined) continue;
    byFeature.set(issue.featureIndex, [...(byFeature.get(issue.featureIndex) || []), issue]);
  }
  return {
    ...collection,
    features: collection.features.map((feature, index) => ({
      ...feature,
      properties: byFeature.has(index)
        ? { ...(feature.properties || {}), __geogestor_issues: byFeature.get(index)?.map((issue) => issue.message), __geogestor_invalid: true }
        : feature.properties
    }))
  };
}
