import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SPATIAL_REFERENCE_CODE,
  calculateUtmMetadata,
  geographicToProjected,
  getSpatialReference,
  parseStoredSpatialReference,
  projectedToGeographic,
  serializeSpatialReference,
  suggestSpatialReference,
  suggestUtmZone,
  transformProjectedPositions,
  validateGeographicPositions,
  validateProjectedPosition,
  wgs84MapPositionToProjected,
} from './topographySpatial';

test('transforma coordenada conhecida para SIRGAS 2000 / UTM 22S e retorna ao ponto de origem', () => {
  const geographic = { lat: -27.59487, lng: -48.54822 };
  const projected = geographicToProjected(geographic, 'EPSG:31982');
  assert.ok(Math.abs(projected.x - 742003.210) < 0.01);
  assert.ok(Math.abs(projected.y - 6945275.215) < 0.01);
  const roundTrip = projectedToGeographic(projected, 'EPSG:31982');
  assert.ok(Math.abs(roundTrip.lat - geographic.lat) < 1e-8);
  assert.ok(Math.abs(roundTrip.lng - geographic.lng) < 1e-8);
  const mapProjected = wgs84MapPositionToProjected(geographic, 'EPSG:31982');
  assert.ok(Math.abs(mapProjected.x - projected.x) < 0.1);
  assert.ok(Math.abs(mapProjected.y - projected.y) < 0.1);
});

test('suporta UTM nos hemisférios norte e sul sem deslocar a posição', () => {
  const boaVista = { lat: 2.8235, lng: -60.6758 };
  const northReference = getSpatialReference('EPSG:31974');
  assert.ok(northReference);
  assert.equal(northReference.zone, 20);
  assert.equal(northReference.hemisphere, 'N');
  assert.equal(suggestSpatialReference(boaVista.lng, boaVista.lat)?.code, 'EPSG:31974');
  const northProjected = geographicToProjected(boaVista, northReference.code);
  assert.ok(northProjected.y > 0 && northProjected.y < 1_000_000);
  const northRoundTrip = projectedToGeographic(northProjected, northReference.code);
  assert.ok(Math.abs(northRoundTrip.lat - boaVista.lat) < 1e-8);
  assert.ok(Math.abs(northRoundTrip.lng - boaVista.lng) < 1e-8);

  const florianopolis = { lat: -27.59487, lng: -48.54822 };
  assert.equal(suggestSpatialReference(florianopolis.lng, florianopolis.lat)?.code, 'EPSG:31982');
});

test('transforma lote entre UTM sul e norte preservando a posição geográfica', () => {
  const source = getSpatialReference('EPSG:31982');
  const target = getSpatialReference('EPSG:31974');
  assert.ok(source && target);
  const original = { lat: -27.59487, lng: -48.54822 };
  const projected = geographicToProjected(original, source.code);
  const transformed = transformProjectedPositions([projected], source, target);
  assert.equal(transformed.mode, 'projetada');
  const recovered = projectedToGeographic(transformed.projected[0], target.code);
  assert.ok(Math.abs(recovered.lat - original.lat) < 1e-7);
  assert.ok(Math.abs(recovered.lng - original.lng) < 1e-7);
});

test('sinaliza X/Y invertido, Norte impossível e hemisfério incompatível', () => {
  const south = getSpatialReference('EPSG:31982');
  assert.ok(south);
  assert.ok(validateProjectedPosition({ x: 6_945_000, y: 742_000 }, south).some((issue) => issue.code === 'possible-xy-swap'));
  assert.ok(validateProjectedPosition({ x: 742_000, y: 11_000_000 }, south).some((issue) => issue.code === 'invalid-northing' && issue.severity === 'error'));
  assert.ok(validateGeographicPositions([{ lat: 2.8235, lng: -48.54822 }], south).some((issue) => issue.code === 'selected-hemisphere-mismatch'));
});

test('separa fusos SIRGAS 2000 e WGS 84 e sugere o fuso brasileiro', () => {
  assert.equal(getSpatialReference('EPSG:31982')?.datum, 'SIRGAS 2000');
  assert.equal(getSpatialReference('EPSG:32722')?.datum, 'WGS 84');
  assert.equal(suggestUtmZone(-48.54822), 22);
  assert.equal(suggestUtmZone(-80), null);
});

test('persiste apenas códigos conhecidos e recupera configuração inválida com segurança', () => {
  assert.equal(parseStoredSpatialReference(serializeSpatialReference('EPSG:31982')), 'EPSG:31982');
  assert.equal(parseStoredSpatialReference('{"code":"EPSG:999999"}'), DEFAULT_SPATIAL_REFERENCE_CODE);
  assert.equal(parseStoredSpatialReference('conteúdo inválido'), DEFAULT_SPATIAL_REFERENCE_CODE);
});

test('calcula metadados UTM finitos para o ponto de origem', () => {
  const reference = getSpatialReference('EPSG:31982');
  assert.ok(reference);
  const metadata = calculateUtmMetadata({ lat: -27.59487, lng: -48.54822 }, reference);
  assert.ok(metadata);
  assert.ok(Number.isFinite(metadata.convergenceDegrees));
  assert.ok(metadata.scaleFactor > 0.999 && metadata.scaleFactor < 1.001);
});
