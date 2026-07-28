import assert from 'node:assert/strict';
import test from 'node:test';
import { isBaseMapUnavailable, MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from './mapTileConfig';

test('mapa-base fica indisponível sem rede, preservando a distinção dos dados próprios', () => {
  assert.equal(isBaseMapUnavailable(false, false), true);
  assert.equal(isBaseMapUnavailable(true, false), false);
});

test('falha do provedor marca somente a camada de fundo como indisponível', () => {
  assert.equal(isBaseMapUnavailable(true, true), true);
  assert.match(MAP_TILE_URL, /openstreetmap/);
  assert.match(MAP_TILE_ATTRIBUTION, /OpenStreetMap/);
});
