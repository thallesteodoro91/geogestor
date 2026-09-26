import crypto from 'node:crypto';
import type { Client } from '@libsql/client';
import { normalizePropertyIdentifier, normalizePropertyName } from '@geogestor/contracts/src/properties';

export const PROPERTY_INTEGRITY_MIGRATION = {
  version: 16,
  name: 'property-integrity-2026-09-15'
} as const;

type PropertyRow = {
  id: unknown;
  cliente_id: unknown;
  nome: unknown;
  matricula: unknown;
  car: unknown;
  ccir: unknown;
  itr: unknown;
};

async function hasColumn(client: Client, table: string, column: string) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

async function addColumn(client: Client, column: string) {
  if (!(await hasColumn(client, 'propriedades', column))) {
    await client.execute(`ALTER TABLE propriedades ADD COLUMN ${column} TEXT`);
  }
}

function conflictId(field: string, clientId: string | null, normalized: string) {
  return crypto.createHash('sha256').update(`${field}:${clientId || '*'}:${normalized}`).digest('hex');
}

export async function ensurePropertyIntegrity(client: Client) {
  const table = await client.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'propriedades' LIMIT 1");
  if (table.rows.length === 0) return;

  for (const column of ['nome_normalizado', 'matricula_normalizada', 'car_normalizado', 'ccir_normalizado', 'itr_normalizado']) {
    await addColumn(client, column);
  }
  await client.execute(`CREATE TABLE IF NOT EXISTS propriedade_integridade_conflitos (
    id TEXT PRIMARY KEY,
    campo TEXT NOT NULL,
    valor_normalizado TEXT NOT NULL,
    cliente_id TEXT,
    quantidade INTEGER NOT NULL,
    ids_json TEXT NOT NULL,
    detectado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    resolvido_em TEXT
  )`);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_propriedade_conflitos_campo ON propriedade_integridade_conflitos(campo, valor_normalizado)');

  const rows = (await client.execute(`SELECT id, cliente_id, nome, matricula, car, ccir, itr
    FROM propriedades WHERE deleted_at IS NULL ORDER BY created_at, id`)).rows as unknown as PropertyRow[];
  const normalizedRows = rows.map((row) => ({
    id: String(row.id),
    clientId: String(row.cliente_id),
    name: normalizePropertyName(String(row.nome || '')),
    matricula: normalizePropertyIdentifier(row.matricula == null ? null : String(row.matricula)),
    car: normalizePropertyIdentifier(row.car == null ? null : String(row.car)),
    ccir: normalizePropertyIdentifier(row.ccir == null ? null : String(row.ccir)),
    itr: normalizePropertyIdentifier(row.itr == null ? null : String(row.itr))
  }));
  const fields = [
    { field: 'nome', column: 'name', scoped: true },
    { field: 'matricula', column: 'matricula', scoped: false },
    { field: 'car', column: 'car', scoped: false },
    { field: 'ccir', column: 'ccir', scoped: false },
    { field: 'itr', column: 'itr', scoped: false }
  ] as const;
  const conflicts = new Map<string, { field: string; value: string; clientId: string | null; ids: string[] }>();
  const duplicateFields = new Map<string, Set<string>>();

  for (const descriptor of fields) {
    const groups = new Map<string, string[]>();
    for (const row of normalizedRows) {
      const value = row[descriptor.column];
      if (!value) continue;
      const key = descriptor.scoped ? `${row.clientId}:${value}` : value;
      const ids = groups.get(key) || [];
      ids.push(row.id);
      groups.set(key, ids);
    }
    for (const [key, ids] of groups) {
      if (ids.length < 2) continue;
      const value = descriptor.scoped ? key.slice(key.indexOf(':') + 1) : key;
      const clientId = descriptor.scoped ? key.slice(0, key.indexOf(':')) : null;
      conflicts.set(`${descriptor.field}:${key}`, { field: descriptor.field, value, clientId, ids });
      for (const duplicateId of ids.slice(1)) {
        const current = duplicateFields.get(duplicateId) || new Set<string>();
        current.add(descriptor.field);
        duplicateFields.set(duplicateId, current);
      }
    }
  }

  for (const row of normalizedRows) {
    const duplicate = duplicateFields.get(row.id);
    await client.execute({
      sql: `UPDATE propriedades SET nome_normalizado = ?, matricula_normalizada = ?, car_normalizado = ?, ccir_normalizado = ?, itr_normalizado = ? WHERE id = ?`,
      args: [
        duplicate?.has('nome') ? null : row.name,
        duplicate?.has('matricula') ? null : row.matricula || null,
        duplicate?.has('car') ? null : row.car || null,
        duplicate?.has('ccir') ? null : row.ccir || null,
        duplicate?.has('itr') ? null : row.itr || null,
        row.id
      ]
    });
  }

  for (const conflict of conflicts.values()) {
    await client.execute({
      sql: `INSERT INTO propriedade_integridade_conflitos
        (id, campo, valor_normalizado, cliente_id, quantidade, ids_json, resolvido_em)
        VALUES (?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(id) DO UPDATE SET quantidade = excluded.quantidade, ids_json = excluded.ids_json, resolvido_em = NULL`,
      args: [conflictId(conflict.field, conflict.clientId, conflict.value), conflict.field, conflict.value, conflict.clientId, conflict.ids.length, JSON.stringify(conflict.ids)]
    });
  }

  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS uq_propriedades_active_cliente_nome_normalizado
    ON propriedades(cliente_id, nome_normalizado) WHERE deleted_at IS NULL AND nome_normalizado IS NOT NULL`);
  for (const [field, column] of [
    ['matricula', 'matricula_normalizada'],
    ['car', 'car_normalizado'],
    ['ccir', 'ccir_normalizado'],
    ['itr', 'itr_normalizado']
  ] as const) {
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS uq_propriedades_active_${field}_normalizado
      ON propriedades(${column}) WHERE deleted_at IS NULL AND ${column} IS NOT NULL`);
  }
  await client.execute('CREATE INDEX IF NOT EXISTS idx_propriedades_active_nome_id ON propriedades(nome COLLATE NOCASE, id) WHERE deleted_at IS NULL');
}
