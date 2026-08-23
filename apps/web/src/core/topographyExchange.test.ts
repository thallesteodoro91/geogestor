import assert from 'node:assert/strict';
import test from 'node:test';
import { exportPolygon, parseVerticesText, validatePolygonVertices } from './topographyExchange';
import { getSpatialReference } from './topographySpatial';

test('importa CSV geográfico e projetado com identificador de vértice', () => {
  const geographic = parseVerticesText('Vertice;Latitude;Longitude\nV1;-27,5945;-48,5477\nV2;-27,5946;-48,5478', 'geografica');
  assert.equal(geographic.errors.length, 0);
  assert.deepEqual(geographic.vertices[0], { lat: -27.5945, lng: -48.5477 });
  const projected = parseVerticesText('V1;745000,000;6940000,000\nV2;745100,000;6940100,000', 'projetada');
  assert.equal(projected.errors.length, 0);
  assert.deepEqual(projected.vertices[1], { x: 745100, y: 6940100 });
});

test('detecta vértice duplicado, auto-interseção e polígono degenerado', () => {
  const duplicate = validatePolygonVertices([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 'projetada');
  assert.deepEqual(duplicate.duplicateIndexes, [2]);
  const bowTie = validatePolygonVertices([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }], 'projetada');
  assert.equal(bowTie.selfIntersects, true);
  assert.equal(bowTie.degenerate, true);
});

test('exporta CSV, GeoJSON, KML e DXF com metadados do SRC', () => {
  const reference = getSpatialReference('EPSG:31982');
  assert.ok(reference);
  const projected = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  const csv = exportPolygon(projected, 'projetada', 'csv', reference);
  assert.match(csv.content, /EPSG:31982/);
  const geo = [{ lat: -27.5, lng: -48.5 }, { lat: -27.5, lng: -48.4 }, { lat: -27.4, lng: -48.4 }];
  assert.match(exportPolygon(geo, 'geografica', 'geojson', reference).content, /"Polygon"/);
  assert.match(exportPolygon(geo, 'geografica', 'kml', reference).content, /<Polygon>/);
  assert.match(exportPolygon(projected, 'projetada', 'dxf', reference).content, /POLYLINE/);
});
