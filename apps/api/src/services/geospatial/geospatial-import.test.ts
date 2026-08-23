import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { strToU8, zipSync } from 'fflate';
import proj4 from 'proj4';
import { parseGeospatialFile } from './geospatial-import.service';
import { extractSafeArchive } from './safe-archive.service';
import {
  collectionBbox,
  detectLikelySwappedBrazilianAxes,
  normalizeCollection,
  representativePoint,
  validateNormalizedCollection
} from './geometry-validation.service';
import { ensureGeospatialLayers } from '../runtime-migrations/v12-geospatial-layers';
import { ensureGeospatialPolish } from '../runtime-migrations/v13-geospatial-polish';
import { repairSafeTopology, validateTopology } from './topology-validation.service';
import { buildDisplayCollections, countVertices, cropCollectionToBbox } from './visualization-cache.service';
import { inspectMbtiles, MbtilesService } from './mbtiles.service';
import { assertSupportedCrs, suggestBrazilUtmZone, transformPosition } from './crs-detection.service';
import type { GeoFeatureCollection } from './geospatial-types';
import { GEOSPATIAL_AUDIT_EVENTS } from './geospatial-audit.service';

const fixtures = path.resolve(__dirname, 'fixtures');

test('histórico usa eventos distintos para levantamentos, rasters ignorados e mapas-base', () => {
  assert.deepEqual(Object.values(GEOSPATIAL_AUDIT_EVENTS), [
    'levantamento_vetorial_importado',
    'mapa_base_mbtiles_importado',
    'mapa_base_ativado',
    'mapa_base_desativado',
    'mapa_base_removido',
    'conteudo_raster_ignorado'
  ]);
});

test('relatório vetorial e remoção de mapa-base não cruzam os respectivos armazenamentos', async () => {
  const importSource = await fs.readFile(path.join(__dirname, 'geospatial-import.service.ts'), 'utf8');
  const reportSection = importSource.slice(importSource.indexOf('static async getReport'), importSource.indexOf('static async getLocationPreview'));
  assert.match(reportSection, /schema\.camadasGeoespaciais/);
  assert.doesNotMatch(reportSection, /mapasBaseOffline|MbtilesService/);

  const basemapSource = await fs.readFile(path.join(__dirname, 'mbtiles.service.ts'), 'utf8');
  const removalSection = basemapSource.slice(basemapSource.indexOf('static async remove'));
  assert.match(removalSection, /schema\.mapasBaseOffline/);
  assert.doesNotMatch(removalSection, /schema\.(camadasGeoespaciais|documentos|projetos)/);
});

async function withScratch(name: string, run: (directory: string) => Promise<void>) {
  const directory = path.resolve(process.cwd(), 'scratch', `geospatial-${name}-${process.pid}-${Date.now()}`);
  await fs.mkdir(directory, { recursive: true });
  try {
    await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
      // O processo pai remove o resíduo após o encerramento do driver SQLite no Windows.
    });
  }
}

function createPolygonShp(points: Array<[number, number]>) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const contentBytes = 4 + 32 + 4 + 4 + 4 + points.length * 16;
  const buffer = Buffer.alloc(100 + 8 + contentBytes);
  buffer.writeInt32BE(9994, 0);
  buffer.writeInt32BE(buffer.length / 2, 24);
  buffer.writeInt32LE(1000, 28);
  buffer.writeInt32LE(5, 32);
  const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  bbox.forEach((value, index) => buffer.writeDoubleLE(value, 36 + index * 8));
  buffer.writeInt32BE(1, 100);
  buffer.writeInt32BE(contentBytes / 2, 104);
  buffer.writeInt32LE(5, 108);
  bbox.forEach((value, index) => buffer.writeDoubleLE(value, 112 + index * 8));
  buffer.writeInt32LE(1, 144);
  buffer.writeInt32LE(points.length, 148);
  buffer.writeInt32LE(0, 152);
  points.forEach(([x, y], index) => {
    buffer.writeDoubleLE(x, 156 + index * 16);
    buffer.writeDoubleLE(y, 164 + index * 16);
  });
  return buffer;
}

