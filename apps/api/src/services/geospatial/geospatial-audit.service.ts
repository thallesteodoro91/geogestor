import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { schema } from '@geogestor/database';

export const GEOSPATIAL_AUDIT_EVENTS = {
  vectorSurveyImported: 'levantamento_vetorial_importado',
  mbtilesBasemapImported: 'mapa_base_mbtiles_importado',
  basemapActivated: 'mapa_base_ativado',
  basemapDeactivated: 'mapa_base_desativado',
  basemapRemoved: 'mapa_base_removido',
  rasterContentIgnored: 'conteudo_raster_ignorado'
} as const;

export class GeospatialAuditService {
  static async record(input: {
    layerId?: string | null;
    documentId?: string | null;
    projectId?: string | null;
    type: string;
    description: string;
    data?: Record<string, unknown> | null;
  }) {
    const rows = await db.insert(schema.eventosGeoespaciais).values({
      id: crypto.randomUUID(),
      camadaId: input.layerId || null,
      documentoId: input.documentId || null,
      projetoId: input.projectId || null,
      tipo: input.type,
      descricao: input.description,
      dadosJson: input.data ? JSON.stringify(input.data) : null
    }).returning();
    return rows[0];
  }

  static async listForLayer(layerId: string) {
    const rows = await db.select().from(schema.eventosGeoespaciais)
      .where(eq(schema.eventosGeoespaciais.camadaId, layerId))
      .orderBy(desc(schema.eventosGeoespaciais.createdAt));
    return rows.map((row) => {
      const data = row.dadosJson ? JSON.parse(row.dadosJson) as Record<string, unknown> : null;
      if (data) delete data.backupPath;
      return {
        id: row.id,
        layerId: row.camadaId,
        documentId: row.documentoId,
        projectId: row.projetoId,
        type: row.tipo,
        description: row.descricao,
        data,
        createdAt: row.createdAt
      };
    });
  }

  static async listForBasemap(basemapId: string) {
    const rows = await db.select().from(schema.eventosGeoespaciais)
      .orderBy(desc(schema.eventosGeoespaciais.createdAt));
    return rows.flatMap((row) => {
      const data = row.dadosJson ? JSON.parse(row.dadosJson) as Record<string, unknown> : null;
      if (data?.basemapId !== basemapId) return [];
      return [{ id: row.id, type: row.tipo, description: row.descricao, data, createdAt: row.createdAt }];
    });
  }
}
