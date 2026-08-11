import type { Client } from '@libsql/client';
import { existsSync } from 'node:fs';

export const CLIENT_WORKSPACE_INTEGRITY_MIGRATION = {
  version: 9,
  name: 'client-workspace-integrity-2026-08-08'
} as const;

type ColumnRow = { name: string };

async function addColumn(client: Client, table: string, column: string, definition: string) {
  const tableResult = await client.execute({ sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, args: [table] });
  if (tableResult.rows.length === 0) return;
  const columns = await client.execute(`PRAGMA table_info(${table})`);
  if ((columns.rows as unknown as ColumnRow[]).some((item) => item.name === column)) return;
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function digits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function validCpf(value: unknown) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const digit = (length: number) => {
    const total = cpf.slice(0, length).split('').reduce((sum, number, index) => sum + Number(number) * (length + 1 - index), 0);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function validCnpj(value: unknown) {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calculate = (base: string, weights: number[]) => {
    const remainder = base.split('').reduce((sum, number, index) => sum + Number(number) * weights[index], 0) % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculate(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
}

const personCategories: Record<string, 'PF' | 'PJ'> = {
  'pessoa física': 'PF', 'pessoa fisica': 'PF',
  'pessoa jurídica': 'PJ', 'pessoa juridica': 'PJ'
};

export async function ensureClientWorkspaceIntegrity(client: Client) {
  await addColumn(client, 'propriedades', 'uf', 'TEXT');
  await addColumn(client, 'clientes', 'endereco_legado', 'TEXT');
  await addColumn(client, 'clientes', 'categoria_legada', 'TEXT');
  await addColumn(client, 'clientes', 'endereco_validacao', "TEXT DEFAULT 'nao_validado'");
  await addColumn(client, 'clientes', 'revisao_cadastral', 'INTEGER DEFAULT 0 NOT NULL');
  await addColumn(client, 'clientes', 'revisao_motivos', 'TEXT');

  const clients = await client.execute(`SELECT * FROM clientes WHERE deleted_at IS NULL`);
  const now = new Date().toISOString();
  for (const row of clients.rows) {
    const originalCategory = String(row.categoria || '').trim();
    const categoryParts = originalCategory.split(',').map((item) => item.trim()).filter(Boolean);
    const detectedPersonTypes = Array.from(new Set(categoryParts.map((item) => personCategories[item.toLocaleLowerCase('pt-BR')]).filter(Boolean)));
    const categoryPersonType = detectedPersonTypes.length === 1 ? detectedPersonTypes[0] : undefined;
    const relationshipCategories = categoryParts.filter((item) => !personCategories[item.toLocaleLowerCase('pt-BR')]);
    const currentPersonType = row.tipo_pessoa === 'PF' || row.tipo_pessoa === 'PJ' ? row.tipo_pessoa : null;
    const structuredAddress = Boolean(row.municipio && row.uf && (row.endereco || row.bairro));
    const reasons: string[] = [];
    let nextPersonType = currentPersonType;
    let nextCategory: string | null = originalCategory || null;

    if (detectedPersonTypes.length > 1) {
      reasons.push('categoria_tipo_pessoa_ambiguo');
    } else if (categoryPersonType) {
      if (!currentPersonType || currentPersonType === categoryPersonType) {
        nextPersonType = categoryPersonType;
        nextCategory = relationshipCategories.join(', ') || null;
      } else reasons.push('categoria_tipo_pessoa_ambiguo');
    }
    if (row.endereco && !structuredAddress) reasons.push('endereco_nao_estruturado');
    if (nextPersonType === 'PF' && !validCpf(row.cpf || row.documento)) reasons.push('cpf_invalido');
    if (nextPersonType === 'PJ' && !validCnpj(row.cnpj || row.documento)) reasons.push('cnpj_invalido');
    if (!nextPersonType) reasons.push('tipo_pessoa_ausente');

    await client.execute({
      sql: `UPDATE clientes SET tipo_pessoa = ?, categoria = ?,
        categoria_legada = CASE WHEN ? <> '' THEN coalesce(categoria_legada, ?) ELSE categoria_legada END,
        endereco_legado = CASE WHEN ? IS NOT NULL THEN coalesce(endereco_legado, ?) ELSE endereco_legado END,
        endereco_validacao = CASE WHEN ? = 1 THEN coalesce(endereco_validacao, 'nao_validado') ELSE 'requer_revisao' END,
        revisao_cadastral = ?, revisao_motivos = ?, updated_at = ? WHERE id = ?`,
      args: [nextPersonType, nextCategory, categoryPersonType ? originalCategory : '', originalCategory, row.endereco ?? null, row.endereco ?? null,
        structuredAddress ? 1 : 0, reasons.length ? 1 : 0, JSON.stringify(reasons), now, row.id]
    });
  }

  await client.execute({ sql: `UPDATE documentos SET status = 'excluido', updated_at = ? WHERE deleted_at IS NOT NULL AND status <> 'excluido'`, args: [now] });
  await client.execute(`UPDATE documentos SET deleted_at = coalesce(deleted_at, updated_at, CURRENT_TIMESTAMP) WHERE status = 'excluido'`);
  const activeDocuments = await client.execute(`SELECT id, caminho FROM documentos WHERE status = 'ativo' AND deleted_at IS NULL`);
  for (const document of activeDocuments.rows) {
    if (!document.caminho || !existsSync(String(document.caminho))) {
      await client.execute({ sql: `UPDATE documentos SET status = 'revisao', updated_at = ? WHERE id = ? AND status = 'ativo' AND deleted_at IS NULL`, args: [now, document.id] });
    }
  }
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_documentos_active_cliente ON documentos(cliente_id, updated_at DESC) WHERE status = 'ativo' AND deleted_at IS NULL`);
}