function createUtf8Dbf(value: string) {
  const fieldLength = 40;
  const headerLength = 65;
  const recordLength = fieldLength + 1;
  const buffer = Buffer.alloc(headerLength + recordLength + 1, 0);
  buffer.writeUInt8(0x03, 0);
  buffer.writeUInt32LE(1, 4);
  buffer.writeUInt16LE(headerLength, 8);
  buffer.writeUInt16LE(recordLength, 10);
  buffer.write('NOME', 32, 'ascii');
  buffer.writeUInt8('C'.charCodeAt(0), 43);
  buffer.writeUInt8(fieldLength, 48);
  buffer.writeUInt8(0x0d, 64);
  buffer.writeUInt8(0x20, 65);
  Buffer.from(value, 'utf8').copy(buffer, 66, 0, fieldLength);
  buffer.fill(0x20, 66 + Buffer.byteLength(value, 'utf8'), 66 + fieldLength);
  buffer.writeUInt8(0x1a, buffer.length - 1);
  return buffer;
}

function createGpkgPolygon(points: Array<[number, number]>, srsId = 4326) {
  const wkb = Buffer.alloc(1 + 4 + 4 + 4 + points.length * 16);
  let offset = 0;
  wkb.writeUInt8(1, offset); offset += 1;
  wkb.writeUInt32LE(3, offset); offset += 4;
  wkb.writeUInt32LE(1, offset); offset += 4;
  wkb.writeUInt32LE(points.length, offset); offset += 4;
  points.forEach(([x, y]) => {
    wkb.writeDoubleLE(x, offset); offset += 8;
    wkb.writeDoubleLE(y, offset); offset += 8;
  });
  const header = Buffer.alloc(8);
  header.write('GP', 0, 'ascii');
  header.writeUInt8(0, 2);
  header.writeUInt8(1, 3);
  header.writeInt32LE(srsId, 4);
  return Buffer.concat([header, wkb]);
}

function createGpkgPointZm(position: [number, number, number, number], srsId = 4326) {
  const wkb = Buffer.alloc(1 + 4 + 32);
  wkb.writeUInt8(1, 0);
  wkb.writeUInt32LE(3001, 1);
  position.forEach((value, index) => wkb.writeDoubleLE(value, 5 + index * 8));
  const header = Buffer.alloc(8);
  header.write('GP', 0, 'ascii');
  header.writeUInt8(0, 2);
  header.writeUInt8(1, 3);
  header.writeInt32LE(srsId, 4);
  return Buffer.concat([header, wkb]);
}

test('interpreta KML de Florianópolis preservando nomes, altitude e anel interno', async () => {
  const [layer] = await parseGeospatialFile(path.join(fixtures, 'florianopolis.kml'));
  assert.equal(layer.sourceEpsg, 4326);
  assert.equal(layer.collection?.features.length, 3);
  assert.equal(layer.collection?.features[0].properties?.name, 'Ponto de apoio');
  assert.equal(layer.collection?.features[0].properties?.codigo, 'BASE-01');
  assert.equal((layer.collection?.features[0].geometry?.coordinates as number[])[2], 5);
  const polygon = layer.collection?.features[2].geometry?.coordinates as number[][][];
  assert.equal(polygon.length, 2);
});

test('interpreta KMZ convencional e rejeita caminho inseguro', async () => {
  await withScratch('kmz', async (directory) => {
    const kml = await fs.readFile(path.join(fixtures, 'florianopolis.kml'));
    const kmzPath = path.join(directory, 'levantamento.kmz');
    await fs.writeFile(kmzPath, zipSync({ 'doc.kml': kml, 'pastas/apoios.kml': kml }));
    const layers = await parseGeospatialFile(kmzPath);
    assert.equal(layers.length, 2);
    assert.equal(layers[0].format, 'kmz');
    assert.equal(layers[0].collection?.features.length, 3);
    assert.throws(() => extractSafeArchive(zipSync({ '../fora.txt': strToU8('x') })), /caminho inseguro/);
  });
});

test('normaliza GeoJSON RFC 7946 e detecta eixos brasileiros invertidos', async () => {
  const [layer] = await parseGeospatialFile(path.join(fixtures, 'florianopolis.geojson'));
  assert.equal(layer.sourceCrs, 'EPSG:4326');
  const normalized = normalizeCollection(layer.collection!, layer.sourceCrs!);
  assert.deepEqual(validateNormalizedCollection(normalized), []);
  const bbox = collectionBbox(normalized);
  assert.ok(bbox[0] < -48.54 && bbox[2] > -48.55);
  const swapped: GeoFeatureCollection = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-27.59487, -48.54822] } }]
  };
  assert.equal(detectLikelySwappedBrazilianAxes(swapped), true);
});

