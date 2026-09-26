import type { Client } from '@libsql/client';

export const MULTIPROCESS_FINANCE_INTEGRITY_MIGRATION = {
  version: 17,
  name: 'multiprocess-finance-integrity-2026-09-19'
} as const;

export async function ensureMultiprocessFinanceIntegrity(client: Client) {
  const tables = await client.execute(`SELECT name FROM sqlite_master
    WHERE type = 'table' AND name IN ('parcelas', 'recebimentos')`);
  if (tables.rows.length !== 2) return;

  await client.execute(`CREATE TRIGGER IF NOT EXISTS trg_recebimentos_principal_limit_insert
    BEFORE INSERT ON recebimentos
    WHEN NEW.deleted_at IS NULL
      AND NEW.estornado_em IS NULL
      AND (
        COALESCE((
          SELECT SUM(r.valor_principal)
          FROM recebimentos r
          WHERE r.parcela_id = NEW.parcela_id
            AND r.deleted_at IS NULL
            AND r.estornado_em IS NULL
        ), 0) + NEW.valor_principal
      ) > COALESCE((SELECT p.valor FROM parcelas p WHERE p.id = NEW.parcela_id), -1)
    BEGIN
      SELECT RAISE(ABORT, 'recebimento_excede_principal');
    END`);
}
