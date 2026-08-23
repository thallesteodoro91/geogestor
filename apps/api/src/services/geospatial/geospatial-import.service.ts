import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { DOMParser } from '@xmldom/xmldom';
import { kml as kmlToGeoJson } from '@tmcw/togeojson';
import * as shapefile from 'shapefile';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { schema } from '@geogestor/database';
import type { GeospatialLayerSummary } from '@geogestor/contracts';
import { assertSupportedCrs, detectionMetadata, extractEpsg, normalizeCrsIdentifier } from './crs-detection.service';
import {
  collectionBbox,
  collectionMetrics,
  detectLikelySwappedBrazilianAxes,
  normalizeCollection,
  representativePoint,
  validateNormalizedCollection
} from './geometry-validation.service';
import { extractSafeArchive } from './safe-archive.service';
import { annotateProblemFeatures, repairSafeTopology, validateTopology } from './topology-validation.service';
import { buildDisplayCollections, countVertices, cropCollectionToBbox, displayLevelForZoom } from './visualization-cache.service';
import { GEOSPATIAL_AUDIT_EVENTS, GeospatialAuditService } from './geospatial-audit.service';
import { VECTOR_SURVEY_EXTENSIONS } from './vector-upload-policy.service';
import type {
  GeoFeature,
  GeoFeatureCollection,
  GeoGeometry,
  GeospatialProcessOptions,
  ParsedGeospatialLayer
} from './geospatial-types';

const MAX_TEXT_BYTES = Number(process.env.GEOGESTOR_GEO_MAX_TEXT_BYTES || 250 * 1024 * 1024);
const MAX_FEATURES = Number(process.env.GEOGESTOR_GEO_MAX_FEATURES || 500_000);
const MAX_VERTICES = Number(process.env.GEOGESTOR_GEO_MAX_VERTICES || 5_000_000);
const MAX_PROCESSING_MS = Number(process.env.GEOGESTOR_GEO_MAX_PROCESSING_MS || 5 * 60_000);
const MAX_HEAP_BYTES = Number(process.env.GEOGESTOR_GEO_MAX_MEMORY_MB || 1024) * 1024 * 1024;
const CACHE_DIRECTORY = path.join('.geogestor', 'cache', 'geospatial');

class GeospatialImportError extends Error {
  constructor(message: string, readonly code = 'invalid_geospatial_file') {
    super(message);
  }
}

function asFeatureCollection(value: any): GeoFeatureCollection {
  if (!value || typeof value !== 'object') throw new GeospatialImportError('O arquivo não contém um objeto geoespacial válido.');
  if (value.type === 'FeatureCollection' && Array.isArray(value.features)) return value as GeoFeatureCollection;
  if (value.type === 'Feature') return { type: 'FeatureCollection', features: [value as GeoFeature] };
  if (typeof value.type === 'string' && (value.coordinates !== undefined || value.type === 'GeometryCollection')) {
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: value as GeoGeometry }] };
  }
  throw new GeospatialImportError('O GeoJSON deve conter FeatureCollection, Feature ou uma geometria válida.');
}

export function parseKmlText(content: string, name: string, format: 'kml' | 'kmz'): ParsedGeospatialLayer {
  const parserErrors: string[] = [];
  const document = new DOMParser({
    onError: (level, message) => {
      if (level === 'error' || level === 'fatalError') parserErrors.push(message);
    }
  }).parseFromString(content, 'application/xml');
  if (parserErrors.length) throw new GeospatialImportError(`KML inválido: ${parserErrors[0]}`);
  const collection = kmlToGeoJson(document as unknown as Document) as unknown as GeoFeatureCollection;
  if (!collection.features?.length) throw new GeospatialImportError('O KML não contém feições geográficas compatíveis.');
  return {
    name,
    format,
    collection,
    sourceCrs: 'EPSG:4326',
    sourceEpsg: 4326,
    warnings: []
  };
}

async function parseKml(filePath: string) {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_TEXT_BYTES) throw new GeospatialImportError(`O KML excede o limite configurado de ${Math.round(MAX_TEXT_BYTES / 1024 / 1024)} MB para processamento.`);
  return [parseKmlText(await fs.readFile(filePath, 'utf8'), path.basename(filePath), 'kml')];
}

async function parseKmz(filePath: string) {
  const entries = extractSafeArchive(await fs.readFile(filePath), { maxEntries: 32, maxTotalBytes: 30 * 1024 * 1024 });
  const layers: ParsedGeospatialLayer[] = [];
  for (const [entryName, bytes] of entries) {
    if (!entryName.toLowerCase().endsWith('.kml')) continue;
    layers.push(parseKmlText(Buffer.from(bytes).toString('utf8'), `${path.basename(filePath)} / ${entryName}`, 'kmz'));
  }
  if (!layers.length) throw new GeospatialImportError('O KMZ não contém um arquivo KML válido.');
  return layers;
}

function detectGeoJsonCrs(json: any) {
  const name = json?.crs?.properties?.name || json?.crs?.name;
  return normalizeCrsIdentifier(typeof name === 'string' ? name : null) || 'EPSG:4326';
}

async function parseGeoJson(filePath: string) {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_TEXT_BYTES) throw new GeospatialImportError(`O GeoJSON excede o limite configurado de ${Math.round(MAX_TEXT_BYTES / 1024 / 1024)} MB para processamento.`);
  const json = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const sourceCrs = detectGeoJsonCrs(json);
  return [{
    name: path.basename(filePath),
    format: 'geojson' as const,
    collection: asFeatureCollection(json),
    sourceCrs,
    sourceEpsg: extractEpsg(sourceCrs),
    warnings: json?.crs ? ['O arquivo usa a propriedade legada crs do GeoJSON; o SRC foi preservado e validado.'] : []
  }];
}

function matchingArchiveEntry(entries: Map<string, Uint8Array>, base: string, extension: string) {
  const target = `${base}${extension}`.toLowerCase();
  return [...entries.entries()].find(([name]) => name.toLowerCase() === target)?.[1] || null;
}

async function parseShapefileBuffers(
  name: string,
  shp: Uint8Array,
  dbf: Uint8Array | null,
  prj: Uint8Array | null,
  cpg: Uint8Array | null = null
): Promise<ParsedGeospatialLayer> {
  const rawEncoding = cpg ? Buffer.from(cpg).toString('utf8').trim().replace(/^UTF-?8$/i, 'utf-8') : 'windows-1252';
  const collection = asFeatureCollection(await shapefile.read(shp, dbf, { encoding: rawEncoding }));
  const sourceCrs = prj ? Buffer.from(prj).toString('utf8').trim() : null;
  return {
    name,
    format: 'shapefile',
    collection,
    sourceCrs,
    sourceEpsg: extractEpsg(sourceCrs),
    status: sourceCrs ? 'ready' : 'needs_crs',
    warnings: [
      ...(dbf ? [] : ['O componente .dbf não foi encontrado; a geometria foi lida sem a tabela de atributos.']),
      ...(dbf && !cpg ? ['O componente .cpg não foi encontrado; os atributos foram interpretados como Windows-1252.'] : [])
    ]
  };
}