test('calcula ponto representativo dentro de polígono côncavo com furo', () => {
  const collection: GeoFeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[0, 0], [8, 0], [8, 8], [5, 8], [5, 3], [3, 3], [3, 8], [0, 8], [0, 0]],
          [[6, 1], [7, 1], [7, 2], [6, 2], [6, 1]]
        ]
      }
    }]
  };
  const point = representativePoint(collection);
  assert.ok(point.longitude >= 0 && point.longitude <= 8 && point.latitude >= 0 && point.latitude <= 8);
  assert.ok(!(point.longitude > 3 && point.longitude < 5 && point.latitude > 3));
  assert.ok(!(point.longitude > 6 && point.longitude < 7 && point.latitude > 1 && point.latitude < 2));
});

test('lê Shapefile ZIP SIRGAS 2000 / UTM 22S e exige SRC quando o .prj está ausente', async () => {
  await withScratch('shp', async (directory) => {
    const center = proj4('EPSG:4326', 'EPSG:31982', [-48.54822, -27.59487]);
    const points: Array<[number, number]> = [
      [center[0] - 20, center[1] - 20], [center[0] + 20, center[1] - 20],
      [center[0] + 20, center[1] + 20], [center[0] - 20, center[1] + 20], [center[0] - 20, center[1] - 20]
    ];
    const shp = createPolygonShp(points);
    const prj = strToU8('PROJCS["SIRGAS 2000 / UTM zone 22S",GEOGCS["SIRGAS 2000",DATUM["SIRGAS_2000",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",-51],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1],AUTHORITY["EPSG","31982"]]');
    const completePath = path.join(directory, 'completo.zip');
    await fs.writeFile(completePath, zipSync({
      'imovel.shp': shp, 'imovel.shx': new Uint8Array([1]), 'imovel.dbf': createUtf8Dbf('Área São José'), 'imovel.prj': prj, 'imovel.cpg': strToU8('UTF-8'),
      'apoio.shp': shp, 'apoio.shx': new Uint8Array([1]), 'apoio.prj': prj
    }));
    const completeLayers = await parseGeospatialFile(completePath);
    assert.equal(completeLayers.length, 2);
    const complete = completeLayers.find((layer) => layer.name.includes('imovel'))!;
    assert.equal(complete.sourceEpsg, 31982);
    assert.equal(complete.collection?.features[0].properties?.NOME, 'Área São José');
    const normalized = normalizeCollection(complete.collection!, complete.sourceCrs!);
    const bbox = collectionBbox(normalized);
    assert.ok(bbox[0] > -48.56 && bbox[2] < -48.53);
    assert.ok(bbox[1] > -27.61 && bbox[3] < -27.58);

    const missingPath = path.join(directory, 'sem-prj.zip');
    await fs.writeFile(missingPath, zipSync({ 'imovel.shp': shp, 'imovel.shx': new Uint8Array([1]) }));
    const [missing] = await parseGeospatialFile(missingPath);
    assert.equal(missing.status, 'needs_crs');
  });
});

