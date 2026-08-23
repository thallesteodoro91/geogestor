import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { VECTOR_SURVEY_ACCEPT, classifyVectorSurveyFileName } from './geospatialFilePolicy';

test('seletor de levantamento expõe somente vetores e componentes de Shapefile', () => {
  assert.equal(VECTOR_SURVEY_ACCEPT, '.kml,.kmz,.geojson,.json,.zip,.shp,.shx,.dbf,.prj,.cpg,.gpkg');
  for (const forbidden of ['.mbtiles', '.tif', '.tiff', '.png', '.jpg', '.jpeg', '.ecw', '.jp2']) {
    assert.equal(VECTOR_SURVEY_ACCEPT.includes(forbidden), false);
  }
});

test('classifica raster, MBTiles, vetor e componente sem ambiguidade', () => {
  assert.equal(classifyVectorSurveyFileName('ortofoto.tif'), 'raster');
  assert.equal(classifyVectorSurveyFileName('base.mbtiles'), 'mbtiles');
  assert.equal(classifyVectorSurveyFileName('campo.kml'), 'vector');
  assert.equal(classifyVectorSurveyFileName('lotes.shx'), 'shapefile-component');
});

test('interface mantém seletores, ações e estados vazios separados', () => {
  const source = readFileSync(new URL('../pages/Clientes/ClienteDetalhes/ClienteMapaCard.tsx', import.meta.url), 'utf8');
  assert.match(source, /accept=\{VECTOR_SURVEY_ACCEPT\}/);
  assert.match(source, /accept="\.mbtiles"/);
  assert.match(source, /uploadPurpose', 'vector-survey'/);
  assert.match(source, /Adicionar levantamento vetorial/);
  assert.match(source, /Configurar mapa-base offline/);
  assert.match(source, /Nenhum levantamento vetorial cadastrado/);
  assert.match(source, /Nenhum mapa-base MBTiles importado/);
  assert.match(source, /Levantamentos, documentos e projetos serão preservados/);
});