async function parseShapefileZip(filePath: string) {
  const entries = extractSafeArchive(await fs.readFile(filePath));
  const shpEntries = [...entries.entries()].filter(([name]) => name.toLowerCase().endsWith('.shp'));
  if (!shpEntries.length) throw new GeospatialImportError('O ZIP não contém nenhum componente .shp.', 'not_a_shapefile_zip');
  const layers: ParsedGeospatialLayer[] = [];
  for (const [shpName, shp] of shpEntries) {
    const base = shpName.slice(0, -4);
    const shx = matchingArchiveEntry(entries, base, '.shx');
    if (!shx) throw new GeospatialImportError(`O Shapefile ${path.posix.basename(base)} não possui o componente obrigatório .shx.`);
    layers.push(await parseShapefileBuffers(
      `${path.basename(filePath)} / ${path.posix.basename(base)}`,
      shp,
      matchingArchiveEntry(entries, base, '.dbf'),
      matchingArchiveEntry(entries, base, '.prj'),
      matchingArchiveEntry(entries, base, '.cpg')
    ));
  }
  return layers;
}

async function parseStandaloneShapefile(filePath: string) {
  const base = filePath.slice(0, -4);
  const companion = async (extension: string) => fs.readFile(`${base}${extension}`).catch(() => null);
  const shx = await companion('.shx');
  if (!shx) throw new GeospatialImportError('O Shapefile não possui o componente obrigatório .shx. Envie preferencialmente um ZIP completo.');
  return [await parseShapefileBuffers(
    path.basename(filePath),
    await fs.readFile(filePath),
    await companion('.dbf'),
    await companion('.prj'),
    await companion('.cpg')
  )];
}

function quoteSqlIdentifier(value: string) { return `"${value.replace(/"/g, '""')}"`; }

class WkbReader {
  private offset = 0;
  constructor(private readonly bytes: Uint8Array) {}
  private uint32(littleEndian: boolean) {
    const value = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 4).getUint32(0, littleEndian);
    this.offset += 4;
    return value;
  }
  private float64(littleEndian: boolean) {
    const value = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 8).getFloat64(0, littleEndian);
    this.offset += 8;
    return value;
  }
  readGeometry(): GeoGeometry {
    const littleEndian = this.bytes[this.offset++] === 1;
    const rawType = this.uint32(littleEndian);
    const hasZ = (rawType & 0x80000000) !== 0 || Math.floor((rawType % 4000) / 1000) === 1 || Math.floor((rawType % 4000) / 1000) === 3;
    const hasM = (rawType & 0x40000000) !== 0 || Math.floor((rawType % 4000) / 1000) >= 2;
    const type = (rawType & 0x0fffffff) % 1000;
    const position = () => {
      const result = [this.float64(littleEndian), this.float64(littleEndian)];
      if (hasZ) result.push(this.float64(littleEndian));
      if (hasM) this.float64(littleEndian);
      return result;
    };
    const positions = () => Array.from({ length: this.uint32(littleEndian) }, position);
    if (type === 1) return { type: 'Point', coordinates: position() };
    if (type === 2) return { type: 'LineString', coordinates: positions() };
    if (type === 3) return { type: 'Polygon', coordinates: Array.from({ length: this.uint32(littleEndian) }, positions) };
    if (type >= 4 && type <= 7) {
      const geometries = Array.from({ length: this.uint32(littleEndian) }, () => this.readGeometry());
      if (type === 7) return { type: 'GeometryCollection', geometries };
      const expected = type === 4 ? 'Point' : type === 5 ? 'LineString' : 'Polygon';
      return { type: `Multi${expected}`, coordinates: geometries.map((geometry) => geometry.coordinates) };
    }
    throw new GeospatialImportError(`Tipo WKB ${type} ainda não é suportado.`);
  }
}

function decodeGeoPackageGeometry(value: unknown): { geometry: GeoGeometry; srsId: number } {
  const bytes = value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : null;
  if (!bytes || bytes.length < 9 || bytes[0] !== 0x47 || bytes[1] !== 0x50) throw new GeospatialImportError('GeoPackage contém uma geometria binária inválida.');
  const flags = bytes[3];
  const littleEndian = (flags & 1) === 1;
  const envelopeCode = (flags >> 1) & 7;
  const envelopeDoubles = [0, 4, 6, 6, 8][envelopeCode] ?? 0;
  const srsId = new DataView(bytes.buffer, bytes.byteOffset + 4, 4).getInt32(0, littleEndian);
  const wkbOffset = 8 + envelopeDoubles * 8;
  return { geometry: new WkbReader(bytes.subarray(wkbOffset)).readGeometry(), srsId };
}