test('lê vetores de GeoPackage misto e informa o raster ignorado', async () => {
  await withScratch('gpkg', async (directory) => {
    const gpkgPath = path.join(directory, 'camadas.gpkg');
    const client = createClient({ url: `file:${gpkgPath}` });
    await client.batch([
      'CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT, srs_id INTEGER PRIMARY KEY, organization TEXT, organization_coordsys_id INTEGER, definition TEXT, description TEXT)',
      "INSERT INTO gpkg_spatial_ref_sys VALUES ('WGS 84',4326,'EPSG',4326,'EPSG:4326','')",
      'CREATE TABLE gpkg_contents (table_name TEXT PRIMARY KEY, data_type TEXT, identifier TEXT)',
      'CREATE TABLE gpkg_geometry_columns (table_name TEXT, column_name TEXT, geometry_type_name TEXT, srs_id INTEGER, z INTEGER, m INTEGER)',
      'CREATE TABLE imoveis (id INTEGER PRIMARY KEY, nome TEXT, geom BLOB)',
      'CREATE TABLE apoios (id INTEGER PRIMARY KEY, nome TEXT, geom BLOB)',
      'CREATE TABLE ortofoto_tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)',
      "INSERT INTO gpkg_contents VALUES ('imoveis','features','Imóveis')",
      "INSERT INTO gpkg_contents VALUES ('apoios','features','Apoios')",
      "INSERT INTO gpkg_contents VALUES ('ortofoto_tiles','tiles','Ortofoto 2026')",
      "INSERT INTO gpkg_geometry_columns VALUES ('imoveis','geom','POLYGON',4326,0,0)",
      "INSERT INTO gpkg_geometry_columns VALUES ('apoios','geom','POLYGON',4326,0,0)"
    ], 'write');
    const polygon = createGpkgPolygon([[-48.549,-27.595],[-48.547,-27.595],[-48.547,-27.593],[-48.549,-27.593],[-48.549,-27.595]]);
    await client.execute({ sql: 'INSERT INTO imoveis (nome, geom) VALUES (?, ?)', args: ['Imóvel A', polygon] });
    await client.execute({ sql: 'INSERT INTO apoios (nome, geom) VALUES (?, ?)', args: ['Apoio ZM', createGpkgPointZm([-48.548, -27.594, 12.5, 100])] });
    await client.close();
    const layers = await parseGeospatialFile(gpkgPath);
    assert.deepEqual(layers.map((layer) => layer.sourceLayer).sort(), ['apoios', 'imoveis']);
    assert.ok(layers.every((layer) => layer.sourceEpsg === 4326 && layer.collection?.features.length === 1));
    assert.ok(layers.every((layer) => layer.ignoredRasterLayers?.includes('Ortofoto 2026')));
    assert.ok(layers.every((layer) => layer.warnings.some((warning) => warning.includes('Somente as camadas vetoriais foram importadas'))));
    const pointCoordinates = layers.find((layer) => layer.sourceLayer === 'apoios')?.collection?.features[0].geometry?.coordinates as number[];
    assert.deepEqual(pointCoordinates, [-48.548, -27.594, 12.5]);
  });
});

test('rejeita GeoPackage que contém somente raster', async () => {
  await withScratch('gpkg-raster-only', async (directory) => {
    const gpkgPath = path.join(directory, 'ortofoto.gpkg');
    const client = createClient({ url: `file:${gpkgPath}` });
    await client.batch([
      'CREATE TABLE gpkg_contents (table_name TEXT PRIMARY KEY, data_type TEXT, identifier TEXT)',
      'CREATE TABLE ortofoto_tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)',
      "INSERT INTO gpkg_contents VALUES ('ortofoto_tiles','tiles','Ortofoto raster')"
    ], 'write');
    await client.close();
    await assert.rejects(
      () => parseGeospatialFile(gpkgPath),
      /O GeoPackage não contém camadas vetoriais compatíveis\. Camadas raster não são importadas como levantamento\./
    );
  });
});

test('migração geoespacial é idempotente e cria índices', async () => {
  await withScratch('migration', async (directory) => {
    const client = createClient({ url: `file:${path.join(directory, 'migration.db')}` });
    await client.batch([
      'CREATE TABLE clientes (id TEXT PRIMARY KEY)',
      'CREATE TABLE projetos (id TEXT PRIMARY KEY)',
      'CREATE TABLE documentos (id TEXT PRIMARY KEY)'
    ], 'write');
    await ensureGeospatialLayers(client);
    await ensureGeospatialLayers(client);
    await ensureGeospatialPolish(client);
    await ensureGeospatialPolish(client);
    const table = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='camadas_geoespaciais'");
    const polishTables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('eventos_geoespaciais','mapas_base_offline') ORDER BY name");
    const indexes = await client.execute("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_camadas_geoespaciais_%'");
    assert.equal(table.rows.length, 1);
    assert.deepEqual(polishTables.rows.map((row) => row.name), ['eventos_geoespaciais', 'mapas_base_offline']);
    assert.equal(indexes.rows.length, 3);
    await client.close();
  });
});

test('classifica e repara anel aberto com vértice duplicado sem alterar a entrada', () => {
  const original: GeoFeatureCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0, 0], [0, 0], [4, 0], [4, 4], [0, 4]]] } }] };
  const before = JSON.stringify(original);
  const issues = validateTopology(original);
  assert.ok(issues.some((issue) => issue.code === 'ring_not_closed' && issue.repairAvailable));
  assert.ok(issues.some((issue) => issue.code === 'consecutive_duplicate' && issue.repairAvailable));
  const repaired = repairSafeTopology(original);
  assert.equal(JSON.stringify(original), before);
  const ring = repaired.collection.features[0].geometry?.coordinates as number[][][];
  assert.deepEqual(ring[0][0], ring[0].at(-1));
});

