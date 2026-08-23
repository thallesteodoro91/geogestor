import type { Client } from '@libsql/client';

export const GEOSPATIAL_LAYERS_MIGRATION = {
  version: 12,
  name: 'geospatial-layers-2026-08-13'
} as const;

export async function ensureGeospatialLayers(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS camadas_geoespaciais (
    id TEXT PRIMARY KEY,
    documento_id TEXT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    projeto_id TEXT REFERENCES projetos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    camada_origem TEXT,
    formato TEXT NOT NULL,
    src_original TEXT,
    epsg_original INTEGER,
    epsg_destino INTEGER NOT NULL DEFAULT 4326,
    status TEXT NOT NULL,
    quantidade_feicoes INTEGER NOT NULL DEFAULT 0,
    tipos_geometria_json TEXT,
    bbox_json TEXT,
    latitude_representativa REAL,
    longitude_representativa REAL,
    area_m2 REAL,
    perimetro_m REAL,
    avisos_json TEXT,
    mensagem_erro TEXT,
    caminho_cache TEXT,
    hash_original TEXT,
    visivel INTEGER NOT NULL DEFAULT 1,
    cor TEXT NOT NULL DEFAULT '#7c3aed',
    opacidade REAL NOT NULL DEFAULT 0.75,
    importado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  )`);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_camadas_geoespaciais_documento ON camadas_geoespaciais(documento_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_camadas_geoespaciais_cliente ON camadas_geoespaciais(cliente_id, status)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_camadas_geoespaciais_projeto ON camadas_geoespaciais(projeto_id, status)');
}