async function parseGeoPackage(filePath: string) {
  const handle = await fs.open(filePath, 'r');
  const signature = Buffer.alloc(16);
  try { await handle.read(signature, 0, signature.length, 0); } finally { await handle.close(); }
  if (signature.toString('ascii') !== 'SQLite format 3\0') throw new GeospatialImportError('O GeoPackage não possui uma assinatura SQLite válida.');
  const client = createClient({ url: `file:${filePath}` });
  try {
    const tableRows = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = new Set(tableRows.rows.map((row) => String(row.name)));
    if (!tables.has('gpkg_contents')) {
      if (tables.has('metadata') && tables.has('tiles')) {
        throw new GeospatialImportError('O arquivo possui estrutura MBTiles. Importe-o somente em Configurar mapa-base offline.');
      }
      throw new GeospatialImportError('O arquivo SQLite não possui a estrutura obrigatória de um GeoPackage.');
    }
    const rasterContents = await client.execute("SELECT table_name, identifier, data_type FROM gpkg_contents WHERE lower(data_type) IN ('tiles','2d-gridded-coverage') ORDER BY table_name");
    const ignoredRasterLayers = rasterContents.rows.map((row) => String(row.identifier || row.table_name));
    if (!tables.has('gpkg_geometry_columns')) {
      if (ignoredRasterLayers.length) throw new GeospatialImportError('O GeoPackage não contém camadas vetoriais compatíveis. Camadas raster não são importadas como levantamento.');
      throw new GeospatialImportError('O GeoPackage não contém a tabela de camadas vetoriais obrigatória.');
    }
    const geometryColumns = await client.execute(`SELECT gc.table_name, gc.column_name, gc.srs_id, c.identifier
      FROM gpkg_geometry_columns gc
      LEFT JOIN gpkg_contents c ON c.table_name = gc.table_name
      ORDER BY gc.table_name`);
    if (!geometryColumns.rows.length) {
      if (ignoredRasterLayers.length) throw new GeospatialImportError('O GeoPackage não contém camadas vetoriais compatíveis. Camadas raster não são importadas como levantamento.');
      throw new GeospatialImportError('O GeoPackage não possui camadas vetoriais compatíveis.');
    }
    const layers: ParsedGeospatialLayer[] = [];
    for (const column of geometryColumns.rows) {
      const tableName = String(column.table_name);
      const geometryColumn = String(column.column_name);
      const declaredSrsId = Number(column.srs_id);
      const srsResult = await client.execute({
        sql: 'SELECT organization, organization_coordsys_id, definition FROM gpkg_spatial_ref_sys WHERE srs_id = ?',
        args: [declaredSrsId]
      });
      const srs = srsResult.rows[0];
      const epsg = String(srs?.organization || '').toUpperCase() === 'EPSG' ? Number(srs?.organization_coordsys_id) : null;
      const sourceCrs = epsg ? `EPSG:${epsg}` : String(srs?.definition || '').trim() || null;
      const rows = await client.execute(`SELECT * FROM ${quoteSqlIdentifier(tableName)} LIMIT ${MAX_FEATURES + 1}`);
      if (rows.rows.length > MAX_FEATURES) throw new GeospatialImportError(`A camada ${tableName} excede o limite de ${MAX_FEATURES.toLocaleString('pt-BR')} feições.`);
      const features: GeoFeature[] = rows.rows.map((row) => {
        const decoded = decodeGeoPackageGeometry(row[geometryColumn]);
        const properties: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(row)) if (key !== geometryColumn) properties[key] = item;
        if (decoded.srsId !== declaredSrsId) properties.__geogestor_srs_id = decoded.srsId;
        return { type: 'Feature', properties, geometry: decoded.geometry };
      });
      layers.push({
        name: String(column.identifier || tableName),
        sourceLayer: tableName,
        format: 'geopackage',
        collection: { type: 'FeatureCollection', features },
        sourceCrs,
        sourceEpsg: epsg,
        status: sourceCrs && declaredSrsId > 0 ? 'ready' : 'needs_crs',
        warnings: ignoredRasterLayers.length
          ? [`Conteúdo raster ignorado no GeoPackage: ${ignoredRasterLayers.join(', ')}. Somente as camadas vetoriais foram importadas.`]
          : [],
        ignoredRasterLayers
      });
    }
    return layers;
  } finally {
    await client.close();
  }
}

export async function parseGeospatialFile(filePath: string): Promise<ParsedGeospatialLayer[]> {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.kml') return parseKml(filePath);
  if (extension === '.kmz') return parseKmz(filePath);
  if (extension === '.geojson' || extension === '.json') return parseGeoJson(filePath);
  if (extension === '.shp') return parseStandaloneShapefile(filePath);
  if (extension === '.zip') return parseShapefileZip(filePath);
  if (extension === '.gpkg') return parseGeoPackage(filePath);
  throw new GeospatialImportError('Formato geoespacial não suportado.');
}

