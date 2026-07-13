import { createClient, type Client } from '@libsql/client';
import path from 'path';
import crypto from 'crypto';

const dbPath = process.env.GEOGESTOR_DB_PATH || path.resolve(__dirname, '../../../../data/geogestor.db');

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

async function addColumnIfTableExists(client: Client, table: string, column: string, definition: string) {
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

async function ensureDocumentoCategorias(client: Client) {
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

async function ensureDocumentos(client: Client) {
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

async function ensureAuditLogs(client: Client) {
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

async function ensureConfiguracoesSingleton(client: Client) {
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

async function ensureTarefasShape(client: Client) {
  if (!(await hasTable(client, 'tarefas'))) return;

  await addColumnIfMissing(client, 'tarefas', 'cliente_id', 'TEXT');
  await addColumnIfMissing(client, 'tarefas', 'categoria', "TEXT DEFAULT 'Interno'");
  await addColumnIfMissing(client, 'tarefas', 'contexto_tipo', "TEXT DEFAULT 'projeto'");

  const columns = await getColumns(client, 'tarefas');
  const projetoId = columns.find((item) => item.name === 'projeto_id');

  if (!projetoId || Number(projetoId.notnull) === 0) return;

  await client.execute('PRAGMA foreign_keys=OFF');
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
  await client.execute('PRAGMA foreign_keys=ON');
}

async function ensureContatos(client: Client) {
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
  await addColumnIfMissing(client, 'contatos', 'created_at', 'TEXT');
  await addColumnIfMissing(client, 'contatos', 'updated_at', 'TEXT');
  await client.execute("UPDATE contatos SET status = COALESCE(status, 'ativo')");
  await client.execute('UPDATE contatos SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP)');
  await client.execute('UPDATE contatos SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)');
}

async function ensureCoreTables(client: Client) {
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
      cliente_id TEXT NOT NULL REFERENCES clientes(id),
      titulo TEXT NOT NULL,
      valor_estimado INTEGER,
      estagio TEXT DEFAULT 'Prospect' NOT NULL,
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

export async function ensureRuntimeMigrations() {
  await runRuntimeMigrations();
}

async function fixBrokenForeignKeys(client: Client) {
  try {
    const res = await client.execute("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql LIKE '%__old_push%'");
    for (const row of res.rows) {
      if (row.name === 'parcelas') {
        await client.execute('PRAGMA foreign_keys = OFF;');
        await client.execute("CREATE TABLE IF NOT EXISTS parcelas_new (`id` text PRIMARY KEY NOT NULL, `orcamento_id` text NOT NULL, `valor` integer NOT NULL, `data_vencimento` text NOT NULL, `status_pagamento` text DEFAULT 'Pendente' NOT NULL, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `data_pagamento` text, FOREIGN KEY (`orcamento_id`) REFERENCES `orcamentos`(`id`) ON UPDATE no action ON DELETE no action);");
        await client.execute('INSERT INTO parcelas_new SELECT id, orcamento_id, valor, data_vencimento, status_pagamento, created_at, updated_at, data_pagamento FROM parcelas;');
        await client.execute('DROP TABLE parcelas;');
        await client.execute('ALTER TABLE parcelas_new RENAME TO parcelas;');
        await client.execute('PRAGMA foreign_keys = ON;');
      }
    }
  } catch {
    /* ignora se falhar */
  }
}

export async function runRuntimeMigrations() {
  const client = createClient({
    url: `file:${dbPath}`
  });

  try {
    // Configurações de concorrência e integridade do SQLite
    await client.execute('PRAGMA journal_mode = WAL;');
    await client.execute('PRAGMA busy_timeout = 5000;');
    await client.execute('PRAGMA foreign_keys = ON;');

    await fixBrokenForeignKeys(client);

    await ensureCoreTables(client);

    await addColumnIfTableExists(client, 'configuracoes', 'google_client_id', 'TEXT');
    await addColumnIfTableExists(client, 'configuracoes', 'google_client_secret', 'TEXT');
    await addColumnIfTableExists(client, 'configuracoes', 'google_refresh_token', 'TEXT');
    await addColumnIfTableExists(client, 'configuracoes', 'google_access_token', 'TEXT');
    await addColumnIfTableExists(client, 'configuracoes', 'google_sync_active', 'INTEGER DEFAULT 0');
    await client.execute('UPDATE configuracoes SET setup_concluido = 1;');

    await addColumnIfTableExists(client, 'clientes', 'celular', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'cpf', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'cnpj', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'numero', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'bairro', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'origem', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'categoria', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'anotacoes', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'situacao', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'servicos', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'previsao_entrega', 'TEXT');

    await addColumnIfTableExists(client, 'projetos', 'area_ha', 'REAL');
    await addColumnIfTableExists(client, 'projetos', 'matricula', 'TEXT');
    await addColumnIfTableExists(client, 'projetos', 'car', 'TEXT');
    await addColumnIfTableExists(client, 'projetos', 'ccir', 'TEXT');
    await addColumnIfTableExists(client, 'projetos', 'itr', 'TEXT');
    await addColumnIfTableExists(client, 'projetos', 'cidade', 'TEXT');
    await addColumnIfTableExists(client, 'projetos', 'municipio', 'TEXT');
    await addColumnIfTableExists(client, 'projetos', 'situacao_imovel', 'TEXT');
    await addColumnIfTableExists(client, 'projetos', 'tipo', 'TEXT');
    await addColumnIfTableExists(client, 'projetos', 'averbacao', 'TEXT');
    await addColumnIfTableExists(client, 'projetos', 'latitude', 'REAL');
    await addColumnIfTableExists(client, 'projetos', 'longitude', 'REAL');
    await addColumnIfTableExists(client, 'projetos', 'possui_memorial_descritivo', 'TEXT');
    await addColumnIfTableExists(client, 'projetos', 'observacoes', 'TEXT');
    await addColumnIfTableExists(client, 'projetos', 'propriedade_id', 'TEXT');

    await addColumnIfTableExists(client, 'compromissos', 'google_event_id', 'TEXT');
    await addColumnIfTableExists(client, 'compromissos', 'ultimo_sync_google', 'TEXT');
    await addColumnIfTableExists(client, 'compromissos', 'hora', 'TEXT');

    await addColumnIfTableExists(client, 'orcamentos', 'projeto_id', 'TEXT');
    await addColumnIfTableExists(client, 'orcamentos', 'status', "TEXT DEFAULT 'Rascunho'");
    await addColumnIfTableExists(client, 'orcamentos', 'data_competencia', 'TEXT');
    await addColumnIfTableExists(client, 'orcamentos', 'data_pagamento', 'TEXT');
    await addColumnIfTableExists(client, 'orcamentos', 'imposto_valor', 'INTEGER');
    await addColumnIfTableExists(client, 'orcamentos', 'imposto_retido', 'INTEGER DEFAULT 0');
    await addColumnIfTableExists(client, 'orcamentos', 'centro_custo', 'TEXT');
    await addColumnIfTableExists(client, 'orcamentos', 'possui_art', 'INTEGER DEFAULT 0');
    await addColumnIfTableExists(client, 'orcamentos', 'art_valor', 'INTEGER');
    await addColumnIfTableExists(client, 'orcamentos', 'despesas_json', 'TEXT');

    await addColumnIfTableExists(client, 'parcelas', 'data_pagamento', 'TEXT');

    await addColumnIfTableExists(client, 'despesas', 'cliente_id', 'TEXT');
    await addColumnIfTableExists(client, 'despesas', 'data_competencia', 'TEXT');
    await addColumnIfTableExists(client, 'despesas', 'data_pagamento', 'TEXT');
    await addColumnIfTableExists(client, 'despesas', 'tipo_custo', 'TEXT');
    await addColumnIfTableExists(client, 'despesas', 'centro_custo', 'TEXT');
    await addColumnIfTableExists(client, 'despesas', 'reembolsavel', 'INTEGER DEFAULT 0');
    await addColumnIfTableExists(client, 'despesas', 'comprovante_documento_id', 'TEXT');
    await addColumnIfTableExists(client, 'despesas', 'fornecedor', 'TEXT');
    await addColumnIfTableExists(client, 'despesas', 'numero_documento', 'TEXT');

    await ensureTarefasShape(client);

    await addColumnIfTableExists(client, 'compromissos', 'cliente_id', 'TEXT');

    await addColumnIfTableExists(client, 'interacoes_cliente', 'projeto_id', 'TEXT');
    await addColumnIfTableExists(client, 'interacoes_cliente', 'orcamento_id', 'TEXT');
    await addColumnIfTableExists(client, 'interacoes_cliente', 'titulo', 'TEXT');
    await addColumnIfTableExists(client, 'interacoes_cliente', 'categoria', 'TEXT');
    await addColumnIfTableExists(client, 'interacoes_cliente', 'manual', 'INTEGER DEFAULT 1');

    await ensureDocumentoCategorias(client);
    await ensureDocumentos(client);
    await ensureAuditLogs(client);
    await ensureConfiguracoesSingleton(client);
    await ensureContatos(client);

    // Soft Deletes
    const tablesWithSoftDelete = [
      'configuracoes', 'clientes', 'projetos', 'orcamentos', 'parcelas', 'despesas', 
      'tarefas', 'compromissos', 'oportunidades', 'interacoes_cliente', 
      'contatos', 'documento_categorias', 'documentos'
    ];
    for (const table of tablesWithSoftDelete) {
      await addColumnIfTableExists(client, table, 'deleted_at', 'TEXT');
    }

    // Normalização de Orçamentos
    await client.execute(`
      CREATE TABLE IF NOT EXISTS orcamento_itens (
        id TEXT PRIMARY KEY,
        orcamento_id TEXT NOT NULL REFERENCES orcamentos(id),
        descricao TEXT NOT NULL,
        quantidade REAL NOT NULL,
        valor_unitario INTEGER NOT NULL,
        total INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        deleted_at TEXT
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS orcamento_despesas (
        id TEXT PRIMARY KEY,
        orcamento_id TEXT NOT NULL REFERENCES orcamentos(id),
        descricao TEXT NOT NULL,
        valor INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        deleted_at TEXT
      )
    `);

    try {
      // Migrar dados JSON para tabelas
      const orcamentosWithJson = await client.execute("SELECT id, itens_json, despesas_json FROM orcamentos WHERE itens_json IS NOT NULL OR despesas_json IS NOT NULL");
      
      for (const orc of orcamentosWithJson.rows) {
        if (orc.itens_json && typeof orc.itens_json === 'string' && orc.itens_json.trim() !== '') {
          try {
            const itens = JSON.parse(orc.itens_json);
            for (const item of itens) {
              await client.execute({
                sql: "INSERT OR IGNORE INTO orcamento_itens (id, orcamento_id, descricao, quantidade, valor_unitario, total) VALUES (?, ?, ?, ?, ?, ?)",
                args: [crypto.randomUUID(), orc.id as string, item.descricao || 'Item Sem Descrição', item.quantidade || 1, item.valorUnitario || 0, item.total || 0]
              });
            }
          } catch (e) {
            console.error('Falha ao migrar itens_json do orcamento', orc.id);
          }
        }

        if (orc.despesas_json && typeof orc.despesas_json === 'string' && orc.despesas_json.trim() !== '') {
          try {
            const despesas = JSON.parse(orc.despesas_json);
            for (const desp of despesas) {
              await client.execute({
                sql: "INSERT OR IGNORE INTO orcamento_despesas (id, orcamento_id, descricao, valor) VALUES (?, ?, ?, ?)",
                args: [crypto.randomUUID(), orc.id as string, desp.descricao || 'Despesa Sem Descrição', desp.valor || 0]
              });
            }
          } catch (e) {
            console.error('Falha ao migrar despesas_json do orcamento', orc.id);
          }
        }
      }
    } catch (e) {
      console.log('Skipping JSON migration for orcamentos as columns orcamentos.itens_json or orcamentos.despesas_json are missing in the schema.');
    }

    // Após migrar, os campos originais poderiam ser descartados, mas o SQLite não permite DROP COLUMN facilmente.
    // Vamos apenas deixá-los null ou ignora-los nas queries futuras.

    // Índices de otimização para chaves estrangeiras e filtros frequentes
    await client.execute('CREATE INDEX IF NOT EXISTS idx_projetos_cliente_status_data ON projetos(cliente_id, status, data_entrega);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_projeto_status ON orcamentos(cliente_id, projeto_id, status, data_competencia);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_parcelas_orcamento_status_data ON parcelas(orcamento_id, status_pagamento, data_vencimento);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_despesas_cliente_projeto_status ON despesas(cliente_id, projeto_id, status, data, categoria);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_tarefas_cliente_projeto_status ON tarefas(cliente_id, projeto_id, status, data_limite);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_interacoes_cliente_data ON interacoes_cliente(cliente_id, data);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_documentos_cliente_projeto_cat ON documentos(cliente_id, projeto_id, categoria_id, caminho);');
  } finally {
    client.close();
  }
}
