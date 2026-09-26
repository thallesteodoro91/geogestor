import type { Client } from '@libsql/client';

export const FINANCIAL_PERFORMANCE_MIGRATION = {
  version: 14,
  name: 'financial-performance-2026-08-28'
} as const;

/** Idempotent indexes for the bounded list queries introduced in schema v14. */
export async function ensureFinancialPerformance(client: Client) {
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_despesas_active_data_created
    ON despesas(data DESC, created_at DESC)
    WHERE deleted_at IS NULL`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_orcamentos_active_created
    ON orcamentos(created_at DESC)
    WHERE deleted_at IS NULL`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_projetos_active_updated
    ON projetos(updated_at DESC, id)
    WHERE deleted_at IS NULL`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_projetos_active_deadline
    ON projetos(data_entrega, id)
    WHERE deleted_at IS NULL`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_projetos_active_name
    ON projetos(nome COLLATE NOCASE, id)
    WHERE deleted_at IS NULL`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_projetos_active_type
    ON projetos(tipo, id)
    WHERE deleted_at IS NULL`);
}
