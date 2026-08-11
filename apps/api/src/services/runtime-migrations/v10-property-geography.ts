import type { Client } from '@libsql/client';

export const PROPERTY_GEOGRAPHY_MIGRATION = {
  version: 10,
  name: 'property-geography-2026-08-09'
} as const;

export async function ensurePropertyGeography(client: Client) {
  const table = await client.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'propriedades' LIMIT 1");
  if (table.rows.length === 0) return;
  const columns = await client.execute('PRAGMA table_info(propriedades)');
  if (!columns.rows.some((column) => column.name === 'uf')) {
    await client.execute('ALTER TABLE propriedades ADD COLUMN uf TEXT');
  }
}