async function hashFile(filePath: string) {
  const hash = crypto.createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function locationDistanceM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toSummary(row: typeof schema.camadasGeoespaciais.$inferSelect, fileName: string, data?: object | null): GeospatialLayerSummary & { type: string; fileName: string } {
  return {
    contentKind: 'vector',
    id: row.id,
    documentId: row.documentoId,
    clientId: row.clienteId,
    projectId: row.projetoId,
    fileName,
    name: row.nome,
    sourceLayer: row.camadaOrigem,
    format: row.formato as GeospatialLayerSummary['format'],
    type: row.formato,
    status: row.status as GeospatialLayerSummary['status'],
    sourceCrs: row.srcOriginal,
    sourceEpsg: row.epsgOriginal,
    targetEpsg: 4326,
    featureCount: row.quantidadeFeicoes,
    vertexCount: row.quantidadeVertices,
    geometryTypes: safeJsonParse(row.tiposGeometriaJson, []),
    bbox: safeJsonParse(row.bboxJson, null),
    representativePoint: row.latitudeRepresentativa != null && row.longitudeRepresentativa != null
      ? { latitude: row.latitudeRepresentativa, longitude: row.longitudeRepresentativa }
      : null,
    areaM2: row.areaM2,
    perimeterM: row.perimetroM,
    warnings: safeJsonParse(row.avisosJson, []),
    topologyIssues: safeJsonParse(row.problemasTopologiaJson, []),
    repairs: safeJsonParse(row.reparosJson, []),
    errorMessage: row.mensagemErro,
    processingStage: row.etapaProcessamento as GeospatialLayerSummary['processingStage'],
    processingProgress: row.progressoProcessamento,
    sourceDetection: row.srcOrigemDeteccao,
    crsConfidence: row.confiancaSrc as GeospatialLayerSummary['crsConfidence'],
    axisOrder: row.ordemEixos as GeospatialLayerSummary['axisOrder'],
    representativePointMethod: row.metodoPontoRepresentativo,
    simplifiedForDisplay: row.simplificadaVisualizacao,
    precisionCacheBytes: row.tamanhoCacheBytes,
    displayCacheBytes: row.tamanhoVisualizacaoBytes,
    visible: row.visivel,
    color: row.cor,
    opacity: row.opacidade,
    importedAt: row.importadoEm,
    data: data || null
  };
}

export class GeospatialImportService {
  private static progress = new Map<string, { stage: GeospatialLayerSummary['processingStage']; progress: number; cancelRequested: boolean; updatedAt: string }>();

  private static setProgress(documentId: string, stage: GeospatialLayerSummary['processingStage'], progress: number) {
    const previous = this.progress.get(documentId);
    this.progress.set(documentId, { stage, progress, cancelRequested: previous?.cancelRequested || false, updatedAt: new Date().toISOString() });
  }

  static getProgress(documentId: string) {
    return this.progress.get(documentId) || { stage: 'concluido', progress: 100, cancelRequested: false, updatedAt: null };
  }

  static requestCancellation(documentId: string) {
    const current = this.getProgress(documentId);
    this.progress.set(documentId, { ...current, cancelRequested: true, updatedAt: new Date().toISOString() } as any);
    return this.getProgress(documentId);
  }

  private static assertNotCancelled(documentId: string) {
    if (this.progress.get(documentId)?.cancelRequested) throw new GeospatialImportError('Processamento cancelado pelo usuário.', 'cancelled');
  }

  static isCandidate(filePath: string) { return (VECTOR_SURVEY_EXTENSIONS as readonly string[]).includes(path.extname(filePath).toLowerCase()); }

  static async processDocument(document: typeof schema.documentos.$inferSelect, dataRoot: string, options: GeospatialProcessOptions = {}) {
    if (!this.isCandidate(document.caminho)) return [];
    const startedAt = Date.now();
    const assertResourceLimits = () => {
      if (Date.now() - startedAt > MAX_PROCESSING_MS) {
        this.setProgress(document.id, 'erro', 100);
        throw new GeospatialImportError('O processamento excedeu o limite de tempo configurado.', 'resource_limit');
      }
      if (process.memoryUsage().heapUsed > MAX_HEAP_BYTES) {
        this.setProgress(document.id, 'erro', 100);
        throw new GeospatialImportError('O processamento excedeu o limite de memória configurado. O arquivo original foi preservado.', 'resource_limit');
      }
    };
    this.setProgress(document.id, 'validando', 5);
    const originalHash = await hashFile(document.caminho);
    this.assertNotCancelled(document.id);
    this.setProgress(document.id, 'processando', 15);
    let parsedLayers: ParsedGeospatialLayer[];
    try {
      parsedLayers = await parseGeospatialFile(document.caminho);
    } catch (error) {
      if (error instanceof GeospatialImportError && error.code === 'not_a_shapefile_zip') return [];
      parsedLayers = [{
        name: document.nome,
        format: path.extname(document.caminho).toLowerCase() === '.zip'
          ? 'shapefile'
          : path.extname(document.caminho).slice(1) as ParsedGeospatialLayer['format'],
        warnings: [],
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Falha ao processar o arquivo geoespacial.'
      }];
    }

    const cacheDir = path.join(dataRoot, CACHE_DIRECTORY);
    await fs.mkdir(cacheDir, { recursive: true });
    const nextRows: Array<typeof schema.camadasGeoespaciais.$inferInsert> = [];
    const cachePayloads: Array<{ path: string; data: unknown }> = [];

    for (const [layerIndex, parsed] of parsedLayers.entries()) {
      this.assertNotCancelled(document.id);
      assertResourceLimits();
      this.setProgress(document.id, 'reprojetando', 25 + Math.round((layerIndex / Math.max(parsedLayers.length, 1)) * 35));
      await new Promise<void>((resolve) => setImmediate(resolve));
      const id = crypto.randomUUID();
      const warnings = [...parsed.warnings];
      const sourceCrsValue = options.sourceCrs || parsed.sourceCrs;
      let status = parsed.status || 'ready';
      let errorMessage = parsed.errorMessage || null;
      let normalized: GeoFeatureCollection | null = null;
      let bbox: [number, number, number, number] | null = null;
      let location: { latitude: number; longitude: number } | null = null;
      const featureCount = parsed.collection?.features.length || 0;
      const vertexCount = parsed.collection ? countVertices(parsed.collection) : 0;
      let geometryTypes: string[] = [];
      let areaM2: number | null = null;
      let perimeterM: number | null = null;
      let cachePath: string | null = null;
      let displayCachePath: string | null = null;
      let precisionCacheBytes = 0;
      let displayCacheBytes = 0;
      let topologyIssues: ReturnType<typeof validateTopology> = [];
      const repairs: string[] = [];
      let simplifiedForDisplay = false;
      let resolvedCrs: string | null = null;
      const detection = detectionMetadata({ sourceCrs: sourceCrsValue, sourceEpsg: parsed.sourceEpsg, format: parsed.format, manuallyProvided: Boolean(options.sourceCrs) });

      if (status !== 'error' && parsed.collection) {
        if (parsed.collection.features.length > MAX_FEATURES) {
          status = 'error';
          errorMessage = `A camada excede o limite de ${MAX_FEATURES.toLocaleString('pt-BR')} feições.`;
        } else if (vertexCount > MAX_VERTICES) {
          status = 'error';
          errorMessage = `A camada excede o limite configurado de ${MAX_VERTICES.toLocaleString('pt-BR')} vértices.`;
        } else if (!sourceCrsValue) {
          status = 'needs_crs';
          warnings.push('O arquivo não informa o Sistema de Referência de Coordenadas (SRC). Selecione o SRC antes de posicioná-lo.');
        } else {
          try {
            resolvedCrs = assertSupportedCrs(sourceCrsValue);
            const likelySwapped = extractEpsg(resolvedCrs) === 4326 && detectLikelySwappedBrazilianAxes(parsed.collection);
            if (likelySwapped && !options.axisOrder) {
              status = 'needs_review';
              warnings.push('As coordenadas parecem estar na ordem latitude/longitude. Confirme a ordem dos eixos antes de usar a localização.');
            }
            normalized = normalizeCollection(parsed.collection, resolvedCrs, options.axisOrder);
            warnings.push(...validateNormalizedCollection(normalized));
            topologyIssues = validateTopology(normalized);
            if (topologyIssues.some((issue) => issue.severity === 'blocking') && status === 'ready') status = 'needs_review';
            bbox = collectionBbox(normalized);
            location = representativePoint(normalized, bbox);
            const metrics = collectionMetrics(normalized);
            geometryTypes = metrics.geometryTypes;
            areaM2 = metrics.areaM2 || null;
            perimeterM = metrics.perimeterM || null;
            cachePath = path.join(cacheDir, `${id}.precision.geojson`);
            displayCachePath = path.join(cacheDir, `${id}.display.json`);
            const display = buildDisplayCollections(annotateProblemFeatures(normalized, topologyIssues), vertexCount);
            simplifiedForDisplay = display.simplified;
            if (display.simplified) warnings.push('A camada foi simplificada somente para visualização; cálculos e relatórios usam a geometria de precisão.');
            precisionCacheBytes = Buffer.byteLength(JSON.stringify(normalized));
            displayCacheBytes = Buffer.byteLength(JSON.stringify(display.levels));
            cachePayloads.push({ path: cachePath, data: normalized }, { path: displayCachePath, data: display.levels });
          } catch (error) {
            status = 'error';
            errorMessage = error instanceof Error ? error.message : 'Falha ao transformar a geometria.';
            normalized = null;
          }
        }
      }

      nextRows.push({
        id,
        documentoId: document.id,
        clienteId: document.clienteId,
        projetoId: document.projetoId,
        nome: parsed.name,
        camadaOrigem: parsed.sourceLayer || null,
        formato: parsed.format,
        srcOriginal: resolvedCrs || sourceCrsValue || null,
        epsgOriginal: extractEpsg(resolvedCrs || sourceCrsValue),
        epsgDestino: 4326,
        status,
        quantidadeFeicoes: featureCount,
        quantidadeVertices: vertexCount,
        tiposGeometriaJson: JSON.stringify(geometryTypes),
        bboxJson: bbox ? JSON.stringify(bbox) : null,
        latitudeRepresentativa: location?.latitude ?? null,
        longitudeRepresentativa: location?.longitude ?? null,
        areaM2,
        perimetroM: perimeterM,
        avisosJson: JSON.stringify([...new Set(warnings)]),
        mensagemErro: errorMessage,
        caminhoCache: cachePath,
        caminhoCacheVisualizacao: displayCachePath,
        tamanhoCacheBytes: precisionCacheBytes,
        tamanhoVisualizacaoBytes: displayCacheBytes,
        hashOriginal: originalHash,
        srcOrigemDeteccao: detection.source,
        confiancaSrc: detection.confidence,
        ordemEixos: options.axisOrder || 'longitude-latitude',
        problemasTopologiaJson: JSON.stringify(topologyIssues),
        reparosJson: JSON.stringify(repairs),
        relatorioJson: JSON.stringify({
          contentKind: 'vector',
          fileName: document.nome,
          relativePath: document.caminhoRelativo,
          format: parsed.format,
          layer: parsed.name,
          importedAt: new Date().toISOString(),
          sourceCrs: resolvedCrs || sourceCrsValue || null,
          sourceEpsg: extractEpsg(resolvedCrs || sourceCrsValue),
          sourceDetection: detection.source,
          crsConfidence: detection.confidence,
          targetCrs: 'EPSG:4326',
          axisOrder: options.axisOrder || 'longitude-latitude',
          featureCount,
          vertexCount,
          geometryTypes,
          bbox,
          representativePoint: location,
          representativePointMethod: 'point-on-surface',
          areaM2,
          perimeterM,
          metricMethod: 'aproximação geodésica sobre esfera; não substitui cálculo topográfico no SRC projetado',
          originalSizeBytes: document.tamanhoBytes,
          warnings: [...new Set(warnings)],
          ignoredRasterLayers: parsed.ignoredRasterLayers || [],
          topologyIssues,
          repairs,
          simplifiedForDisplay,
          result: status === 'error' ? 'erro' : status === 'needs_review' || status === 'needs_crs' ? 'requer revisão' : warnings.length ? 'aprovado com alertas' : 'aprovado'
        }),
        etapaProcessamento: status === 'error' ? 'erro' : 'concluido',
        progressoProcessamento: 100,
        cancelamentoSolicitado: false,
        metodoPontoRepresentativo: 'point-on-surface',
        simplificadaVisualizacao: simplifiedForDisplay,
        visivel: true,
        cor: '#7c3aed',
        opacidade: 0.75,
        importadoEm: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    this.assertNotCancelled(document.id);
    assertResourceLimits();
    this.setProgress(document.id, 'preparando_visualizacao', 75);
    for (const payload of cachePayloads) await fs.writeFile(payload.path, JSON.stringify(payload.data), { encoding: 'utf8', flag: 'wx' });
    const previous = await db.select().from(schema.camadasGeoespaciais)
      .where(and(eq(schema.camadasGeoespaciais.documentoId, document.id), isNull(schema.camadasGeoespaciais.deletedAt)));
    try {
      await db.transaction(async (tx) => {
        if (previous.length) {
          await tx.update(schema.camadasGeoespaciais).set({ deletedAt: new Date().toISOString() })
            .where(and(eq(schema.camadasGeoespaciais.documentoId, document.id), isNull(schema.camadasGeoespaciais.deletedAt)));
        }
        if (nextRows.length) await tx.insert(schema.camadasGeoespaciais).values(nextRows);
      });
    } catch (error) {
      await Promise.all(cachePayloads.map((payload) => fs.unlink(payload.path).catch(() => undefined)));
      this.setProgress(document.id, 'erro', 100);
      throw error;
    }
    await Promise.all(previous.flatMap((item) => [item.caminhoCache, item.caminhoCacheVisualizacao]
      .filter(Boolean).map((filePath) => fs.unlink(filePath!).catch(() => undefined))));
    await Promise.all(nextRows.flatMap((row) => {
      const common = { layerId: row.id, documentId: row.documentoId, projectId: row.projetoId };
      const events = [
        GeospatialAuditService.record({ ...common, type: GEOSPATIAL_AUDIT_EVENTS.vectorSurveyImported, description: 'Levantamento vetorial importado e cache de visualização preparado.', data: { contentKind: 'vector', format: row.formato, sourceCrs: row.srcOriginal, featureCount: row.quantidadeFeicoes, vertexCount: row.quantidadeVertices } })
      ];
      const ignoredRasterLayers = safeJsonParse<{ ignoredRasterLayers?: string[] }>(row.relatorioJson, {}).ignoredRasterLayers || [];
      if (ignoredRasterLayers.length) events.push(GeospatialAuditService.record({ ...common, type: GEOSPATIAL_AUDIT_EVENTS.rasterContentIgnored, description: 'Conteúdo raster do GeoPackage ignorado; somente vetores foram importados.', data: { layerNames: ignoredRasterLayers } }));
      if (row.srcOriginal) events.push(GeospatialAuditService.record({ ...common, type: options.sourceCrs ? 'src_corrigido_manualmente' : 'src_detectado', description: options.sourceCrs ? 'SRC confirmado manualmente pelo usuário.' : 'SRC identificado a partir do arquivo ou de seus metadados.', data: { sourceCrs: row.srcOriginal, source: row.srcOrigemDeteccao, confidence: row.confiancaSrc } }));
      if (row.status === 'ready' || row.status === 'needs_review') events.push(GeospatialAuditService.record({ ...common, type: 'geometria_reprojetada', description: 'Geometria normalizada para EPSG:4326.', data: { sourceCrs: row.srcOriginal, targetCrs: 'EPSG:4326' } }));
      if (options.axisOrder) events.push(GeospatialAuditService.record({ ...common, type: 'ordem_eixos_alterada', description: 'Ordem dos eixos confirmada durante o processamento.', data: { axisOrder: options.axisOrder } }));
      if (row.simplificadaVisualizacao) events.push(GeospatialAuditService.record({ ...common, type: 'camada_simplificada_visualizacao', description: 'Camada simplificada exclusivamente para visualização.', data: { precisionBytes: row.tamanhoCacheBytes, displayBytes: row.tamanhoVisualizacaoBytes } }));
      return events;
    }));
    this.setProgress(document.id, 'concluido', 100);
    return Promise.all(nextRows.map(async (row) => {
      const levels = row.caminhoCacheVisualizacao ? JSON.parse(await fs.readFile(row.caminhoCacheVisualizacao, 'utf8')) as Record<string, object> : null;
      const data = levels?.medium || null;
      return toSummary(row as typeof schema.camadasGeoespaciais.$inferSelect, document.nome, data);
    }));
  }

  private static async ensureScopeLayers(scope: { clientId?: string; projectIds?: string[] }, dataRoot: string) {
    const conditions = [eq(schema.documentos.status, 'ativo'), isNull(schema.documentos.deletedAt)];
    if (scope.projectIds) conditions.push(inArray(schema.documentos.projetoId, scope.projectIds));
    else if (scope.clientId) conditions.push(eq(schema.documentos.clienteId, scope.clientId));
    const documents = await db.select().from(schema.documentos).where(and(...conditions));
    const candidates = documents.filter((document) => this.isCandidate(document.caminho));
    for (const document of candidates) {
      const existing = await db.select({ id: schema.camadasGeoespaciais.id }).from(schema.camadasGeoespaciais)
        .where(and(eq(schema.camadasGeoespaciais.documentoId, document.id), isNull(schema.camadasGeoespaciais.deletedAt))).limit(1);
      if (!existing.length) await this.processDocument(document, dataRoot);
    }
  }

  private static async list(scope: { clientId?: string; projectIds?: string[] }, dataRoot: string) {
    await this.ensureScopeLayers(scope, dataRoot);
    const conditions = [isNull(schema.camadasGeoespaciais.deletedAt), eq(schema.documentos.status, 'ativo')];
    if (scope.projectIds) conditions.push(inArray(schema.camadasGeoespaciais.projetoId, scope.projectIds));
    else if (scope.clientId) conditions.push(eq(schema.camadasGeoespaciais.clienteId, scope.clientId));
    const rows = await db.select({
      layer: schema.camadasGeoespaciais,
      fileName: schema.documentos.nome,
      projectLatitude: schema.projetos.latitude,
      projectLongitude: schema.projetos.longitude
    })
      .from(schema.camadasGeoespaciais)
      .innerJoin(schema.documentos, eq(schema.camadasGeoespaciais.documentoId, schema.documentos.id))
      .leftJoin(schema.projetos, eq(schema.camadasGeoespaciais.projetoId, schema.projetos.id))
      .where(and(...conditions));
    return Promise.all(rows.map(async ({ layer, fileName, projectLatitude, projectLongitude }) => {
      let data: object | null = null;
      if ((layer.status === 'ready' || layer.status === 'needs_review') && (layer.caminhoCacheVisualizacao || layer.caminhoCache)) {
        if (layer.caminhoCacheVisualizacao) {
          const levels = JSON.parse(await fs.readFile(layer.caminhoCacheVisualizacao, 'utf8')) as Record<string, object>;
          data = levels.medium || levels.high || null;
        } else {
          data = JSON.parse(await fs.readFile(layer.caminhoCache!, 'utf8')) as object;
        }
      }
      const summary = toSummary(layer, fileName, data);
      const projectLocation = projectLatitude != null && projectLongitude != null
        ? { latitude: projectLatitude, longitude: projectLongitude }
        : null;
      const locationDifferenceM = projectLocation && summary.representativePoint
        ? locationDistanceM(projectLocation, summary.representativePoint)
        : null;
      return { ...summary, projectLocation, locationDifferenceM };
    }));
  }

  static listForClient(clientId: string, dataRoot: string) { return this.list({ clientId }, dataRoot); }
  static listForProjects(projectIds: string[], dataRoot: string) { return this.list({ projectIds }, dataRoot); }

  static async reprocessDocument(documentId: string, dataRoot: string, options: GeospatialProcessOptions) {
    const documents = await db.select().from(schema.documentos).where(eq(schema.documentos.id, documentId)).limit(1);
    if (!documents.length) throw new GeospatialImportError('Documento não encontrado.', 'not_found');
    return this.processDocument(documents[0], dataRoot, options);
  }

  static async previewDocumentCrs(documentId: string, options: GeospatialProcessOptions) {
    const documents = await db.select().from(schema.documentos).where(eq(schema.documentos.id, documentId)).limit(1);
    if (!documents.length) throw new GeospatialImportError('Documento não encontrado.', 'not_found');
    const parsedLayers = await parseGeospatialFile(documents[0].caminho);
    const layers = parsedLayers.map((parsed) => {
      if (!parsed.collection) throw new GeospatialImportError(parsed.errorMessage || 'A camada não possui geometria para pré-visualização.');
      const sourceCrs = assertSupportedCrs(options.sourceCrs || parsed.sourceCrs || '');
      const axisOrder = options.axisOrder || 'longitude-latitude';
      const evaluateAxis = (order: 'longitude-latitude' | 'latitude-longitude') => {
        const normalized = normalizeCollection(parsed.collection!, sourceCrs, order);
        const bbox = collectionBbox(normalized);
        const warnings = validateNormalizedCollection(normalized);
        const representative = representativePoint(normalized, bbox);
        const overlapsBrazil = bbox[2] >= -74 && bbox[0] <= -34 && bbox[3] >= -34 && bbox[1] <= 6;
        return { axisOrder: order, bbox, representativePoint: representative, overlapsBrazil, warnings };
      };
      const selected = evaluateAxis(axisOrder);
      const alternate = evaluateAxis(axisOrder === 'longitude-latitude' ? 'latitude-longitude' : 'longitude-latitude');
      return {
        name: parsed.name,
        sourceCrs,
        axisOrder,
        targetCrs: 'EPSG:4326',
        bbox: selected.bbox,
        representativePoint: selected.representativePoint,
        featureCount: parsed.collection.features.length,
        vertexCount: countVertices(parsed.collection),
        overlapsBrazil: selected.overlapsBrazil,
        warnings: selected.overlapsBrazil ? selected.warnings : [...selected.warnings, 'A extensão resultante não intercepta o território brasileiro; revise o SRC e a ordem dos eixos.'],
        axisComparison: [selected, alternate]
      };
    });
    return { documentId, fileName: documents[0].nome, layers };
  }

  static async getDisplayData(layerId: string, zoom = 12, bbox?: [number, number, number, number] | null) {
    const rows = await db.select().from(schema.camadasGeoespaciais)
      .where(and(eq(schema.camadasGeoespaciais.id, layerId), isNull(schema.camadasGeoespaciais.deletedAt))).limit(1);
    const layer = rows[0];
    if (!layer) throw new GeospatialImportError('Camada não encontrada.', 'not_found');
    if (!layer.caminhoCacheVisualizacao) {
      const collection = layer.caminhoCache ? JSON.parse(await fs.readFile(layer.caminhoCache, 'utf8')) as GeoFeatureCollection : null;
      return collection ? cropCollectionToBbox(collection, bbox) : null;
    }
    const levels = JSON.parse(await fs.readFile(layer.caminhoCacheVisualizacao, 'utf8')) as Record<string, object>;
    const collection = (levels[displayLevelForZoom(zoom)] || levels.medium || null) as GeoFeatureCollection | null;
    return collection ? cropCollectionToBbox(collection, bbox) : null;
  }

  static async getReport(layerId: string) {
    const rows = await db.select({
      layer: schema.camadasGeoespaciais,
      fileName: schema.documentos.nome,
      relativePath: schema.documentos.caminhoRelativo,
      projectLatitude: schema.projetos.latitude,
      projectLongitude: schema.projetos.longitude
    })
      .from(schema.camadasGeoespaciais)
      .innerJoin(schema.documentos, eq(schema.camadasGeoespaciais.documentoId, schema.documentos.id))
      .leftJoin(schema.projetos, eq(schema.camadasGeoespaciais.projetoId, schema.projetos.id))
      .where(and(eq(schema.camadasGeoespaciais.id, layerId), isNull(schema.camadasGeoespaciais.deletedAt))).limit(1);
    if (!rows.length) throw new GeospatialImportError('Camada não encontrada.', 'not_found');
    const siblingLayers = await db.select({ name: schema.camadasGeoespaciais.nome }).from(schema.camadasGeoespaciais)
      .where(and(eq(schema.camadasGeoespaciais.documentoId, rows[0].layer.documentoId), isNull(schema.camadasGeoespaciais.deletedAt)));
    const representativePoint = rows[0].layer.latitudeRepresentativa != null && rows[0].layer.longitudeRepresentativa != null
      ? { latitude: rows[0].layer.latitudeRepresentativa, longitude: rows[0].layer.longitudeRepresentativa }
      : null;
    const projectPoint = rows[0].projectLatitude != null && rows[0].projectLongitude != null
      ? { latitude: rows[0].projectLatitude, longitude: rows[0].projectLongitude }
      : null;
    return {
      ...safeJsonParse<Record<string, unknown>>(rows[0].layer.relatorioJson, {}),
      id: layerId,
      fileName: rows[0].fileName,
      relativePath: rows[0].relativePath,
      layersFound: siblingLayers.map((item) => item.name),
      distanceToProjectM: representativePoint && projectPoint ? locationDistanceM(representativePoint, projectPoint) : null,
      cache: { precisionBytes: rows[0].layer.tamanhoCacheBytes, displayBytes: rows[0].layer.tamanhoVisualizacaoBytes }
    };
  }

  static async getLocationPreview(layerId: string) {
    const rows = await db.select({ layer: schema.camadasGeoespaciais, project: schema.projetos, fileName: schema.documentos.nome })
      .from(schema.camadasGeoespaciais)
      .innerJoin(schema.documentos, eq(schema.camadasGeoespaciais.documentoId, schema.documentos.id))
      .leftJoin(schema.projetos, eq(schema.camadasGeoespaciais.projetoId, schema.projetos.id))
      .where(and(eq(schema.camadasGeoespaciais.id, layerId), isNull(schema.camadasGeoespaciais.deletedAt))).limit(1);
    const row = rows[0];
    if (!row?.project || row.layer.latitudeRepresentativa == null || row.layer.longitudeRepresentativa == null) {
      throw new GeospatialImportError('A camada não possui projeto e localização representativa válidos.');
    }
    const current = row.project.latitude != null && row.project.longitude != null
      ? { latitude: row.project.latitude, longitude: row.project.longitude }
      : null;
    const proposed = { latitude: row.layer.latitudeRepresentativa, longitude: row.layer.longitudeRepresentativa };
    return {
      layerId,
      projectId: row.project.id,
      projectName: row.project.nome,
      fileName: row.fileName,
      layerName: row.layer.nome,
      current,
      proposed,
      distanceM: current ? locationDistanceM(current, proposed) : null,
      sourceCrs: row.layer.srcOriginal,
      targetCrs: 'EPSG:4326',
      method: row.layer.metodoPontoRepresentativo || 'point-on-surface'
    };
  }

  static async repairLayer(layerId: string) {
    const rows = await db.select().from(schema.camadasGeoespaciais)
      .where(and(eq(schema.camadasGeoespaciais.id, layerId), isNull(schema.camadasGeoespaciais.deletedAt))).limit(1);
    const layer = rows[0];
    if (!layer?.caminhoCache || !layer.caminhoCacheVisualizacao) throw new GeospatialImportError('A camada não possui cache reparável.');
    const original = JSON.parse(await fs.readFile(layer.caminhoCache, 'utf8')) as GeoFeatureCollection;
    const { collection, repairs } = repairSafeTopology(original);
    if (!repairs.length) return { repaired: false, repairs: [] };
    const backupPath = `${layer.caminhoCache}.before-repair-${crypto.randomUUID()}`;
    await fs.copyFile(layer.caminhoCache, backupPath);
    const issues = validateTopology(collection);
    const display = buildDisplayCollections(annotateProblemFeatures(collection, issues), countVertices(collection));
    const precisionJson = JSON.stringify(collection);
    const displayJson = JSON.stringify(display.levels);
    try {
      await fs.writeFile(layer.caminhoCache, precisionJson, 'utf8');
      await fs.writeFile(layer.caminhoCacheVisualizacao, displayJson, 'utf8');
      await db.update(schema.camadasGeoespaciais).set({
        problemasTopologiaJson: JSON.stringify(issues),
        reparosJson: JSON.stringify([...safeJsonParse(layer.reparosJson, []), ...repairs]),
        tamanhoCacheBytes: Buffer.byteLength(precisionJson),
        tamanhoVisualizacaoBytes: Buffer.byteLength(displayJson),
        status: issues.some((issue) => issue.severity === 'blocking') ? 'needs_review' : 'ready',
        updatedAt: new Date().toISOString()
      }).where(eq(schema.camadasGeoespaciais.id, layerId));
      await GeospatialAuditService.record({ layerId, documentId: layer.documentoId, projectId: layer.projetoId, type: 'reparo_topologico', description: repairs.join('; '), data: { backupPath, repairs } });
      return { repaired: true, repairs, issues };
    } catch (error) {
      await fs.copyFile(backupPath, layer.caminhoCache).catch(() => undefined);
      throw error;
    }
  }

  static async undoRepair(layerId: string) {
    const events = await db.select().from(schema.eventosGeoespaciais)
      .where(and(eq(schema.eventosGeoespaciais.camadaId, layerId), eq(schema.eventosGeoespaciais.tipo, 'reparo_topologico'), isNull(schema.eventosGeoespaciais.desfeitoEm)))
      .orderBy(desc(schema.eventosGeoespaciais.createdAt)).limit(1);
    const event = events[0];
    const data = safeJsonParse<{ backupPath?: string }>(event?.dadosJson, {});
    const layers = await db.select().from(schema.camadasGeoespaciais).where(eq(schema.camadasGeoespaciais.id, layerId)).limit(1);
    const layer = layers[0];
    if (!event || !data.backupPath || !layer?.caminhoCache || !layer.caminhoCacheVisualizacao) throw new GeospatialImportError('Não há reparo disponível para desfazer.');
    const collection = JSON.parse(await fs.readFile(data.backupPath, 'utf8')) as GeoFeatureCollection;
    const issues = validateTopology(collection);
    const display = buildDisplayCollections(annotateProblemFeatures(collection, issues), countVertices(collection));
    await fs.writeFile(layer.caminhoCache, JSON.stringify(collection), 'utf8');
    await fs.writeFile(layer.caminhoCacheVisualizacao, JSON.stringify(display.levels), 'utf8');
    await db.transaction(async (tx) => {
      await tx.update(schema.camadasGeoespaciais).set({ problemasTopologiaJson: JSON.stringify(issues), reparosJson: '[]', status: issues.some((issue) => issue.severity === 'blocking') ? 'needs_review' : 'ready', updatedAt: new Date().toISOString() }).where(eq(schema.camadasGeoespaciais.id, layerId));
      await tx.update(schema.eventosGeoespaciais).set({ desfeitoEm: new Date().toISOString() }).where(eq(schema.eventosGeoespaciais.id, event.id));
    });
    await fs.unlink(data.backupPath).catch(() => undefined);
    await GeospatialAuditService.record({ layerId, documentId: layer.documentoId, projectId: layer.projetoId, type: 'alteracao_desfeita', description: 'Reparo topológico desfeito.' });
    return { undone: true };
  }

  static async useRepresentativeLocation(layerId: string) {
    const rows = await db.select().from(schema.camadasGeoespaciais).where(eq(schema.camadasGeoespaciais.id, layerId)).limit(1);
    const layer = rows[0];
    if (!layer) throw new GeospatialImportError('Camada não encontrada.', 'not_found');
    if (!layer.projetoId) throw new GeospatialImportError('A camada não está vinculada a um projeto.');
    if (layer.latitudeRepresentativa == null || layer.longitudeRepresentativa == null) throw new GeospatialImportError('A camada não possui localização representativa válida.');
    const projects = await db.select().from(schema.projetos).where(eq(schema.projetos.id, layer.projetoId)).limit(1);
    const previous = projects[0]?.latitude != null && projects[0]?.longitude != null
      ? { latitude: projects[0].latitude, longitude: projects[0].longitude }
      : null;
    const next = { latitude: layer.latitudeRepresentativa, longitude: layer.longitudeRepresentativa };
    await db.update(schema.projetos).set({
      latitude: layer.latitudeRepresentativa,
      longitude: layer.longitudeRepresentativa,
      updatedAt: new Date().toISOString()
    }).where(eq(schema.projetos.id, layer.projetoId));
    await GeospatialAuditService.record({
      layerId,
      documentId: layer.documentoId,
      projectId: layer.projetoId,
      type: 'localizacao_projeto_atualizada',
      description: 'Localização do projeto atualizada a partir do ponto representativo da camada.',
      data: { previous, next, sourceCrs: layer.srcOriginal, method: layer.metodoPontoRepresentativo }
    });
    return next;
  }

  static async undoRepresentativeLocation(layerId: string) {
    const events = await db.select().from(schema.eventosGeoespaciais)
      .where(and(eq(schema.eventosGeoespaciais.camadaId, layerId), eq(schema.eventosGeoespaciais.tipo, 'localizacao_projeto_atualizada'), isNull(schema.eventosGeoespaciais.desfeitoEm)))
      .orderBy(desc(schema.eventosGeoespaciais.createdAt)).limit(1);
    const event = events[0];
    if (!event?.projetoId) throw new GeospatialImportError('Não há alteração de localização disponível para desfazer.');
    const data = safeJsonParse<{ previous?: { latitude: number; longitude: number } | null }>(event.dadosJson, {});
    await db.transaction(async (tx) => {
      await tx.update(schema.projetos).set({
        latitude: data.previous?.latitude ?? null,
        longitude: data.previous?.longitude ?? null,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.projetos.id, event.projetoId!));
      await tx.update(schema.eventosGeoespaciais).set({ desfeitoEm: new Date().toISOString() }).where(eq(schema.eventosGeoespaciais.id, event.id));
    });
    await GeospatialAuditService.record({ layerId, documentId: event.documentoId, projectId: event.projetoId, type: 'alteracao_desfeita', description: 'Alteração da localização do projeto desfeita.' });
    return { undone: true, location: data.previous || null };
  }

  static async updateLayerStyle(layerId: string, input: { visible?: boolean; color?: string; opacity?: number }) {
    const color = input.color && /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : undefined;
    const opacity = input.opacity === undefined ? undefined : Math.max(0.1, Math.min(1, Number(input.opacity)));
    const updated = await db.update(schema.camadasGeoespaciais).set({
      visivel: input.visible,
      cor: color,
      opacidade: Number.isFinite(opacity) ? opacity : undefined,
      updatedAt: new Date().toISOString()
    }).where(and(eq(schema.camadasGeoespaciais.id, layerId), isNull(schema.camadasGeoespaciais.deletedAt))).returning();
    if (!updated.length) throw new GeospatialImportError('Camada não encontrada.', 'not_found');
    return updated[0];
  }

  static async removeLayer(layerId: string) {
    const rows = await db.select().from(schema.camadasGeoespaciais)
      .where(and(eq(schema.camadasGeoespaciais.id, layerId), isNull(schema.camadasGeoespaciais.deletedAt))).limit(1);
    if (!rows.length) throw new GeospatialImportError('Camada não encontrada.', 'not_found');
    await db.update(schema.camadasGeoespaciais).set({
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).where(eq(schema.camadasGeoespaciais.id, layerId));
    await Promise.all([rows[0].caminhoCache, rows[0].caminhoCacheVisualizacao]
      .filter(Boolean).map((filePath) => fs.unlink(filePath!).catch(() => undefined)));
    await GeospatialAuditService.record({ layerId, documentId: rows[0].documentoId, projectId: rows[0].projetoId, type: 'camada_processada_removida', description: 'Camada processada removida; documento original preservado.' });
    return { documentPreserved: true };
  }

  static async cacheMaintenance(dataRoot: string, removeOrphans = false) {
    const cacheDir = path.join(dataRoot, CACHE_DIRECTORY);
    await fs.mkdir(cacheDir, { recursive: true });
    const rows = await db.select({ precision: schema.camadasGeoespaciais.caminhoCache, display: schema.camadasGeoespaciais.caminhoCacheVisualizacao })
      .from(schema.camadasGeoespaciais).where(isNull(schema.camadasGeoespaciais.deletedAt));
    const referenced = new Set(rows.flatMap((row) => [row.precision, row.display]).filter(Boolean).map((item) => path.resolve(item!)));
    const entries = await fs.readdir(cacheDir, { withFileTypes: true });
    const orphans: Array<{ path: string; bytes: number }> = [];
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.includes('.before-repair-')) continue;
      const filePath = path.join(cacheDir, entry.name);
      if (referenced.has(path.resolve(filePath))) continue;
      const stat = await fs.stat(filePath);
      orphans.push({ path: filePath, bytes: stat.size });
      if (removeOrphans) await fs.unlink(filePath).catch(() => undefined);
    }
    if (removeOrphans && orphans.length) await GeospatialAuditService.record({ type: 'cache_removido', description: `${orphans.length} cache(s) órfão(s) removido(s).`, data: { files: orphans.length, bytes: orphans.reduce((sum, item) => sum + item.bytes, 0) } });
    return { orphanCount: orphans.length, orphanBytes: orphans.reduce((sum, item) => sum + item.bytes, 0), removed: removeOrphans };
  }
}
