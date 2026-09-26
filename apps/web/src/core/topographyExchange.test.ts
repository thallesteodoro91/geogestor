import assert from 'node:assert/strict';
import test from 'node:test';
import { exportPolygon, parseSavedPolygonVertices, parseVerticesText, validatePolygonVertices } from './topographyExchange';
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
  const overlap = validatePolygonVertices([
    { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 },
    { x: 1, y: 4 }, { x: 1, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 3 }, { x: 0, y: 3 },
  ], 'projetada');
  assert.equal(overlap.selfIntersects, true);
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

test('bloqueia exportação inválida e fecha DXF apenas pela flag da polilinha', () => {
  const reference = getSpatialReference('EPSG:31982');
  assert.ok(reference);
  assert.throws(() => exportPolygon([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }], 'projetada', 'dxf', reference), /cruzam|inválid/i);
  const dxf = exportPolygon([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 'projetada', 'dxf', reference).content;
  assert.equal((dxf.match(/\r\nVERTEX\r\n/g) ?? []).length, 3);
});

test('preserva metadados e altitude dos vértices nas exportações', () => {
  const reference = getSpatialReference('EPSG:31982');
  assert.ok(reference);
  const projected = [
    { x: 742000, y: 6945000, code: 'M-01', description: 'Marco inicial', altitude: -2.5, precision: '0,02 m', notes: 'Conferido' },
    { x: 742010, y: 6945000 },
    { x: 742010, y: 6945010 },
  ];
  const csv = exportPolygon(projected, 'projetada', 'csv', reference).content;
  assert.match(csv, /Codigo;Descricao;Altitude_m;Precisao;Observacoes/);
  assert.match(csv, /M-01;Marco inicial;-2\.5;0,02 m;Conferido/);
  const dxf = exportPolygon(projected, 'projetada', 'dxf', reference).content;
  assert.match(dxf, /30\r\n-2\.5/);
});

test('rejeita shape legado inseguro sem perder vértices válidos', () => {
  assert.equal(parseSavedPolygonVertices(['inválido'], 'geografica'), null);
  assert.equal(parseSavedPolygonVertices([{ lat: -91, lng: -48 }], 'geografica'), null);
  assert.equal(parseSavedPolygonVertices([{ x: 1, y: 2, altitude: 'alta' }], 'projetada'), null);
  assert.deepEqual(parseSavedPolygonVertices([{ lat: -27.5, lng: -48.5, code: 'M1' }], 'geografica'), [{ lat: -27.5, lng: -48.5, code: 'M1', description: undefined, altitude: undefined, precision: undefined, notes: undefined }]);
});
