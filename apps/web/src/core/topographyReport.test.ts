import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTopographyReportDefinition } from './topographyReport';
import { getSpatialReference } from './topographySpatial';

test('monta memória de cálculo PDF com SRC, método, resultados e coordenadas', () => {
  const reference = getSpatialReference('EPSG:31982');
  assert.ok(reference);
  const definition = buildTopographyReportDefinition({
    title: 'Memória de cálculo do imóvel',
    client: 'Cliente teste',
    project: 'Projeto teste',
    responsible: 'Responsável teste',
    mode: 'projetada',
    reference,
    vertices: [{ x: 742000, y: 6945275 }, { x: 742100, y: 6945275 }, { x: 742100, y: 6945375 }],
    area: 5000,
    perimeter: 341.421,
    method: 'Gauss e distância plana',
    warnings: ['Conferir memorial original.'],
  });
  const serialized = JSON.stringify(definition);
  assert.match(serialized, /Memória de cálculo do imóvel/);
  assert.match(serialized, /EPSG:31982/);
  assert.match(serialized, /Gauss e distância plana/);
  assert.match(serialized, /742000/);
  assert.match(serialized, /validade registral/);
});
