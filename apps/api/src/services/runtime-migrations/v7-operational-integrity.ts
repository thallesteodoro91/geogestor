import type { Client } from '@libsql/client';
import crypto from 'node:crypto';

export const OPERATIONAL_INTEGRITY_MIGRATION = {
  version: 7,
  name: 'operational-integrity-2026-08-01'
} as const;

function legacyPropertyId(projectId: string) {
  const hash = crypto.createHash('sha256').update('geogestor:legacy-property:' + projectId).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function migrateLegacyProjectProperties(client: Client) {
  const candidates = await client.execute(`
    SELECT id, cliente_id, nome, area_ha, matricula, car, ccir, itr, municipio, cidade,
      latitude, longitude, situacao_imovel, observacoes
    FROM projetos
    WHERE deleted_at IS NULL
      AND propriedade_id IS NULL
      AND (
        area_ha IS NOT NULL OR coalesce(matricula, '') <> '' OR coalesce(car, '') <> ''
        OR coalesce(ccir, '') <> '' OR coalesce(itr, '') <> '' OR coalesce(municipio, '') <> ''
        OR latitude IS NOT NULL OR longitude IS NOT NULL
      )
  `);
  for (const row of candidates.rows) {
    const projectId = String(row.id);
    const clientId = String(row.cliente_id);
    let propertyId = legacyPropertyId(projectId);
    if (row.matricula) {
      const existing = await client.execute({
        sql: `SELECT id FROM propriedades
          WHERE cliente_id = ? AND deleted_at IS NULL AND lower(trim(matricula)) = lower(trim(?))
          LIMIT 1`,
        args: [clientId, String(row.matricula)]
      });
      if (existing.rows[0]?.id) propertyId = String(existing.rows[0].id);
    }
    await client.execute({
      sql: `INSERT OR IGNORE INTO propriedades (
        id, cliente_id, nome, area_ha, matricula, car, ccir, itr, municipio, cidade,
        latitude, longitude, situacao_imovel, observacoes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        propertyId,
        clientId,
        String(row.nome || 'Imóvel migrado'),
        row.area_ha,
        row.matricula,
        row.car,
        row.ccir,
        row.itr,
        row.municipio,
        row.cidade,
        row.latitude,
        row.longitude,
        row.situacao_imovel,
        row.observacoes
      ]
    });
    await client.execute({
      sql: 'UPDATE projetos SET propriedade_id = ? WHERE id = ? AND propriedade_id IS NULL',
      args: [propertyId, projectId]
    });
  }
  await client.execute(`
    UPDATE orcamentos
    SET propriedade_id = (
      SELECT p.propriedade_id FROM projetos p
      WHERE p.id = orcamentos.projeto_id AND p.cliente_id = orcamentos.cliente_id
    )
    WHERE propriedade_id IS NULL
      AND projeto_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM projetos p
        WHERE p.id = orcamentos.projeto_id
          AND p.cliente_id = orcamentos.cliente_id
          AND p.propriedade_id IS NOT NULL
      )
  `);
}

export async function ensureOperationalIntegrity(client: Client) {
  await migrateLegacyProjectProperties(client);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS configuracoes_operacionais (
      id TEXT PRIMARY KEY,
      chave TEXT NOT NULL UNIQUE,
      valor_json TEXT NOT NULL,
      origem TEXT DEFAULT 'aplicacao' NOT NULL,
      migrado_em TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_configuracoes_operacionais_chave ON configuracoes_operacionais(chave)');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS calculos_salvos (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      nome TEXT NOT NULL,
      cliente_id TEXT REFERENCES clientes(id),
      projeto_id TEXT REFERENCES projetos(id),
      data_calculo TEXT NOT NULL,
      entradas_json TEXT NOT NULL,
      resultado_json TEXT NOT NULL,
      unidade TEXT,
      metodo TEXT,
      observacoes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_calculos_salvos_tipo_data ON calculos_salvos(tipo, data_calculo)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_calculos_salvos_cliente ON calculos_salvos(cliente_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_calculos_salvos_projeto ON calculos_salvos(projeto_id)');

  const triggers = [
    `CREATE TRIGGER IF NOT EXISTS trg_projetos_propriedade_cliente_insert
      BEFORE INSERT ON projetos WHEN NEW.propriedade_id IS NOT NULL
      BEGIN
        SELECT CASE WHEN NOT EXISTS (
          SELECT 1 FROM propriedades p WHERE p.id = NEW.propriedade_id AND p.cliente_id = NEW.cliente_id AND p.deleted_at IS NULL
        ) THEN RAISE(ABORT, 'propriedade_cliente_incompativel') END;
      END`,
    `CREATE TRIGGER IF NOT EXISTS trg_projetos_propriedade_cliente_update
      BEFORE UPDATE OF cliente_id, propriedade_id ON projetos WHEN NEW.propriedade_id IS NOT NULL
      BEGIN
        SELECT CASE WHEN NOT EXISTS (
          SELECT 1 FROM propriedades p WHERE p.id = NEW.propriedade_id AND p.cliente_id = NEW.cliente_id AND p.deleted_at IS NULL
        ) THEN RAISE(ABORT, 'propriedade_cliente_incompativel') END;
      END`,
    `CREATE TRIGGER IF NOT EXISTS trg_orcamentos_vinculos_insert
      BEFORE INSERT ON orcamentos
      BEGIN
        SELECT CASE WHEN NEW.projeto_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM projetos p WHERE p.id = NEW.projeto_id AND p.cliente_id = NEW.cliente_id AND p.deleted_at IS NULL
        ) THEN RAISE(ABORT, 'projeto_cliente_incompativel') END;
        SELECT CASE WHEN NEW.propriedade_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM propriedades p WHERE p.id = NEW.propriedade_id AND p.cliente_id = NEW.cliente_id AND p.deleted_at IS NULL
        ) THEN RAISE(ABORT, 'propriedade_cliente_incompativel') END;
      END`,
    `CREATE TRIGGER IF NOT EXISTS trg_orcamentos_vinculos_update
      BEFORE UPDATE OF cliente_id, projeto_id, propriedade_id ON orcamentos
      BEGIN
        SELECT CASE WHEN NEW.projeto_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM projetos p WHERE p.id = NEW.projeto_id AND p.cliente_id = NEW.cliente_id AND p.deleted_at IS NULL
        ) THEN RAISE(ABORT, 'projeto_cliente_incompativel') END;
        SELECT CASE WHEN NEW.propriedade_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM propriedades p WHERE p.id = NEW.propriedade_id AND p.cliente_id = NEW.cliente_id AND p.deleted_at IS NULL
        ) THEN RAISE(ABORT, 'propriedade_cliente_incompativel') END;
      END`
  ];
  for (const statement of triggers) await client.execute(statement);
}
