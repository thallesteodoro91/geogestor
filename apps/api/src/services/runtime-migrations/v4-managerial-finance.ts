import type { Client } from '@libsql/client';

export const MANAGERIAL_FINANCE_MIGRATION = {
  version: 4,
  name: 'managerial-finance-2026-07-25'
} as const;

async function hasColumn(client: Client, table: string, column: string) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((item) => String(item.name) === column);
}

async function addColumn(client: Client, table: string, column: string, definition: string) {
  if (await hasColumn(client, table, column)) return;
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export async function ensureManagerialFinance(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS viagens (
      id TEXT PRIMARY KEY,
      cliente_id TEXT,
      projeto_id TEXT,
      finalidade TEXT NOT NULL,
      destino TEXT NOT NULL,
      data_inicio TEXT NOT NULL,
      data_fim TEXT,
      responsavel TEXT,
      adiantamento INTEGER DEFAULT 0 NOT NULL,
      quilometragem REAL DEFAULT 0 NOT NULL,
      valor_reembolsavel INTEGER DEFAULT 0 NOT NULL,
      status TEXT DEFAULT 'planejada' NOT NULL,
      observacoes TEXT,
      encerrada_em TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (projeto_id) REFERENCES projetos(id)
    )
  `);

  await addColumn(client, 'despesas', 'viagem_id', 'TEXT REFERENCES viagens(id)');
  await addColumn(client, 'despesas', 'categoria_codigo', "TEXT DEFAULT 'outros'");
  await addColumn(client, 'despesas', 'cancelada_em', 'TEXT');
  await addColumn(client, 'despesas', 'motivo_cancelamento', 'TEXT');
  await addColumn(client, 'despesas', 'estornada_em', 'TEXT');
  await addColumn(client, 'despesas', 'motivo_estorno', 'TEXT');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS recebimentos (
      id TEXT PRIMARY KEY,
      parcela_id TEXT NOT NULL,
      valor_principal INTEGER NOT NULL CHECK (valor_principal > 0),
      juros INTEGER DEFAULT 0 NOT NULL CHECK (juros >= 0),
      multa INTEGER DEFAULT 0 NOT NULL CHECK (multa >= 0),
      desconto INTEGER DEFAULT 0 NOT NULL CHECK (desconto >= 0),
      taxas INTEGER DEFAULT 0 NOT NULL CHECK (taxas >= 0),
      valor_recebido INTEGER NOT NULL CHECK (valor_recebido > 0),
      data_recebimento TEXT NOT NULL,
      meio_pagamento TEXT,
      observacoes TEXT,
      comprovante_documento_id TEXT,
      estornado_em TEXT,
      motivo_estorno TEXT,
      usuario_id TEXT DEFAULT 'admin' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (parcela_id) REFERENCES parcelas(id),
      FOREIGN KEY (comprovante_documento_id) REFERENCES documentos(id)
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS despesa_documentos (
      id TEXT PRIMARY KEY,
      despesa_id TEXT NOT NULL,
      documento_id TEXT NOT NULL,
      tipo TEXT DEFAULT 'comprovante' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (despesa_id) REFERENCES despesas(id) ON DELETE CASCADE,
      FOREIGN KEY (documento_id) REFERENCES documentos(id),
      UNIQUE (despesa_id, documento_id)
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS notas_fiscais (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      projeto_id TEXT,
      orcamento_id TEXT,
      documento_id TEXT,
      numero TEXT NOT NULL,
      codigo_verificacao TEXT,
      data_emissao TEXT NOT NULL,
      valor INTEGER NOT NULL CHECK (valor > 0),
      status TEXT DEFAULT 'emitida' NOT NULL,
      municipio TEXT,
      link TEXT,
      substitui_nota_id TEXT,
      cancelada_em TEXT,
      motivo_cancelamento TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (projeto_id) REFERENCES projetos(id),
      FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id),
      FOREIGN KEY (documento_id) REFERENCES documentos(id)
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS financeiro_eventos (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      entidade TEXT NOT NULL,
      entidade_id TEXT NOT NULL,
      cliente_id TEXT,
      projeto_id TEXT,
      valor INTEGER DEFAULT 0 NOT NULL,
      data_evento TEXT NOT NULL,
      motivo TEXT,
      metadata_json TEXT,
      usuario_id TEXT DEFAULT 'admin' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (projeto_id) REFERENCES projetos(id)
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS projeto_financeiro_decisoes (
      id TEXT PRIMARY KEY,
      projeto_id TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      percentual_executado REAL,
      valor_executado INTEGER,
      cancelar_parcelas_futuras INTEGER DEFAULT 0 NOT NULL,
      motivo TEXT NOT NULL,
      usuario_id TEXT DEFAULT 'admin' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (projeto_id) REFERENCES projetos(id),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    )
  `);

  await client.execute(`
    UPDATE despesas
    SET categoria_codigo = CASE
      WHEN lower(categoria) LIKE '%combust%' THEN 'combustivel'
      WHEN lower(categoria) LIKE '%pedag%' THEN 'pedagio'
      WHEN lower(categoria) LIKE '%hosped%' THEN 'hospedagem'
      WHEN lower(categoria) LIKE '%alimenta%' THEN 'alimentacao'
      WHEN lower(categoria) LIKE '%viagem%' OR lower(categoria) LIKE '%transport%' THEN 'viagem_transporte'
      WHEN lower(categoria) LIKE '%cart%' OR lower(categoria) LIKE '%emolumento%' THEN 'cartorio_taxas'
      WHEN lower(categoria) LIKE '%tribut%' OR lower(categoria) LIKE '%imposto%' THEN 'tributos'
      WHEN lower(categoria) LIKE '%equip%' THEN 'equipamentos'
      WHEN lower(categoria) LIKE '%software%' OR lower(categoria) LIKE '%licen%' THEN 'software_licencas'
      ELSE 'outros'
    END
    WHERE categoria_codigo IS NULL OR categoria_codigo = '' OR categoria_codigo = 'outros'
  `);

  await client.execute(`
    INSERT INTO recebimentos (
      id, parcela_id, valor_principal, valor_recebido, data_recebimento,
      meio_pagamento, observacoes, usuario_id
    )
    SELECT
      lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
      substr(lower(hex(randomblob(2))), 2) || '-' ||
      substr('89ab', abs(random()) % 4 + 1, 1) ||
      substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))),
      p.id, coalesce(nullif(p.valor_pago, 0), p.valor),
      coalesce(nullif(p.valor_pago, 0), p.valor),
      coalesce(p.data_pagamento, p.data_vencimento), p.meio_pagamento,
      'Recebimento migrado do histórico anterior', 'migration'
    FROM parcelas p
    WHERE lower(p.status_pagamento) = 'pago'
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM recebimentos r
        WHERE r.parcela_id = p.id AND r.deleted_at IS NULL
      )
  `);

  await client.execute('CREATE INDEX IF NOT EXISTS idx_recebimentos_parcela_id ON recebimentos(parcela_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_recebimentos_data ON recebimentos(data_recebimento)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_viagens_cliente_id ON viagens(cliente_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_viagens_projeto_id ON viagens(projeto_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_despesas_viagem_id ON despesas(viagem_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_financeiro_eventos_entidade ON financeiro_eventos(entidade, entidade_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_notas_fiscais_cliente ON notas_fiscais(cliente_id)');
}
