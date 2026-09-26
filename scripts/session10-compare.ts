import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calcularAreaPoligono,
  calcularAzimutePlano,
  calcularDistanciaElipsoidal,
  calcularPerimetro,
  calcularPoligonoGeodesicoKarney,
} from '../apps/web/src/core/topography';
import {
  calculateUtmMetadata,
  geographicToProjected,
  getSpatialReference,
  projectedToGeographic,
} from '../apps/web/src/core/topographySpatial';
import { exportPolygon } from '../apps/web/src/core/topographyExchange';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.join(root, 'docs', 'auditorias', '2026-09-13-topografia', 'evidencias');
const oracle = JSON.parse(fs.readFileSync(path.join(evidence, 'oraculos-independentes.json'), 'utf8'));
const deviations: Record<string, number> = {};

function close(name: string, actual: number, expected: number, tolerance: number) {
  const deviation = Math.abs(actual - expected);
  deviations[name] = deviation;
  assert.ok(deviation <= tolerance, `${name}: ${actual} difere de ${expected} por ${deviation} (tolerância ${tolerance})`);
}

const reference = getSpatialReference('EPSG:31982');
assert.ok(reference);
const florianopolis = { lat: -27.59487, lng: -48.54822 };
const projected = geographicToProjected(florianopolis, reference.code);
const oracleProjected = oracle.crs.florianopolisSirgas2000To31982;
close('EPSG:31982 X', projected.x, oracleProjected.x, 0.01);
close('EPSG:31982 Y', projected.y, oracleProjected.y, 0.01);
const roundTrip = projectedToGeographic(projected, reference.code);
close('round-trip latitude', roundTrip.lat, florianopolis.lat, 1e-8);
close('round-trip longitude', roundTrip.lng, florianopolis.lng, 1e-8);

const metadata = calculateUtmMetadata(florianopolis, reference);
assert.ok(metadata);
close('convergência meridiana', metadata.convergenceDegrees, oracle.crs.utmMetadataFlorianopolis.meridianConvergenceDegrees, 0.00001);
close('fator de escala', metadata.scaleFactor, oracle.crs.utmMetadataFlorianopolis.meridionalScale, 1e-7);

const geodesicCases = [
  ['São Paulo–Rio', [-23.5505, -46.6333, -22.9068, -43.1729], oracle.geodesicsGrs80.saoPauloToRio, 1e-7],
  ['quase coincidente', [-27.59487, -48.54822, -27.594869999, -48.548219999], oracle.geodesicsGrs80.almostCoincident, 1e-3],
  ['quase antípoda', [0, 0, 0.0001, 179.9999], oracle.geodesicsGrs80.almostAntipodal, 1e-7],
  ['antimeridiano', [10, 179.9, 10, -179.9], oracle.geodesicsGrs80.antimeridian, 1e-7],
  ['curto norte', [-27.59487, -48.54822, -27.59478, -48.54822], oracle.geodesicsGrs80.shortNorth, 1e-7],
] as const;
for (const [name, values, expected, bearingTolerance] of geodesicCases) {
  const actual = calcularDistanciaElipsoidal(...values, 'SIRGAS 2000');
  assert.ok(actual);
  close(`${name} distância`, actual.distance, expected.distanceMeters, 0.005);
  close(`${name} azimute`, actual.initialBearing, expected.initialBearingDegrees, bearingTolerance);
}

const reverse = calcularDistanciaElipsoidal(-22.9068, -43.1729, -23.5505, -46.6333, 'SIRGAS 2000');
assert.ok(reverse);
close('simetria distância São Paulo–Rio', reverse.distance, oracle.geodesicsGrs80.saoPauloToRio.distanceMeters, 0.005);
const coincident = calcularDistanciaElipsoidal(-27.59487, -48.54822, -27.59487, -48.54822, 'SIRGAS 2000');
assert.equal(coincident?.distance, 0);
assert.equal(Number.isNaN(coincident?.initialBearing), true);

