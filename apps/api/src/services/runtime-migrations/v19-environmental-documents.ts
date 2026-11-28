import type { Client } from '@libsql/client';
export const ENVIRONMENTAL_DOCUMENTS_MIGRATION = { version: 19, name: 'environmental-document-issues-2026-10-12' } as const;
export async function ensureEnvironmentalDocuments(client: Client) {
  await client.execute(`CREATE TABLE IF NOT EXISTS ambiental_documentos_emitidos (
    id TEXT PRIMARY KEY NOT NULL, projeto_id TEXT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    grupo_id TEXT NOT NULL, codigo TEXT NOT NULL, revisao INTEGER NOT NULL CHECK(revisao > 0),
    request_id TEXT NOT NULL UNIQUE, request_hash TEXT NOT NULL, emitido_em TEXT NOT NULL,
    nome_arquivo TEXT NOT NULL, snapshot_json TEXT NOT NULL, pdf_base64 TEXT NOT NULL, sha256 TEXT NOT NULL,
    UNIQUE(grupo_id, revisao), UNIQUE(codigo, revisao)
  )`);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_ambiental_documentos_projeto ON ambiental_documentos_emitidos(projeto_id, emitido_em)');
  await client.execute(`CREATE TRIGGER IF NOT EXISTS trg_ambiental_documentos_immutable BEFORE UPDATE ON ambiental_documentos_emitidos
    BEGIN SELECT RAISE(ABORT, 'emissao_ambiental_imutavel'); END`);
}
