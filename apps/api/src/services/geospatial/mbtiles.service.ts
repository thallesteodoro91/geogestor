import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { schema } from '@geogestor/database';
import type { OfflineBasemapSummary } from '@geogestor/contracts';
import { assertLexicalPathInsideRoot, ensurePathInsideRoot } from '../path-containment.service';
import { GEOSPATIAL_AUDIT_EVENTS, GeospatialAuditService } from './geospatial-audit.service';

const MAX_MBTILES_BYTES = 500 * 1024 * 1024;
const BASEMAP_DIRECTORY = path.join('.geogestor', 'basemaps');

function safeJson<T>(value: string | null, fallback: T): T {
  try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function summary(row: typeof schema.mapasBaseOffline.$inferSelect): OfflineBasemapSummary {
  return {
    kind: 'offline-basemap',
    id: row.id,
    name: row.nome,
    format: row.formato,
    minZoom: row.minZoom,
    maxZoom: row.maxZoom,
    bounds: safeJson(row.boundsJson, null),
    attribution: row.atribuicao,
    sizeBytes: row.tamanhoBytes,
    active: row.ativo
  };
}

export async function inspectMbtiles(filePath: string) {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_MBTILES_BYTES) throw new Error('O MBTiles excede o limite configurado de 500 MB.');
  const signature = Buffer.alloc(16);
  const handle = await fs.open(filePath, 'r');
  try { await handle.read(signature, 0, 16, 0); } finally { await handle.close(); }
  if (signature.toString('ascii') !== 'SQLite format 3\0') throw new Error('O arquivo não possui uma assinatura SQLite válida.');
  const client = createClient({ url: `file:${filePath}` });
  try {
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('metadata','tiles')");
    if (tables.rows.length !== 2) throw new Error('O arquivo não contém as tabelas obrigatórias metadata e tiles.');
    const metadataRows = await client.execute('SELECT name, value FROM metadata');
    const metadata = Object.fromEntries(metadataRows.rows.map((row) => [String(row.name), String(row.value ?? '')]));
    const zooms = await client.execute('SELECT MIN(zoom_level) AS min_zoom, MAX(zoom_level) AS max_zoom, COUNT(*) AS total FROM tiles');
    if (!Number(zooms.rows[0]?.total)) throw new Error('O MBTiles não contém tiles.');
    const format = String(metadata.format || 'png').toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(format)) throw new Error(`Formato de tile não suportado: ${format}.`);
    return {
      metadata,
      format,
      minZoom: Number(metadata.minzoom || zooms.rows[0]?.min_zoom || 0),
      maxZoom: Number(metadata.maxzoom || zooms.rows[0]?.max_zoom || 0),
      bounds: metadata.bounds?.split(',').map(Number).filter(Number.isFinite).length === 4 ? metadata.bounds.split(',').map(Number) : null,
      sizeBytes: stat.size
    };
  } finally {
    await client.close();
  }
}

export class MbtilesService {
  static async importFile(sourcePath: string, originalName: string, dataRoot: string) {
    const targetDirectory = path.join(dataRoot, BASEMAP_DIRECTORY);
    assertLexicalPathInsideRoot(targetDirectory, dataRoot);
    await fs.mkdir(targetDirectory, { recursive: true });
    const id = crypto.randomUUID();
    const targetPath = path.join(targetDirectory, `${id}.mbtiles`);
    assertLexicalPathInsideRoot(targetPath, dataRoot);
    await fs.copyFile(sourcePath, targetPath);
    try {
      await ensurePathInsideRoot(targetPath, dataRoot);
      const inspected = await inspectMbtiles(targetPath);
      const row = (await db.insert(schema.mapasBaseOffline).values({
        id,
        nome: inspected.metadata.name || path.parse(originalName).name,
        caminho: targetPath,
        formato: inspected.format,
        minZoom: inspected.minZoom,
        maxZoom: inspected.maxZoom,
        boundsJson: inspected.bounds ? JSON.stringify(inspected.bounds) : null,
        atribuicao: inspected.metadata.attribution || null,
        tamanhoBytes: inspected.sizeBytes,
        metadataJson: JSON.stringify(inspected.metadata)
      }).returning())[0];
      await GeospatialAuditService.record({
        type: GEOSPATIAL_AUDIT_EVENTS.mbtilesBasemapImported,
        description: 'Mapa-base MBTiles raster importado para uso exclusivo como fundo cartográfico offline.',
        data: { basemapId: id, name: row.nome, format: row.formato, sizeBytes: row.tamanhoBytes, minZoom: row.minZoom, maxZoom: row.maxZoom }
      });
      return summary(row);
    } catch (error) {
      await fs.unlink(targetPath).catch(() => undefined);
      throw error;
    }
  }

