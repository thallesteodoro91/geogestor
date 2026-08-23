import type { Client } from '@libsql/client';

export const GEOSPATIAL_POLISH_MIGRATION = {
  version: 13,
  name: 'geospatial-polish-2026-08-13'
} as const;

async function addColumn(client: Client, table: string, column: string, definition: string) {
  const columns = await client.execute(`PRAGMA table_info(${table})`);
  if (columns.rows.some((item) => String(item.name) === column)) return;
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export async function ensureGeospatialPolish(client: Client) {
  const columns: Array<[string, string]> = [
    ['quantidade_vertices', 'INTEGER NOT NULL DEFAULT 0'],
    ['caminho_cache_visualizacao', 'TEXT'],
    ['tamanho_cache_bytes', 'INTEGER NOT NULL DEFAULT 0'],
    ['tamanho_visualizacao_bytes', 'INTEGER NOT NULL DEFAULT 0'],
    ['src_origem_deteccao', 'TEXT'],
    ['confianca_src', 'TEXT'],
    ['ordem_eixos', "TEXT NOT NULL DEFAULT 'longitude-latitude'"],
    ['problemas_topologia_json', 'TEXT'],
    ['reparos_json', 'TEXT'],
    ['relatorio_json', 'TEXT'],
    ['etapa_processamento', "TEXT NOT NULL DEFAULT 'concluido'"],
    ['progresso_processamento', 'INTEGER NOT NULL DEFAULT 100'],
    ['cancelamento_solicitado', 'INTEGER NOT NULL DEFAULT 0'],
    ['metodo_ponto_representativo', 'TEXT'],
    ['simplificada_visualizacao', 'INTEGER NOT NULL DEFAULT 0']
  ];
  for (const [column, definition] of columns) await addColumn(client, 'camadas_geoespaciais', column, definition);

  await client.execute(`CREATE TABLE IF NOT EXISTS eventos_geoespaciais (
    id TEXT PRIMARY KEY,
    camada_id TEXT REFERENCES camadas_geoespaciais(id) ON DELETE SET NULL,
    documento_id TEXT REFERENCES documentos(id) ON DELETE SET NULL,
    projeto_id TEXT REFERENCES projetos(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    dados_json TEXT,
    usuario_id TEXT NOT NULL DEFAULT 'admin',
    desfeito_em TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_eventos_geoespaciais_camada ON eventos_geoespaciais(camada_id, created_at DESC)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_eventos_geoespaciais_projeto ON eventos_geoespaciais(projeto_id, created_at DESC)');

  await client.execute(`CREATE TABLE IF NOT EXISTS mapas_base_offline (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    caminho TEXT NOT NULL UNIQUE,
    formato TEXT NOT NULL,
    min_zoom INTEGER,
    max_zoom INTEGER,
    bounds_json TEXT,
    atribuicao TEXT,
    tamanho_bytes INTEGER NOT NULL DEFAULT 0,
    ativo INTEGER NOT NULL DEFAULT 1,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  )`);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_mapas_base_offline_ativo ON mapas_base_offline(ativo, deleted_at)');
}
