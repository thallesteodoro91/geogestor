import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calcularAreaGeodesicaElipsoidal,
  calcularAreaPoligono,
  calcularAzimutePlano,
  calcularDistanciaElipsoidal,
  calcularPoligonoGeodesicoKarney,
  parseCoordinateText,
} from './topography';

test('interpreta graus decimais, GMS, hemisférios brasileiros e contradições', () => {
  assert.equal(parseCoordinateText('27°35\'40,2"S', 'latitude').value, -(27 + 35 / 60 + 40.2 / 3600));
  assert.equal(parseCoordinateText('48°32\'51,7"O', 'longitude').hemisphere, 'W');
  assert.equal(parseCoordinateText('-27,5945', 'latitude').value, -27.5945);
  assert.match(parseCoordinateText('-27 N', 'latitude').error ?? '', /contradiz/);
  assert.match(parseCoordinateText('48 S', 'longitude').error ?? '', /Longitude/);
});

test('calcula distância elipsoidal e azimute inicial para São Paulo–Rio', () => {
  const result = calcularDistanciaElipsoidal(-23.5505, -46.6333, -22.9068, -43.1729, 'SIRGAS 2000');
  assert.ok(result);
  assert.ok(Math.abs(result.distance - 361260.861) < 0.5);
  assert.ok(Math.abs(result.initialBearing - 79.3054) < 0.001);
});

test('calcula área elipsoidal de polígono pequeno sem arredondamento intermediário', () => {
  const area = calcularAreaGeodesicaElipsoidal([
    { lat: -27.595, lng: -48.548 },
    { lat: -27.595, lng: -48.547 },
    { lat: -27.594, lng: -48.547 },
    { lat: -27.594, lng: -48.548 },
  ]);
  assert.ok(Math.abs(area - 10940.297) < 0.5);
});

test('mantém cálculo plano de Gauss e azimute de quadrícula', () => {
  assert.equal(calcularAreaPoligono([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]), 100);
  assert.equal(calcularAzimutePlano(0, 0, 10, 0), 90);
  assert.equal(calcularAzimutePlano(0, 0, 0, 10), 0);
});

test('Karney permanece estável próximo ao antimeridiano e independe da orientação', () => {
  const clockwise = [
    { lat: 10, lng: 179.8 },
    { lat: 10, lng: -179.8 },
    { lat: 10.2, lng: -179.8 },
    { lat: 10.2, lng: 179.8 },
  ];
  const direct = calcularPoligonoGeodesicoKarney(clockwise);
  const reversed = calcularPoligonoGeodesicoKarney([...clockwise].reverse());
  assert.ok(direct && reversed);
  assert.equal(direct.method, 'Karney/GeographicLib');
  assert.ok(direct.area > 0 && direct.perimeter > 0);
  assert.ok(Math.abs(direct.area - reversed.area) < 0.01);
  assert.ok(Math.abs(direct.perimeter - reversed.perimeter) < 0.01);
});

test('distância quase antipodal usa GeographicLib sem falha de convergência', () => {
  const result = calcularDistanciaElipsoidal(0, 0, 0.0001, 179.9999);
  assert.ok(result);
  assert.equal(result.method, 'Karney/GeographicLib');
  assert.ok(result.distance > 19_900_000 && result.distance < 20_100_000);
});
