import type { Client } from '@libsql/client';
import crypto from 'crypto';

type ColumnInfo = {
  name: string;
  notnull?: number | boolean;
};

async function getColumns(client: Client, table: string) {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows as unknown as ColumnInfo[];
}

async function hasColumn(client: Client, table: string, column: string) {
  const columns = await getColumns(client, table);
  return columns.some((item) => item.name === column);
}

async function addColumnIfMissing(client: Client, table: string, column: string, definition: string) {
  if (await hasColumn(client, table, column)) return;
  await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export async function addColumnIfTableExists(client: Client, table: string, column: string, definition: string) {
  if (!(await hasTable(client, table))) return;
  await addColumnIfMissing(client, table, column, definition);
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

async function hasTable(client: Client, table: string) {
  const result = await client.execute(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name = '${escapeSql(table)}'
    LIMIT 1
  `);
  return result.rows.length > 0;
}

export async function ensureDocumentoCategorias(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS documento_categorias (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      pasta_nome TEXT NOT NULL,
      icone TEXT DEFAULT 'FolderSimple' NOT NULL,
      cor TEXT DEFAULT 'zinc' NOT NULL,
      ordem INTEGER DEFAULT 0 NOT NULL,
      ativo INTEGER DEFAULT 1 NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  const defaults = [
    { nome: 'Contratos', pastaNome: 'Contratos', icone: 'FileText', cor: 'indigo', ordem: 10 },
    { nome: 'Documentos', pastaNome: 'Documentos', icone: 'FilePdf', cor: 'zinc', ordem: 20 },
    { nome: 'Mapas', pastaNome: 'Mapas', icone: 'MapTrifold', cor: 'emerald', ordem: 30 },
    { nome: 'Fotos', pastaNome: 'Fotos', icone: 'ImageSquare', cor: 'sky', ordem: 40 },
    { nome: 'Orçamentos', pastaNome: 'Orçamentos', icone: 'Receipt', cor: 'violet', ordem: 50 },
    { nome: 'Licenças', pastaNome: 'Licenças', icone: 'Check', cor: 'amber', ordem: 60 },
    { nome: 'Outros', pastaNome: 'Outros', icone: 'FolderSimple', cor: 'zinc', ordem: 999 }
  ];

  for (const category of defaults) {
    const existing = await client.execute(`
      SELECT id FROM documento_categorias
      WHERE lower(nome) = lower('${escapeSql(category.nome)}')
      LIMIT 1
    `);

    if (existing.rows.length > 0) continue;

    await client.execute(`
      INSERT INTO documento_categorias (
        id,
        nome,
        pasta_nome,
        icone,
        cor,
        ordem,
        ativo
      ) VALUES (
        '${crypto.randomUUID()}',
        '${escapeSql(category.nome)}',
        '${escapeSql(category.pastaNome)}',
        '${escapeSql(category.icone)}',
        '${escapeSql(category.cor)}',
        ${category.ordem},
        1
      )
    `);
  }
}

export async function ensureDocumentos(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS documentos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      projeto_id TEXT,
      categoria_id TEXT,
      categoria TEXT DEFAULT 'Outros' NOT NULL,
      nome TEXT NOT NULL,
      nome_original TEXT,
      extensao TEXT NOT NULL,
      caminho TEXT NOT NULL,
      caminho_relativo TEXT,
      tamanho_bytes INTEGER DEFAULT 0 NOT NULL,
      mime_type TEXT,
      tags TEXT,
      origem TEXT DEFAULT 'upload' NOT NULL,
      status TEXT DEFAULT 'ativo' NOT NULL,
      criado_em_arquivo TEXT,
      modificado_em_arquivo TEXT,
      ultimo_sync_em TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (cliente_id) REFERENCES clientes (id),
      FOREIGN KEY (projeto_id) REFERENCES projetos (id),
      FOREIGN KEY (categoria_id) REFERENCES documento_categorias (id)
    )
  `);

  if (await hasTable(client, 'documentos')) {
    await addColumnIfMissing(client, 'documentos', 'categoria_id', 'TEXT');
    await addColumnIfMissing(client, 'documentos', 'categoria', "TEXT DEFAULT 'Outros'");
    await addColumnIfMissing(client, 'documentos', 'nome_original', 'TEXT');
    await addColumnIfMissing(client, 'documentos', 'caminho_relativo', 'TEXT');
    await addColumnIfMissing(client, 'documentos', 'mime_type', 'TEXT');
    await addColumnIfMissing(client, 'documentos', 'tags', 'TEXT');
    await addColumnIfMissing(client, 'documentos', 'origem', "TEXT DEFAULT 'upload'");
    await addColumnIfMissing(client, 'documentos', 'status', "TEXT DEFAULT 'ativo'");
    await addColumnIfMissing(client, 'documentos', 'criado_em_arquivo', 'TEXT');
    await addColumnIfMissing(client, 'documentos', 'modificado_em_arquivo', 'TEXT');
    await addColumnIfMissing(client, 'documentos', 'ultimo_sync_em', 'TEXT');
  }
}

export async function ensureAuditLogs(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      user_id TEXT DEFAULT 'admin' NOT NULL,
      old_data TEXT,
      new_data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
}

export async function ensureConfiguracoesSingleton(client: Client) {
  if (!(await hasTable(client, 'configuracoes'))) return;

  const result = await client.execute(`
    SELECT id
    FROM configuracoes
    ORDER BY setup_concluido DESC, updated_at DESC, created_at DESC
  `);

  if (result.rows.length <= 1) return;

  const keepId = String(result.rows[0].id);
  await client.execute(`
    DELETE FROM configuracoes
    WHERE id <> '${escapeSql(keepId)}'
  `);
}

export async function ensureTarefasShape(client: Client) {
  if (!(await hasTable(client, 'tarefas'))) return;

  await addColumnIfMissing(client, 'tarefas', 'cliente_id', 'TEXT');
  await addColumnIfMissing(client, 'tarefas', 'categoria', "TEXT DEFAULT 'Interno'");
  await addColumnIfMissing(client, 'tarefas', 'contexto_tipo', "TEXT DEFAULT 'projeto'");

  const columns = await getColumns(client, 'tarefas');
  const projetoId = columns.find((item) => item.name === 'projeto_id');

  if (!projetoId || Number(projetoId.notnull) === 0) return;

  await client.execute('DROP TABLE IF EXISTS tarefas_runtime_migration');
  await client.execute(`
    CREATE TABLE tarefas_runtime_migration (
      id TEXT PRIMARY KEY,
      cliente_id TEXT,
      projeto_id TEXT,
      titulo TEXT NOT NULL,
      descricao TEXT,
      status TEXT DEFAULT 'A Fazer' NOT NULL,
      prioridade TEXT DEFAULT 'Media' NOT NULL,
      categoria TEXT DEFAULT 'Interno',
      contexto_tipo TEXT DEFAULT 'projeto',
      data_limite TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      FOREIGN KEY (cliente_id) REFERENCES clientes (id),
      FOREIGN KEY (projeto_id) REFERENCES projetos (id)
    )
  `);
  await client.execute(`
    INSERT INTO tarefas_runtime_migration (
      id,
      cliente_id,
      projeto_id,
      titulo,
      descricao,
      status,
      prioridade,
      categoria,
      contexto_tipo,
      data_limite,
      created_at,
      updated_at
    )
    SELECT
      t.id,
      COALESCE(t.cliente_id, p.cliente_id),
      t.projeto_id,
      t.titulo,
      t.descricao,
      t.status,
      t.prioridade,
      COALESCE(t.categoria, 'Interno'),
      COALESCE(t.contexto_tipo, CASE WHEN t.projeto_id IS NULL THEN 'cliente' ELSE 'projeto' END),
      t.data_limite,
      t.created_at,
      t.updated_at
    FROM tarefas t
    LEFT JOIN projetos p ON p.id = t.projeto_id
  `);
  await client.execute('DROP TABLE tarefas');
  await client.execute('ALTER TABLE tarefas_runtime_migration RENAME TO tarefas');
}

export async function ensureContatos(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS contatos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT,
      telefone TEXT,
      empresa TEXT,
      cidade TEXT,
      observacoes TEXT,
      origem TEXT,
      status TEXT DEFAULT 'ativo' NOT NULL,
      cliente_convertido_id TEXT REFERENCES clientes(id),
      convertido_em TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await addColumnIfMissing(client, 'contatos', 'email', 'TEXT');
  await addColumnIfMissing(client, 'contatos', 'telefone', 'TEXT');
  await addColumnIfMissing(client, 'contatos', 'empresa', 'TEXT');
  await addColumnIfMissing(client, 'contatos', 'cidade', 'TEXT');
  await addColumnIfMissing(client, 'contatos', 'observacoes', 'TEXT');
  await addColumnIfMissing(client, 'contatos', 'origem', 'TEXT');
  await addColumnIfMissing(client, 'contatos', 'status', "TEXT DEFAULT 'ativo'");
  await addColumnIfMissing(client, 'contatos', 'cliente_convertido_id', 'TEXT REFERENCES clientes(id)');
  await addColumnIfMissing(client, 'contatos', 'convertido_em', 'TEXT');
  await addColumnIfMissing(client, 'contatos', 'created_at', 'TEXT');
  await addColumnIfMissing(client, 'contatos', 'updated_at', 'TEXT');
  await client.execute("UPDATE contatos SET status = COALESCE(status, 'ativo')");
  await client.execute('UPDATE contatos SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP)');
  await client.execute('UPDATE contatos SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_contatos_cliente_convertido_id ON contatos(cliente_convertido_id)');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_contatos_status ON contatos(status)');
}

export async function assertForeignKeyIntegrity(client: Client) {
  await client.execute('PRAGMA foreign_keys = ON;');
  const result = await client.execute('PRAGMA foreign_key_check;');
  if (result.rows.length === 0) return;

  const sample = result.rows.slice(0, 5).map((row) => (
    `${String(row.table)}[rowid=${String(row.rowid)}] → ${String(row.parent)}`
  )).join(', ');
  throw new Error(`A migração foi interrompida porque o banco possui vínculos inválidos (${result.rows.length} ocorrência(s)): ${sample}. Restaure um backup válido antes de iniciar o sistema.`);
}

export async function ensureProjectSpecializedTables(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS licencas (
      id TEXT PRIMARY KEY,
      projeto_id TEXT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
      cliente_id TEXT REFERENCES clientes(id),
      numero TEXT NOT NULL,
      protocolo TEXT,
      orgao TEXT NOT NULL,
      tipo_licenca TEXT,
      data_emissao TEXT,
      data_vencimento TEXT NOT NULL,
      status TEXT DEFAULT 'Válida' NOT NULL,
      observacoes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_licencas_projeto_id ON licencas(projeto_id);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_licencas_cliente_id ON licencas(cliente_id);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_licencas_status ON licencas(status);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_licencas_vencimento ON licencas(data_vencimento);');
  await client.execute(`
    UPDATE licencas
    SET status = CASE LOWER(TRIM(status))
      WHEN 'ativa' THEN 'Válida'
      WHEN 'valida' THEN 'Válida'
      WHEN 'em_analise' THEN 'Em análise'
      WHEN 'em analise' THEN 'Em análise'
      WHEN 'em renovacao' THEN 'Em renovação'
      ELSE status
    END
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS condicionantes_ambientais (
      id TEXT PRIMARY KEY,
      licenca_id TEXT NOT NULL REFERENCES licencas(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      descricao TEXT,
      data_limite TEXT,
      periodicidade TEXT,
      responsavel TEXT,
      status TEXT DEFAULT 'Pendente' NOT NULL,
      data_cumprimento TEXT,
      observacoes TEXT,
      comprovante TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_condicionantes_licenca_id ON condicionantes_ambientais(licenca_id);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_condicionantes_status ON condicionantes_ambientais(status);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_condicionantes_data_limite ON condicionantes_ambientais(data_limite);');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS ambiental (
      id TEXT PRIMARY KEY,
      projeto_id TEXT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
      cliente_id TEXT REFERENCES clientes(id),
      propriedade_id TEXT REFERENCES propriedades(id),
      orgao_ambiental TEXT,
      tipo_demanda TEXT,
      protocolo TEXT,
      status_fase TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_ambiental_projeto_id ON ambiental(projeto_id);');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS pericias (
      id TEXT PRIMARY KEY,
      projeto_id TEXT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
      cliente_id TEXT REFERENCES clientes(id),
      propriedade_id TEXT REFERENCES propriedades(id),
      tipo_pericia TEXT,
      numero_processo TEXT,
      data_vistoria TEXT,
      laudo_entregue INTEGER DEFAULT 0,
      status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_pericias_projeto_id ON pericias(projeto_id);');
}

export async function ensureBudgetModule(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS propriedades (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      area_ha REAL,
      matricula TEXT,
      car TEXT,
      ccir TEXT,
      itr TEXT,
      cidade TEXT,
      municipio TEXT,
      situacao_imovel TEXT,
      latitude REAL,
      longitude REAL,
      observacoes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_propriedades_cliente_id ON propriedades(cliente_id);');

  const budgetColumns: Array<[string, string]> = [
    ['grupo_id', 'TEXT'],
    ['substitui_orcamento_id', 'TEXT'],
    ['versao', 'INTEGER DEFAULT 1 NOT NULL'],
    ['propriedade_id', 'TEXT'],
    ['observacoes_cliente', 'TEXT'],
    ['termos_condicoes', 'TEXT'],
    ['data_emissao', 'TEXT'],
    ['validade_ate', 'TEXT'],
    ['responsavel_tecnico', 'TEXT'],
    ['origem', "TEXT DEFAULT 'manual'"],
    ['servico_tipo', 'TEXT'],
    ['imovel_tipo', 'TEXT'],
    ['imovel_nome', 'TEXT'],
    ['municipio', 'TEXT'],
    ['uf', 'TEXT'],
    ['metodologia', 'TEXT'],
    ['entregaveis', 'TEXT'],
    ['prazo_execucao_dias', 'INTEGER'],
    ['caracterizacao_json', 'TEXT'],
    ['cliente_snapshot_json', 'TEXT'],
    ['imovel_snapshot_json', 'TEXT'],
    ['desconto_global_tipo', "TEXT DEFAULT 'fixo'"],
    ['desconto_global_valor', "TEXT DEFAULT '0'"],
    ['acrescimo_global_tipo', "TEXT DEFAULT 'fixo'"],
    ['acrescimo_global_valor', "TEXT DEFAULT '0'"],
    ['subtotal_servicos', 'INTEGER DEFAULT 0'],
    ['subtotal_despesas', 'INTEGER DEFAULT 0'],
    ['subtotal_taxas', 'INTEGER DEFAULT 0'],
    ['custo_total_estimado', 'INTEGER DEFAULT 0'],
    ['impostos_previstos', 'INTEGER DEFAULT 0'],
    ['honorarios_brutos', 'INTEGER DEFAULT 0'],
    ['honorarios_liquidos', 'INTEGER DEFAULT 0'],
    ['lucro_estimado', 'INTEGER DEFAULT 0'],
    ['margem_pontos_base', 'INTEGER'],
    ['markup_pontos_base', 'INTEGER'],
    ['valor_reembolsavel', 'INTEGER DEFAULT 0'],
    ['valor_nao_tributavel', 'INTEGER DEFAULT 0'],
    ['emitido_em', 'TEXT'],
    ['enviado_em', 'TEXT'],
    ['visualizado_em', 'TEXT'],
    ['aprovado_em', 'TEXT'],
    ['aprovado_por', 'TEXT'],
    ['rejeitado_em', 'TEXT'],
    ['cancelado_em', 'TEXT'],
    ['motivo_status', 'TEXT'],
    ['bloqueado_em', 'TEXT'],
    ['chave_idempotencia_aprovacao', 'TEXT'],
    ['efeitos_aprovacao_json', 'TEXT']
  ];
  for (const [column, definition] of budgetColumns) {
    await addColumnIfTableExists(client, 'orcamentos', column, definition);
  }

  const itemColumns: Array<[string, string]> = [
    ['quantidade_decimal', "TEXT DEFAULT '1'"],
    ['custo_unitario', 'INTEGER DEFAULT 0'],
    ['codigo', 'TEXT'],
    ['grupo', 'TEXT'],
    ['etapa', 'TEXT'],
    ['categoria', "TEXT DEFAULT 'Serviços'"],
    ['unidade', "TEXT DEFAULT 'serviço'"],
    ['componente_financeiro', "TEXT DEFAULT 'servico'"],
    ['desconto_tipo', "TEXT DEFAULT 'fixo'"],
    ['desconto_valor', "TEXT DEFAULT '0'"],
    ['acrescimo_tipo', "TEXT DEFAULT 'fixo'"],
    ['acrescimo_valor', "TEXT DEFAULT '0'"],
    ['tributavel', 'INTEGER DEFAULT 1'],
    ['margem_pontos_base', 'INTEGER'],
    ['observacoes', 'TEXT'],
    ['ordem', 'INTEGER DEFAULT 0'],
    ['opcional', 'INTEGER DEFAULT 0'],
    ['obrigatorio', 'INTEGER DEFAULT 1']
  ];
  for (const [column, definition] of itemColumns) {
    await addColumnIfTableExists(client, 'orcamento_itens', column, definition);
  }

  const costColumns: Array<[string, string]> = [
    ['categoria', "TEXT DEFAULT 'Outros custos'"],
    ['classificacao', "TEXT DEFAULT 'custo_proprio'"],
    ['tributavel', 'INTEGER DEFAULT 0'],
    ['observacoes', 'TEXT'],
    ['ordem', 'INTEGER DEFAULT 0']
  ];
  for (const [column, definition] of costColumns) {
    await addColumnIfTableExists(client, 'orcamento_despesas', column, definition);
  }

  const installmentColumns: Array<[string, string]> = [
    ['numero', 'INTEGER DEFAULT 1'],
    ['valor_pago', 'INTEGER DEFAULT 0'],
    ['tipo_valor', "TEXT DEFAULT 'recebivel_previsto'"],
    ['origem_versao', 'INTEGER DEFAULT 1'],
    ['chave_origem', 'TEXT'],
    ['categoria_financeira', 'TEXT'],
    ['conta_financeira', 'TEXT'],
    ['meio_pagamento', 'TEXT'],
    ['data_competencia', 'TEXT'],
    ['juros', 'INTEGER DEFAULT 0'],
    ['multa', 'INTEGER DEFAULT 0'],
    ['desconto_antecipacao', 'INTEGER DEFAULT 0'],
    ['imposto_previsto', 'INTEGER DEFAULT 0'],
    ['cancelada_em', 'TEXT'],
    ['motivo_cancelamento', 'TEXT']
  ];
  for (const [column, definition] of installmentColumns) {
    await addColumnIfTableExists(client, 'parcelas', column, definition);
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS perfis_tributarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      ativo INTEGER DEFAULT 1 NOT NULL CHECK (ativo IN (0, 1)),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS tributos (
      id TEXT PRIMARY KEY,
      perfil_id TEXT NOT NULL REFERENCES perfis_tributarios(id) ON DELETE CASCADE,
      nome TEXT NOT NULL,
      sigla TEXT NOT NULL,
      aliquota_pontos_base INTEGER NOT NULL CHECK (aliquota_pontos_base >= 0),
      base_calculo TEXT DEFAULT 'tributavel' NOT NULL CHECK (base_calculo IN ('tributavel', 'servicos', 'taxas', 'total')),
      incluso_no_preco INTEGER DEFAULT 0 NOT NULL CHECK (incluso_no_preco IN (0, 1)),
      cumulativo INTEGER DEFAULT 0 NOT NULL CHECK (cumulativo IN (0, 1)),
      ativo INTEGER DEFAULT 1 NOT NULL CHECK (ativo IN (0, 1)),
      categoria_financeira TEXT,
      conta_financeira TEXT,
      vigencia_inicio TEXT,
      vigencia_fim TEXT,
      observacoes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS orcamento_impostos (
      id TEXT PRIMARY KEY,
      orcamento_id TEXT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
      tributo_id TEXT REFERENCES tributos(id),
      nome TEXT NOT NULL,
      sigla TEXT NOT NULL,
      aliquota_pontos_base INTEGER NOT NULL CHECK (aliquota_pontos_base >= 0),
      base_calculo TEXT DEFAULT 'tributavel' NOT NULL,
      incluso_no_preco INTEGER DEFAULT 0 NOT NULL CHECK (incluso_no_preco IN (0, 1)),
      cumulativo INTEGER DEFAULT 0 NOT NULL CHECK (cumulativo IN (0, 1)),
      base_valor INTEGER DEFAULT 0 NOT NULL,
      valor_previsto INTEGER DEFAULT 0 NOT NULL,
      ajuste_manual INTEGER DEFAULT 0 NOT NULL,
      justificativa_ajuste TEXT,
      ordem INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS orcamento_condicoes_pagamento (
      id TEXT PRIMARY KEY,
      orcamento_id TEXT NOT NULL UNIQUE REFERENCES orcamentos(id) ON DELETE CASCADE,
      tipo TEXT DEFAULT 'parcelas' NOT NULL,
      descricao TEXT,
      parcelas_json TEXT NOT NULL,
      meio_pagamento TEXT,
      conta_financeira TEXT,
      juros_pontos_base INTEGER DEFAULT 0 NOT NULL,
      multa_pontos_base INTEGER DEFAULT 0 NOT NULL,
      desconto_antecipacao_pontos_base INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS orcamento_status_historico (
      id TEXT PRIMARY KEY,
      orcamento_id TEXT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
      status_anterior TEXT,
      status_novo TEXT NOT NULL,
      motivo TEXT,
      usuario_id TEXT DEFAULT 'admin' NOT NULL,
      metadata_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS orcamento_versoes (
      id TEXT PRIMARY KEY,
      orcamento_id TEXT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
      grupo_id TEXT NOT NULL,
      versao INTEGER NOT NULL,
      status TEXT NOT NULL,
      valor_total INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      motivo TEXT,
      usuario_id TEXT DEFAULT 'admin' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE (grupo_id, versao, status)
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS orcamento_modelos (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      servico_tipo TEXT,
      descricao TEXT,
      conteudo_json TEXT NOT NULL,
      ativo INTEGER DEFAULT 1 NOT NULL CHECK (ativo IN (0, 1)),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS parametros_precificacao (
      id TEXT PRIMARY KEY,
      chave TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      categoria TEXT NOT NULL,
      unidade TEXT,
      valor_centavos INTEGER,
      valor_decimal TEXT,
      ativo INTEGER DEFAULT 1 NOT NULL CHECK (ativo IN (0, 1)),
      observacoes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      deleted_at TEXT
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS orcamento_projetos (
      id TEXT PRIMARY KEY,
      orcamento_id TEXT NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
      projeto_id TEXT NOT NULL REFERENCES projetos(id),
      tipo_vinculo TEXT DEFAULT 'aprovacao' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE (orcamento_id, projeto_id)
    )
  `);

  await client.execute("UPDATE orcamentos SET grupo_id = COALESCE(grupo_id, id), versao = COALESCE(versao, 1), origem = COALESCE(origem, 'manual')");
  await client.execute("UPDATE orcamentos SET data_emissao = COALESCE(data_emissao, data_orcamento) WHERE data_orcamento IS NOT NULL");
  await client.execute("UPDATE orcamentos SET validade_ate = date(data_emissao, '+15 days') WHERE validade_ate IS NULL AND data_emissao IS NOT NULL");
  await client.execute(`
    UPDATE orcamentos SET status = CASE lower(trim(status))
      WHEN 'aprovado' THEN 'aprovado'
      WHEN 'pago' THEN 'aprovado'
      WHEN 'rejeitado' THEN 'rejeitado'
      WHEN 'expirado' THEN 'expirado'
      WHEN 'cancelado' THEN 'cancelado'
      WHEN 'emitido' THEN 'emitido'
      WHEN 'enviado' THEN 'enviado'
      WHEN 'em negociação' THEN 'em_negociacao'
      WHEN 'em negociacao' THEN 'em_negociacao'
      ELSE 'rascunho'
    END
  `);
  await client.execute("UPDATE orcamento_itens SET quantidade_decimal = COALESCE(quantidade_decimal, CAST(quantidade AS TEXT)), custo_unitario = COALESCE(custo_unitario, 0), componente_financeiro = COALESCE(componente_financeiro, 'servico')");
  await client.execute("UPDATE orcamento_despesas SET categoria = COALESCE(categoria, 'Outros custos'), classificacao = COALESCE(classificacao, 'custo_proprio')");
  await client.execute("UPDATE parcelas SET numero = COALESCE(numero, 1), valor_pago = COALESCE(valor_pago, CASE WHEN status_pagamento = 'Pago' THEN valor ELSE 0 END), tipo_valor = COALESCE(tipo_valor, 'recebivel_previsto'), origem_versao = COALESCE(origem_versao, 1)");
  await client.execute("UPDATE parcelas SET valor_pago = valor WHERE status_pagamento = 'Pago' AND COALESCE(valor_pago, 0) = 0");

  await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamentos_grupo_versao ON orcamentos(grupo_id, versao);');
  await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamentos_aprovacao_idempotencia ON orcamentos(chave_idempotencia_aprovacao) WHERE chave_idempotencia_aprovacao IS NOT NULL;');
  await client.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_parcelas_chave_origem ON parcelas(chave_origem) WHERE chave_origem IS NOT NULL;');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_orcamentos_emissao_status ON orcamentos(data_emissao, status);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_orcamentos_validade_status ON orcamentos(validade_ate, status);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_orcamentos_filtros ON orcamentos(cliente_id, servico_tipo, municipio, imovel_tipo, status);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_orcamento_impostos_orcamento ON orcamento_impostos(orcamento_id);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_orcamento_status_historico ON orcamento_status_historico(orcamento_id, created_at);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_orcamento_versoes_orcamento ON orcamento_versoes(orcamento_id, created_at);');
}

export async function ensureCoreTables(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      id TEXT PRIMARY KEY,
      empresa_nome TEXT NOT NULL,
      empresa_cnpj TEXT,
      dados_pasta TEXT NOT NULL,
      admin_nome TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      admin_senha_hash TEXT NOT NULL,
      setup_concluido INTEGER DEFAULT 1 NOT NULL,
      google_client_id TEXT,
      google_client_secret TEXT,
      google_refresh_token TEXT,
      google_access_token TEXT,
      google_sync_active INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      documento TEXT,
      email TEXT,
      telefone TEXT,
      endereco TEXT,
      numero TEXT,
      bairro TEXT,
      celular TEXT,
      cpf TEXT,
      cnpj TEXT,
      origem TEXT,
      categoria TEXT,
      anotacoes TEXT,
      situacao TEXT,
      servicos TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS projetos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL REFERENCES clientes(id),
      nome TEXT NOT NULL,
      descricao TEXT,
      status TEXT DEFAULT 'Em Andamento' NOT NULL,
      data_inicio TEXT,
      data_entrega TEXT,
      area_ha REAL,
      matricula TEXT,
      car TEXT,
      ccir TEXT,
      itr TEXT,
      cidade TEXT,
      municipio TEXT,
      situacao_imovel TEXT,
      tipo TEXT,
      averbacao TEXT,
      latitude REAL,
      longitude REAL,
      possui_memorial_descritivo TEXT,
      observacoes TEXT,
      propriedade_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS orcamentos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL REFERENCES clientes(id),
      projeto_id TEXT REFERENCES projetos(id),
      valor_total INTEGER NOT NULL,
      status TEXT DEFAULT 'Em Análise' NOT NULL,
      descricao TEXT,
      anotacoes TEXT,
      forma_de_pagamento TEXT,
      desconto INTEGER,
      codigo_orcamento TEXT,
      data_orcamento TEXT,
      data_competencia TEXT,
      data_pagamento TEXT,
      itens_json TEXT,
      possui_marco INTEGER DEFAULT 0,
      marco_qtd INTEGER,
      marco_valor INTEGER,
      possui_imposto INTEGER DEFAULT 0,
      imposto_porcentagem REAL,
      imposto_valor INTEGER,
      imposto_retido INTEGER DEFAULT 0,
      centro_custo TEXT,
      possui_art INTEGER DEFAULT 0,
      art_valor INTEGER,
      despesas_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS parcelas (
      id TEXT PRIMARY KEY,
      orcamento_id TEXT NOT NULL REFERENCES orcamentos(id),
      valor INTEGER NOT NULL,
      data_vencimento TEXT NOT NULL,
      data_pagamento TEXT,
      status_pagamento TEXT DEFAULT 'Pendente' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS despesas (
      id TEXT PRIMARY KEY,
      cliente_id TEXT REFERENCES clientes(id),
      projeto_id TEXT REFERENCES projetos(id),
      descricao TEXT NOT NULL,
      fornecedor TEXT,
      numero_documento TEXT,
      valor INTEGER NOT NULL,
      data TEXT NOT NULL,
      data_competencia TEXT,
      data_pagamento TEXT,
      tipo_custo TEXT,
      centro_custo TEXT,
      reembolsavel INTEGER DEFAULT 0,
      comprovante_documento_id TEXT,
      categoria TEXT NOT NULL,
      observacoes TEXT,
      status TEXT,
      forma_pagamento TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS tarefas (
      id TEXT PRIMARY KEY,
      cliente_id TEXT REFERENCES clientes(id),
      projeto_id TEXT REFERENCES projetos(id),
      titulo TEXT NOT NULL,
      descricao TEXT,
      status TEXT DEFAULT 'A Fazer' NOT NULL,
      prioridade TEXT DEFAULT 'Média' NOT NULL,
      categoria TEXT DEFAULT 'Interno',
      contexto_tipo TEXT DEFAULT 'projeto',
      data_limite TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS compromissos (
      id TEXT PRIMARY KEY,
      titulo TEXT NOT NULL,
      descricao TEXT,
      data TEXT NOT NULL,
      hora TEXT,
      tipo TEXT DEFAULT 'Visita de Campo' NOT NULL,
      cliente_id TEXT REFERENCES clientes(id),
      projeto_id TEXT REFERENCES projetos(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS oportunidades (
      id TEXT PRIMARY KEY,
      cliente_id TEXT REFERENCES clientes(id),
      lead_id TEXT REFERENCES contatos(id),
      titulo TEXT NOT NULL,
      valor_estimado INTEGER,
      estagio TEXT DEFAULT 'Prospectado' NOT NULL,
      ordem INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS interacoes_cliente (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL REFERENCES clientes(id),
      projeto_id TEXT REFERENCES projetos(id),
      orcamento_id TEXT REFERENCES orcamentos(id),
      titulo TEXT,
      categoria TEXT,
      manual INTEGER DEFAULT 1,
      tipo TEXT NOT NULL,
      data TEXT NOT NULL,
      descricao TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
}

async function ensureOpportunitySubjectLinks(client: Client) {
  await addColumnIfTableExists(client, 'oportunidades', 'deleted_at', 'TEXT');
  const tableInfo = await client.execute('PRAGMA table_info(oportunidades);');
  const clientColumn = tableInfo.rows.find((row) => String(row.name) === 'cliente_id');
  const hasLeadColumn = tableInfo.rows.some((row) => String(row.name) === 'lead_id');

  if (Number(clientColumn?.notnull || 0) === 0) {
    if (!hasLeadColumn) {
      await client.execute('ALTER TABLE oportunidades ADD COLUMN lead_id TEXT REFERENCES contatos(id);');
    }
    return;
  }

  await client.execute('DROP TABLE IF EXISTS oportunidades_subjects_v2;');
    await client.execute(`
      CREATE TABLE oportunidades_subjects_v2 (
        id TEXT PRIMARY KEY,
        cliente_id TEXT REFERENCES clientes(id),
        lead_id TEXT REFERENCES contatos(id),
        titulo TEXT NOT NULL,
        valor_estimado INTEGER,
        estagio TEXT DEFAULT 'Prospectado' NOT NULL,
        ordem INTEGER DEFAULT 0 NOT NULL,
        responsavel TEXT,
        origem TEXT,
        servico_tipo TEXT,
        proxima_acao TEXT,
        proxima_acao_em TEXT,
        previsao_fechamento TEXT,
        probabilidade_pontos_base INTEGER DEFAULT 1000 NOT NULL,
        observacoes TEXT,
        motivo_perda TEXT,
        encerrado_em TEXT,
        ultimo_contato_em TEXT,
        orcamento_id TEXT REFERENCES orcamentos(id),
        projeto_id TEXT REFERENCES projetos(id),
        estagio_alterado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        deleted_at TEXT
      )
    `);
    await client.execute(`
      INSERT INTO oportunidades_subjects_v2 (
        id, cliente_id, lead_id, titulo, valor_estimado, estagio, ordem, responsavel, origem,
        servico_tipo, proxima_acao, proxima_acao_em, previsao_fechamento,
        probabilidade_pontos_base, observacoes, motivo_perda, encerrado_em, ultimo_contato_em,
        orcamento_id, projeto_id, estagio_alterado_em, created_at, updated_at, deleted_at
      )
      SELECT
        id, cliente_id, ${hasLeadColumn ? 'lead_id' : 'NULL'}, titulo, valor_estimado, estagio, ordem,
        responsavel, origem, servico_tipo, proxima_acao, proxima_acao_em, previsao_fechamento,
        probabilidade_pontos_base, observacoes, motivo_perda, encerrado_em, ultimo_contato_em,
        orcamento_id, projeto_id, COALESCE(estagio_alterado_em, updated_at, created_at, CURRENT_TIMESTAMP),
        created_at, updated_at, deleted_at
      FROM oportunidades
    `);
    const [before, after] = await Promise.all([
      client.execute('SELECT COUNT(*) AS total FROM oportunidades;'),
      client.execute('SELECT COUNT(*) AS total FROM oportunidades_subjects_v2;')
    ]);
    if (Number(before.rows[0]?.total || 0) !== Number(after.rows[0]?.total || 0)) {
      throw new Error('A migração de vínculos comerciais não preservou todas as oportunidades.');
    }
  await client.execute('DROP TABLE oportunidades;');
  await client.execute('ALTER TABLE oportunidades_subjects_v2 RENAME TO oportunidades;');
}

export async function ensureOpportunityCRM(client: Client) {
  const hadProbabilityColumn = await hasColumn(client, 'oportunidades', 'probabilidade_pontos_base');
  const columns: Array<[string, string]> = [
    ['responsavel', 'TEXT'],
    ['origem', 'TEXT'],
    ['servico_tipo', 'TEXT'],
    ['proxima_acao', 'TEXT'],
    ['proxima_acao_em', 'TEXT'],
    ['previsao_fechamento', 'TEXT'],
    ['probabilidade_pontos_base', 'INTEGER DEFAULT 1000 NOT NULL'],
    ['observacoes', 'TEXT'],
    ['motivo_perda', 'TEXT'],
    ['encerrado_em', 'TEXT'],
    ['ultimo_contato_em', 'TEXT'],
    ['orcamento_id', 'TEXT REFERENCES orcamentos(id)'],
    ['projeto_id', 'TEXT REFERENCES projetos(id)'],
    ['estagio_alterado_em', 'TEXT']
  ];

  for (const [column, definition] of columns) {
    await addColumnIfTableExists(client, 'oportunidades', column, definition);
  }

  await client.execute("UPDATE oportunidades SET estagio = 'Prospectado' WHERE estagio = 'Prospect';");
  await client.execute('UPDATE oportunidades SET estagio_alterado_em = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP) WHERE estagio_alterado_em IS NULL;');
  if (!hadProbabilityColumn) {
    await client.execute(`
      UPDATE oportunidades
      SET probabilidade_pontos_base = CASE estagio
        WHEN 'Contato' THEN 3000
        WHEN 'Proposta' THEN 6500
        WHEN 'Ganho' THEN 10000
        WHEN 'Perdido' THEN 0
        ELSE 1000
      END
    `);
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS oportunidade_estagios_historico (
      id TEXT PRIMARY KEY,
      oportunidade_id TEXT NOT NULL REFERENCES oportunidades(id) ON DELETE CASCADE,
      estagio_anterior TEXT,
      estagio_novo TEXT NOT NULL,
      motivo TEXT,
      usuario_id TEXT DEFAULT 'admin' NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  const opportunitiesWithoutHistory = await client.execute(`
    SELECT o.id, o.estagio, COALESCE(o.estagio_alterado_em, o.updated_at, o.created_at, CURRENT_TIMESTAMP) AS created_at
    FROM oportunidades o
    WHERE NOT EXISTS (
        SELECT 1 FROM oportunidade_estagios_historico h WHERE h.oportunidade_id = o.id
      )
  `);
  for (const opportunity of opportunitiesWithoutHistory.rows) {
    await client.execute({
      sql: `INSERT INTO oportunidade_estagios_historico
        (id, oportunidade_id, estagio_anterior, estagio_novo, motivo, usuario_id, created_at)
        VALUES (?, ?, NULL, ?, ?, 'admin', ?)`,
      args: [
        crypto.randomUUID(),
        String(opportunity.id),
        String(opportunity.estagio || 'Prospectado'),
        'Migração do funil comercial',
        String(opportunity.created_at)
      ]
    });
  }
  await ensureOpportunitySubjectLinks(client);
  await client.execute('CREATE INDEX IF NOT EXISTS idx_oportunidades_cliente_id ON oportunidades(cliente_id);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_oportunidades_lead_id ON oportunidades(lead_id);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_oportunidades_proxima_acao ON oportunidades(proxima_acao_em);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_oportunidades_previsao_fechamento ON oportunidades(previsao_fechamento);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_oportunidades_orcamento_id ON oportunidades(orcamento_id);');
  await client.execute('CREATE INDEX IF NOT EXISTS idx_oportunidade_estagios_historico ON oportunidade_estagios_historico(oportunidade_id, created_at);');
}