const planarCases = {
  square10: [[0, 0], [10, 0], [10, 10], [0, 10]],
  rectangle20x5: [[0, 0], [20, 0], [20, 5], [0, 5]],
  triangle: [[0, 0], [10, 0], [0, 10]],
  irregular: [[0, 0], [8, 0], [10, 4], [4, 9], [-1, 5]],
} as const;
for (const [name, values] of Object.entries(planarCases)) {
  const points = values.map(([x, y]) => ({ x, y }));
  close(`${name} área`, calcularAreaPoligono(points), oracle.planar[name].areaSquareMeters, 1e-9);
  close(`${name} perímetro`, calcularPerimetro(points), oracle.planar[name].perimeterMeters, 1e-9);
  close(`${name} área invertida`, calcularAreaPoligono([...points].reverse()), oracle.planar[name].areaSquareMeters, 1e-9);
}
assert.deepEqual([
  calcularAzimutePlano(0, 0, 0, 10),
  calcularAzimutePlano(0, 0, 10, 0),
  calcularAzimutePlano(0, 0, 0, -10),
  calcularAzimutePlano(0, 0, -10, 0),
], [0, 90, 180, 270]);

const geographicCases = {
  small: [[-27.595, -48.548], [-27.595, -48.547], [-27.594, -48.547], [-27.594, -48.548]],
  antimeridian: [[10, 179.8], [10, -179.8], [10.2, -179.8], [10.2, 179.8]],
} as const;
for (const [name, values] of Object.entries(geographicCases)) {
  const points = values.map(([lat, lng]) => ({ lat, lng }));
  const actual = calcularPoligonoGeodesicoKarney(points, 'SIRGAS 2000');
  assert.ok(actual);
  close(`${name} área geodésica`, actual.area, oracle.geographicPolygonsGrs80[name].areaSquareMeters, 0.05);
  close(`${name} perímetro geodésico`, actual.perimeter, oracle.geographicPolygonsGrs80[name].perimeterMeters, 0.005);
  const reversed = calcularPoligonoGeodesicoKarney([...points].reverse(), 'SIRGAS 2000');
  assert.ok(reversed);
  close(`${name} área invertida`, reversed.area, actual.area, 0.05);
  close(`${name} perímetro invertido`, reversed.perimeter, actual.perimeter, 0.005);
}

const exportVertices = [
  { x: 742000, y: 6945000, code: 'M-01', description: 'Marco inicial', altitude: -2.5, precision: '0,02 m', notes: 'QA sintético' },
  { x: 742010, y: 6945000, code: 'M-02', altitude: 0 },
  { x: 742010, y: 6945010, code: 'M-03', altitude: 12.345 },
];
const outputs = {
  csv: exportPolygon(exportVertices, 'projetada', 'csv', reference),
  dxf: exportPolygon(exportVertices, 'projetada', 'dxf', reference),
  geojson: exportPolygon(geographicCases.small.map(([lat, lng]) => ({ lat, lng })), 'geografica', 'geojson', getSpatialReference('EPSG:4326')!, reference),
  kml: exportPolygon(geographicCases.small.map(([lat, lng], index) => ({ lat, lng, altitude: index })), 'geografica', 'kml', getSpatialReference('EPSG:4326')!, reference),
};
for (const [name, exported] of Object.entries(outputs)) fs.writeFileSync(path.join(evidence, `amostra.${exported.extension}`), exported.content, 'utf8');

const result = {
  comparedValues: Object.keys(deviations).length,
  maximumDeviation: Object.entries(deviations).sort((a, b) => b[1] - a[1])[0],
  deviations,
  exportChecks: {
    csvLines: outputs.csv.content.split('\r\n').length,
    dxfVertices: (outputs.dxf.content.match(/\r\nVERTEX\r\n/g) ?? []).length,
    geojsonRingPositions: JSON.parse(outputs.geojson.content).geometry.coordinates[0].length,
    kmlClosedOnce: outputs.kml.content.match(/<coordinates>([^<]+)<\/coordinates>/)?.[1].trim().split(/\s+/).length,
  },
};
fs.writeFileSync(path.join(evidence, 'comparacao-geogestor-oraculos.json'), JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result, null, 2));
