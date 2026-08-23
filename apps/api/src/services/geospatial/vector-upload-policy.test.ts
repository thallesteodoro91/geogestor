import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MBTILES_SURVEY_ERROR,
  RASTER_SURVEY_ERROR,
  VECTOR_SURVEY_EXTENSIONS,
  assertVectorSurveyUpload,
  classifyVectorSurveyUpload
} from './vector-upload-policy.service';

test('o fluxo de levantamento aceita somente os formatos vetoriais declarados', () => {
  assert.deepEqual(VECTOR_SURVEY_EXTENSIONS, ['.kml', '.kmz', '.geojson', '.json', '.shp', '.zip', '.gpkg']);
  for (const extension of VECTOR_SURVEY_EXTENSIONS) assert.equal(classifyVectorSurveyUpload(`levantamento${extension}`), 'vector');
});

test('recusa raster por extensão e por assinatura mesmo quando disfarçado', () => {
  for (const extension of ['.tif', '.tiff', '.geotiff', '.png', '.jpg', '.jpeg', '.ecw', '.jp2']) {
    assert.throws(() => assertVectorSurveyUpload(`ortofoto${extension}`), new RegExp(RASTER_SURVEY_ERROR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(classifyVectorSurveyUpload('imagem-disfarcada.kml', png), 'raster');
});

test('direciona MBTiles para a configuração de mapa-base', () => {
  assert.throws(() => assertVectorSurveyUpload('base.mbtiles'), new RegExp(MBTILES_SURVEY_ERROR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
