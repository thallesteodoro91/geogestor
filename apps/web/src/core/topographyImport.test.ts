import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeVertexImport } from './topographyImport';

test('detecta cabeçalho, delimitador e colunas geográficas antes da importação', () => {
  const preview = analyzeVertexImport(
    'Código;Longitude;Latitude\nV1;-48,548220;-27,594870\nV2;-48,547000;-27,594000',
    'geografica',
    { delimiter: 'auto', decimalSeparator: 'auto', hasHeader: true },
  );
  assert.equal(preview.delimiter, ';');
  assert.equal(preview.firstCoordinateColumn, 2);
  assert.equal(preview.secondCoordinateColumn, 1);
  assert.deepEqual(preview.validVertices[0], { lat: -27.59487, lng: -48.54822 });
  assert.equal(preview.errors.length, 0);
});

test('mantém linhas inválidas visíveis e importa somente as coordenadas válidas', () => {
  const preview = analyzeVertexImport(
    'X\tY\n742003.21\t6945275.21\ntexto\t6945000',
    'projetada',
    { delimiter: 'auto', decimalSeparator: '.', hasHeader: true },
  );
  assert.equal(preview.validVertices.length, 1);
  assert.equal(preview.rows.length, 2);
  assert.match(preview.rows[1].error ?? '', /numéricas/);
});

test('marca duplicidades sem remover a primeira ocorrência válida', () => {
  const preview = analyzeVertexImport(
    'Latitude;Longitude\n-27,5;-48,5\n-27,5;-48,5',
    'geografica',
    { delimiter: ';', decimalSeparator: ',', hasHeader: true },
  );
  assert.equal(preview.validVertices.length, 1);
  assert.match(preview.rows[1].error ?? '', /duplicado/);
});