test('detecta autointerseção e furo fora do anel externo', () => {
  const collection: GeoFeatureCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [
    [[0, 0], [4, 4], [0, 4], [4, 0], [0, 0]],
    [[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]
  ] } }] };
  const codes = validateTopology(collection).map((issue) => issue.code);
  assert.ok(codes.includes('self_intersection'));
  assert.ok(codes.includes('hole_outside_shell'));
});

test('cria níveis simplificados apenas para visualização', () => {
  const positions = Array.from({ length: 20_001 }, (_, index) => [-48.6 + index / 1_000_000, -27.6 + Math.sin(index / 20) / 10_000]);
  const collection: GeoFeatureCollection = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: positions } }] };
  const original = JSON.stringify(collection);
  const result = buildDisplayCollections(collection, countVertices(collection));
  assert.equal(result.simplified, true);
  assert.ok(countVertices(result.levels.low) < positions.length);
  assert.equal(JSON.stringify(collection), original);
});

test('limita feições do cache visual e permite recorte espacial progressivo', () => {
  const collection: GeoFeatureCollection = {
    type: 'FeatureCollection',
    features: Array.from({ length: 25_000 }, (_, index) => ({
      type: 'Feature', properties: { index }, geometry: { type: 'Point', coordinates: [-60 + index / 1_000, -20] }
    }))
  };
  const display = buildDisplayCollections(collection);
  assert.equal(display.simplified, true);
  assert.equal(display.levels.low.features.length, 5_000);
  assert.equal(display.levels.medium.features.length, 20_000);
  const cropped = cropCollectionToBbox(display.levels.medium, [-50, -21, -49, -19]);
  assert.ok(cropped.features.length > 0 && cropped.features.length < display.levels.medium.features.length);
  assert.equal(collection.features.length, 25_000);
});

test('valida GeometryCollection vazia, geometria nula e coordenada não numérica', () => {
  const collection = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: null },
      { type: 'Feature', properties: {}, geometry: { type: 'GeometryCollection', geometries: [] } },
      { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, Number.NaN], [0, 0]]] } }
    ]
  } as GeoFeatureCollection;
  const codes = validateTopology(collection).map((issue) => issue.code);
  assert.ok(codes.includes('null_geometry'));
  assert.ok(codes.includes('empty_geometry_collection'));
  assert.ok(codes.includes('invalid_coordinate'));
});

test('suporta SAD69, sugere zona UTM sem aplicá-la e recusa definição insegura', () => {
  const transformed = transformPosition([-48.55, -27.6], assertSupportedCrs('EPSG:4618'));
  assert.ok(transformed[0] > -49 && transformed[0] < -48);
  assert.equal(suggestBrazilUtmZone(-48.55), 22);
  assert.throws(() => assertSupportedCrs(`EPSG:4326\u0000`), /limites seguros/);
});

test('valida MBTiles e rejeita SQLite sem tabelas obrigatórias', async () => {
  await withScratch('mbtiles', async (directory) => {
    const invalidPath = path.join(directory, 'invalido.mbtiles');
    const client = createClient({ url: `file:${invalidPath}` });
    await client.execute('CREATE TABLE qualquer (id INTEGER)');
    await client.close();
    await assert.rejects(() => MbtilesService.importFile(invalidPath, 'invalido.mbtiles', directory), /tabelas obrigatórias/);
  });
});

test('lê metadados e extensão de MBTiles raster válido', async () => {
  await withScratch('mbtiles-valid', async (directory) => {
    const filePath = path.join(directory, 'florianopolis.mbtiles');
    const client = createClient({ url: `file:${filePath}` });
    await client.batch([
      'CREATE TABLE metadata (name TEXT PRIMARY KEY, value TEXT)',
      'CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB)',
      "INSERT INTO metadata VALUES ('name','Florianópolis offline')",
      "INSERT INTO metadata VALUES ('format','png')",
      "INSERT INTO metadata VALUES ('bounds','-48.7,-27.8,-48.3,-27.3')",
      'INSERT INTO tiles VALUES (10,374,602,zeroblob(8))'
    ], 'write');
    await client.close();
    const inspected = await inspectMbtiles(filePath);
    assert.equal(inspected.metadata.name, 'Florianópolis offline');
    assert.equal(inspected.format, 'png');
    assert.deepEqual(inspected.bounds, [-48.7, -27.8, -48.3, -27.3]);
    assert.equal(inspected.minZoom, 10);
  });
});