  static async list() {
    const rows = await db.select().from(schema.mapasBaseOffline)
      .where(isNull(schema.mapasBaseOffline.deletedAt));
    return rows.map(summary);
  }

  static async setActive(id: string, active: boolean, dataRoot: string) {
    const rows = await db.select().from(schema.mapasBaseOffline).where(and(eq(schema.mapasBaseOffline.id, id), isNull(schema.mapasBaseOffline.deletedAt))).limit(1);
    if (!rows.length) throw new Error('Mapa-base não encontrado.');
    await ensurePathInsideRoot(rows[0].caminho, dataRoot);
    if (active) await inspectMbtiles(rows[0].caminho);
    const updated = (await db.update(schema.mapasBaseOffline).set({ ativo: active, updatedAt: new Date().toISOString() })
      .where(eq(schema.mapasBaseOffline.id, id)).returning())[0];
    await GeospatialAuditService.record({
      type: active ? GEOSPATIAL_AUDIT_EVENTS.basemapActivated : GEOSPATIAL_AUDIT_EVENTS.basemapDeactivated,
      description: active ? 'Mapa-base MBTiles ativado.' : 'Mapa-base MBTiles desativado.',
      data: { basemapId: id, name: updated.nome }
    });
    return summary(updated);
  }

  static async tile(id: string, z: number, x: number, y: number, dataRoot: string) {
    if (![z, x, y].every(Number.isSafeInteger) || z < 0 || z > 24 || x < 0 || y < 0) throw new Error('Coordenadas de tile inválidas.');
    const rows = await db.select().from(schema.mapasBaseOffline)
      .where(and(eq(schema.mapasBaseOffline.id, id), eq(schema.mapasBaseOffline.ativo, true), isNull(schema.mapasBaseOffline.deletedAt))).limit(1);
    if (!rows.length) return null;
    await ensurePathInsideRoot(rows[0].caminho, dataRoot);
    const tmsY = (2 ** z - 1) - y;
    const client = createClient({ url: `file:${rows[0].caminho}` });
    try {
      const tile = await client.execute({
        sql: 'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? LIMIT 1',
        args: [z, x, tmsY]
      });
      const value = tile.rows[0]?.tile_data;
      return value instanceof Uint8Array ? { bytes: Buffer.from(value), format: rows[0].formato } : null;
    } finally { await client.close(); }
  }

  static async remove(id: string, dataRoot: string) {
    const rows = await db.select().from(schema.mapasBaseOffline).where(eq(schema.mapasBaseOffline.id, id)).limit(1);
    if (!rows.length) throw new Error('Mapa-base não encontrado.');
    await ensurePathInsideRoot(rows[0].caminho, dataRoot);
    await db.update(schema.mapasBaseOffline).set({ ativo: false, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(schema.mapasBaseOffline.id, id));
    await GeospatialAuditService.record({
      type: GEOSPATIAL_AUDIT_EVENTS.basemapRemoved,
      description: 'Mapa-base MBTiles removido; levantamentos, documentos e projetos foram preservados.',
      data: { basemapId: id, name: rows[0].nome, sizeBytes: rows[0].tamanhoBytes }
    });
    await fs.rm(rows[0].caminho, { force: true, maxRetries: 10, retryDelay: 100 }).catch(() => undefined);
    return { removed: true };
  }
}
