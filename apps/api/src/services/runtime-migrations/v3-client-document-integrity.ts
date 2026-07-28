import type { Client } from '@libsql/client';

export const CLIENT_DOCUMENT_INTEGRITY_MIGRATION = {
  version: 3,
  name: 'client-document-integrity-2026-07-22'
} as const;

const normalizedSql = (column: string) => `replace(replace(replace(replace(replace(replace(
  coalesce(${column}, ''), '.', ''), '/', ''), '-', ''), ' ', ''), '(', ''), ')', '')`;

const selectedDocumentSql = `CASE
  WHEN length(${normalizedSql('cpf')}) = 11 THEN ${normalizedSql('cpf')}
  WHEN length(${normalizedSql('cnpj')}) = 14 THEN ${normalizedSql('cnpj')}
  WHEN length(${normalizedSql('documento')}) IN (11, 14) THEN ${normalizedSql('documento')}
  ELSE NULL
END`;

export async function ensureClientDocumentIntegrity(client: Client) {
  const columns = await client.execute('PRAGMA table_info(clientes)');
  if (!columns.rows.some((column) => String(column.name) === 'documento_normalizado')) {
    await client.execute('ALTER TABLE clientes ADD COLUMN documento_normalizado TEXT');
  }

  await client.execute(`UPDATE clientes SET documento_normalizado = ${selectedDocumentSql}`);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS cliente_documento_conflitos (
      documento_normalizado TEXT PRIMARY KEY,
      cliente_ids_json TEXT NOT NULL,
      quantidade INTEGER NOT NULL CHECK (quantidade > 1),
      detectado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      resolvido_em TEXT
    )
  `);
  await client.execute(`
    INSERT INTO cliente_documento_conflitos (
      documento_normalizado, cliente_ids_json, quantidade, detectado_em, resolvido_em
    )
    SELECT
      documento_normalizado,
      json_group_array(id),
      count(*),
      CURRENT_TIMESTAMP,
      NULL
    FROM clientes
    WHERE deleted_at IS NULL AND documento_normalizado IS NOT NULL
    GROUP BY documento_normalizado
    HAVING count(*) > 1
    ON CONFLICT(documento_normalizado) DO UPDATE SET
      cliente_ids_json = excluded.cliente_ids_json,
      quantidade = excluded.quantidade,
      detectado_em = excluded.detectado_em,
      resolvido_em = NULL
  `);
  await client.execute(`
    UPDATE cliente_documento_conflitos
    SET resolvido_em = CURRENT_TIMESTAMP
    WHERE resolvido_em IS NULL
      AND documento_normalizado NOT IN (
        SELECT documento_normalizado
        FROM clientes
        WHERE deleted_at IS NULL AND documento_normalizado IS NOT NULL
        GROUP BY documento_normalizado
        HAVING count(*) > 1
      )
  `);

  await client.execute('DROP TRIGGER IF EXISTS trg_clientes_documento_unique_insert');
  await client.execute('DROP TRIGGER IF EXISTS trg_clientes_documento_unique_update');
  await client.execute('DROP TRIGGER IF EXISTS trg_clientes_documento_normalize_insert');
  await client.execute('DROP TRIGGER IF EXISTS trg_clientes_documento_normalize_update');

  await client.execute(`
    CREATE TRIGGER trg_clientes_documento_unique_insert
    BEFORE INSERT ON clientes
    WHEN NEW.deleted_at IS NULL
      AND (${selectedDocumentSql.replaceAll(/\b(cpf|cnpj|documento)\b/g, 'NEW.$1')}) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM clientes
        WHERE deleted_at IS NULL
          AND documento_normalizado = (${selectedDocumentSql.replaceAll(/\b(cpf|cnpj|documento)\b/g, 'NEW.$1')})
      )
    BEGIN
      SELECT RAISE(ABORT, 'CLIENT_DOCUMENT_CONFLICT');
    END
  `);
  await client.execute(`
    CREATE TRIGGER trg_clientes_documento_unique_update
    BEFORE UPDATE OF cpf, cnpj, documento, deleted_at ON clientes
    WHEN NEW.deleted_at IS NULL
      AND (${selectedDocumentSql.replaceAll(/\b(cpf|cnpj|documento)\b/g, 'NEW.$1')}) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM clientes
        WHERE id <> OLD.id
          AND deleted_at IS NULL
          AND documento_normalizado = (${selectedDocumentSql.replaceAll(/\b(cpf|cnpj|documento)\b/g, 'NEW.$1')})
      )
    BEGIN
      SELECT RAISE(ABORT, 'CLIENT_DOCUMENT_CONFLICT');
    END
  `);
  await client.execute(`
    CREATE TRIGGER trg_clientes_documento_normalize_insert
    AFTER INSERT ON clientes
    BEGIN
      UPDATE clientes SET documento_normalizado = ${selectedDocumentSql} WHERE id = NEW.id;
    END
  `);
  await client.execute(`
    CREATE TRIGGER trg_clientes_documento_normalize_update
    AFTER UPDATE OF cpf, cnpj, documento ON clientes
    BEGIN
      UPDATE clientes SET documento_normalizado = ${selectedDocumentSql} WHERE id = NEW.id;
    END
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_clientes_documento_normalizado
    ON clientes(documento_normalizado) WHERE deleted_at IS NULL`);
}
