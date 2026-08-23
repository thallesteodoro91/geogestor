import { createClient, type Client } from '@libsql/client';
import path from 'path';
import crypto from 'crypto';
import fs from 'node:fs/promises';
import { cloneDatabaseEncryptedSync, databaseClientConfig } from '@geogestor/database';
import {
  ensureFilesystemOperations,
  FILESYSTEM_OUTBOX_MIGRATION
} from './runtime-migrations/v2-filesystem-outbox';
import {
  CLIENT_DOCUMENT_INTEGRITY_MIGRATION,
  ensureClientDocumentIntegrity
} from './runtime-migrations/v3-client-document-integrity';
import {
  ensureManagerialFinance,
  MANAGERIAL_FINANCE_MIGRATION
} from './runtime-migrations/v4-managerial-finance';
import {
  ensureStrategicPlanning,
  STRATEGIC_PLANNING_MIGRATION
} from './runtime-migrations/v5-strategic-planning';
import {
  ensureStrategicGovernance,
  STRATEGIC_GOVERNANCE_MIGRATION
} from './runtime-migrations/v6-strategic-governance';
import {
  ensureOperationalIntegrity,
  OPERATIONAL_INTEGRITY_MIGRATION
} from './runtime-migrations/v7-operational-integrity';
import {
  ensureUnifiedAlerts,
  UNIFIED_ALERTS_MIGRATION
} from './runtime-migrations/v8-unified-alerts';
import {
  CLIENT_WORKSPACE_INTEGRITY_MIGRATION,
  ensureClientWorkspaceIntegrity
} from './runtime-migrations/v9-client-workspace-integrity';
import {
  ensurePropertyGeography,
  PROPERTY_GEOGRAPHY_MIGRATION
} from './runtime-migrations/v10-property-geography';
import {
  ensureImportRunsWithClient,
  IMPORT_RUNS_MIGRATION
} from './runtime-migrations/v11-import-runs';
import {
  ensureGeospatialLayers,
  GEOSPATIAL_LAYERS_MIGRATION
} from './runtime-migrations/v12-geospatial-layers';
import {
  ensureGeospatialPolish,
  GEOSPATIAL_POLISH_MIGRATION
} from './runtime-migrations/v13-geospatial-polish';
import { MaintenanceCoordinator } from './maintenance-coordinator.service';
import { OperationalLogService } from './operational-log.service';
import {
  addColumnIfTableExists,
  assertForeignKeyIntegrity,
  ensureAuditLogs,
  ensureBudgetModule,
  ensureConfiguracoesSingleton,
  ensureContatos,
  ensureCoreTables,
  ensureDocumentoCategorias,
  ensureDocumentos,
  ensureOpportunityCRM,
  ensureProjectSpecializedTables,
  ensureTarefasShape
} from './runtime-migrations/v1-legacy-schema';

const dbPath = process.env.GEOGESTOR_DB_PATH || path.resolve(__dirname, '../../../../data/geogestor.db');
const RUNTIME_MIGRATION_VERSION = GEOSPATIAL_POLISH_MIGRATION.version;
const RUNTIME_MIGRATION_NAME = GEOSPATIAL_POLISH_MIGRATION.name;
const MIN_FREE_SPACE_BYTES = 64 * 1024 * 1024;

export async function ensureRuntimeMigrations() {
  await runRuntimeMigrations();
}

async function fixBrokenForeignKeys(client: Client) {
  const res = await client.execute("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND sql LIKE '%__old_push%'");
  for (const row of res.rows) {
    if (row.name === 'parcelas') {
      const before = await client.execute('SELECT COUNT(*) AS total FROM parcelas');
      await client.execute('DROP TABLE IF EXISTS parcelas_runtime_migration');
      await client.execute("CREATE TABLE parcelas_runtime_migration (`id` text PRIMARY KEY NOT NULL, `orcamento_id` text NOT NULL, `valor` integer NOT NULL, `data_vencimento` text NOT NULL, `status_pagamento` text DEFAULT 'Pendente' NOT NULL, `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL, `data_pagamento` text, FOREIGN KEY (`orcamento_id`) REFERENCES `orcamentos`(`id`) ON UPDATE no action ON DELETE no action);");
      await client.execute('INSERT INTO parcelas_runtime_migration SELECT id, orcamento_id, valor, data_vencimento, status_pagamento, created_at, updated_at, data_pagamento FROM parcelas;');
      const after = await client.execute('SELECT COUNT(*) AS total FROM parcelas_runtime_migration');
      if (Number(before.rows[0]?.total ?? 0) !== Number(after.rows[0]?.total ?? 0)) {
        throw new Error('A reconstrução de parcelas foi interrompida porque a contagem de registros divergiu.');
      }
      await client.execute('DROP TABLE parcelas;');
      await client.execute('ALTER TABLE parcelas_runtime_migration RENAME TO parcelas;');
    }
  }
}

function firstColumnValue(row: Record<string, unknown> | undefined) {
  return row ? Object.values(row)[0] : undefined;
}

async function assertDatabasePreflight(client: Client) {
  const quickCheck = await client.execute('PRAGMA quick_check;');
  if (String(firstColumnValue(quickCheck.rows[0] as Record<string, unknown> | undefined)) !== 'ok') {
    throw new Error('A migração foi interrompida porque o quick_check do SQLite não foi aprovado.');
  }

  const foreignKeys = await client.execute('PRAGMA foreign_key_check;');
  if (foreignKeys.rows.length > 0) {
    throw new Error(`A migração foi interrompida porque existem ${foreignKeys.rows.length} vínculo(s) inválido(s).`);
  }

  try {
    const [databaseStats, fileSystemStats] = await Promise.all([
      fs.stat(dbPath),
      fs.statfs(path.dirname(dbPath))
    ]);
    const availableBytes = Number(fileSystemStats.bavail) * Number(fileSystemStats.bsize);
    const requiredBytes = Math.max(MIN_FREE_SPACE_BYTES, databaseStats.size * 3);
    if (availableBytes < requiredBytes) {
      throw new Error(`Espaço livre insuficiente para migrar com segurança. Necessário: ${requiredBytes} bytes; disponível: ${availableBytes} bytes.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

async function ensureMigrationLedger(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'recovered')),
      backup_path TEXT,
      error_message TEXT,
      started_at TEXT NOT NULL,
      applied_at TEXT,
      updated_at TEXT NOT NULL
    )
  `);
}

async function createPreMigrationBackup(client: Client) {
  const tables = await client.execute(`
    SELECT COUNT(*) AS total
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name <> 'schema_migrations'
  `);
  if (Number(tables.rows[0]?.total ?? 0) === 0) return null;

  const backupDirectory = path.join(path.dirname(dbPath), 'migration-backups');
  await fs.mkdir(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDirectory, `before-schema-v${RUNTIME_MIGRATION_VERSION}-${timestamp}.db`);
  cloneDatabaseEncryptedSync(dbPath, backupPath);

  const backupClient = createClient(databaseClientConfig(backupPath));
  try {
    const quickCheck = await backupClient.execute('PRAGMA quick_check;');
    const foreignKeys = await backupClient.execute('PRAGMA foreign_key_check;');
    if (String(firstColumnValue(quickCheck.rows[0] as Record<string, unknown> | undefined)) !== 'ok' || foreignKeys.rows.length > 0) {
      throw new Error('O snapshot pré-migração não passou nas verificações de integridade.');
    }
  } finally {
    await backupClient.close();
  }
  return backupPath;
}

function legacyRowId(kind: 'item' | 'expense', budgetId: string, index: number) {
  return crypto.createHash('sha256')
    .update(`geogestor:${kind}:v1:${budgetId}:${index}`)
    .digest('hex');
}

function asFiniteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function migrateLegacyBudgetJson(client: Client) {
  const orcamentosWithJson = await client.execute(`
    SELECT id, itens_json, despesas_json
    FROM orcamentos
    WHERE (itens_json IS NOT NULL AND trim(itens_json) <> '')
       OR (despesas_json IS NOT NULL AND trim(despesas_json) <> '')
  `);

  for (const budget of orcamentosWithJson.rows) {
    const budgetId = String(budget.id);
    let rawItems: unknown[] = [];
    let rawExpenses: unknown[] = [];
    try {
      rawItems = typeof budget.itens_json === 'string' && budget.itens_json.trim() !== ''
        ? JSON.parse(budget.itens_json)
        : [];
      rawExpenses = typeof budget.despesas_json === 'string' && budget.despesas_json.trim() !== ''
        ? JSON.parse(budget.despesas_json)
        : [];
    } catch {
      throw new Error(`O orçamento ${budgetId} contém JSON legado inválido e não pode ser migrado automaticamente.`);
    }
    if (!Array.isArray(rawItems) || !Array.isArray(rawExpenses)) {
      throw new Error(`O orçamento ${budgetId} contém estrutura legada inválida.`);
    }

    const expectedItemIds = new Set<string>();
    const expectedItemTuples = new Set<string>();
    for (const [index, raw] of rawItems.entries()) {
      const item = (raw ?? {}) as Record<string, unknown>;
      const id = legacyRowId('item', budgetId, index);
      const descricao = String(item.descricao || 'Item Sem Descrição');
      const quantidade = asFiniteNumber(item.quantidade, 1);
      const valorUnitario = asFiniteNumber(item.valorUnitario, 0);
      const total = asFiniteNumber(item.total, quantidade * valorUnitario);
      expectedItemIds.add(id);
      expectedItemTuples.add(JSON.stringify([descricao, quantidade, valorUnitario, total]));
      await client.execute({
        sql: `INSERT INTO orcamento_itens (id, orcamento_id, descricao, quantidade, valor_unitario, total)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            descricao = excluded.descricao,
            quantidade = excluded.quantidade,
            valor_unitario = excluded.valor_unitario,
            total = excluded.total,
            updated_at = CURRENT_TIMESTAMP`,
        args: [id, budgetId, descricao, quantidade, valorUnitario, total]
      });
    }

    const currentItems = await client.execute({
      sql: 'SELECT id, descricao, quantidade, valor_unitario, total FROM orcamento_itens WHERE orcamento_id = ?',
      args: [budgetId]
    });
    for (const row of currentItems.rows) {
      const tuple = JSON.stringify([String(row.descricao), Number(row.quantidade), Number(row.valor_unitario), Number(row.total)]);
      if (!expectedItemIds.has(String(row.id)) && expectedItemTuples.has(tuple)) {
        await client.execute({ sql: 'DELETE FROM orcamento_itens WHERE id = ?', args: [String(row.id)] });
      }
    }

    const expectedExpenseIds = new Set<string>();
    const expectedExpenseTuples = new Set<string>();
    for (const [index, raw] of rawExpenses.entries()) {
      const expense = (raw ?? {}) as Record<string, unknown>;
      const id = legacyRowId('expense', budgetId, index);
      const descricao = String(expense.descricao || 'Despesa Sem Descrição');
      const valor = asFiniteNumber(expense.valor, 0);
      expectedExpenseIds.add(id);
      expectedExpenseTuples.add(JSON.stringify([descricao, valor]));
      await client.execute({
        sql: `INSERT INTO orcamento_despesas (id, orcamento_id, descricao, valor)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            descricao = excluded.descricao,
            valor = excluded.valor,
            updated_at = CURRENT_TIMESTAMP`,
        args: [id, budgetId, descricao, valor]
      });
    }

    const currentExpenses = await client.execute({
      sql: 'SELECT id, descricao, valor FROM orcamento_despesas WHERE orcamento_id = ?',
      args: [budgetId]
    });
    for (const row of currentExpenses.rows) {
      const tuple = JSON.stringify([String(row.descricao), Number(row.valor)]);
      if (!expectedExpenseIds.has(String(row.id)) && expectedExpenseTuples.has(tuple)) {
        await client.execute({ sql: 'DELETE FROM orcamento_despesas WHERE id = ?', args: [String(row.id)] });
      }
    }

    await client.execute({
      sql: 'UPDATE orcamentos SET itens_json = NULL, despesas_json = NULL WHERE id = ?',
      args: [budgetId]
    });
  }
}

async function isCurrentMigrationApplied(client: Client) {
  const ledger = await client.execute(`
    SELECT 1
    FROM sqlite_master
    WHERE type = 'table' AND name = 'schema_migrations'
    LIMIT 1
  `);
  if (ledger.rows.length === 0) return false;

  const [migration, userVersion, successfulMigrations] = await Promise.all([
    client.execute({
      sql: 'SELECT status FROM schema_migrations WHERE version = ?',
      args: [RUNTIME_MIGRATION_VERSION]
    }),
    client.execute('PRAGMA user_version;'),
    client.execute({
      sql: `SELECT COUNT(DISTINCT version) AS total FROM schema_migrations
        WHERE version BETWEEN 1 AND ? AND status = 'success'`,
      args: [RUNTIME_MIGRATION_VERSION]
    })
  ]);

  return migration.rows[0]?.status === 'success'
    && Number(userVersion.rows[0]?.user_version ?? 0) === RUNTIME_MIGRATION_VERSION
    && Number(successfulMigrations.rows[0]?.total ?? 0) === RUNTIME_MIGRATION_VERSION;
}

async function executeRuntimeMigrations() {
  const startedAtMs = performance.now();
  const client = createClient(databaseClientConfig(dbPath));
  let transactionStarted = false;
  let migrationLedgerReady = false;
  let backupPath: string | null = null;

  try {
    await client.execute('PRAGMA journal_mode = WAL;');
    await client.execute('PRAGMA busy_timeout = 5000;');
    await client.execute('PRAGMA foreign_keys = ON;');
    if (await isCurrentMigrationApplied(client)) {
      await OperationalLogService.info('runtime-migration-completed', {
        durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
        fastPath: true,
        schemaVersion: RUNTIME_MIGRATION_VERSION
      });
      return { fastPath: true, schemaVersion: RUNTIME_MIGRATION_VERSION };
    }

    await assertDatabasePreflight(client);
    await ensureMigrationLedger(client);
    migrationLedgerReady = true;

    // Um ledger superior pode existir apesar de uma versÃ£o intermediÃ¡ria ausente.
    // Todo desvio do conjunto oficial recebe snapshot antes de qualquer correÃ§Ã£o.
    backupPath = await createPreMigrationBackup(client);

    const startedAt = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'running', ?, NULL, ?, NULL, ?)
        ON CONFLICT(version) DO UPDATE SET
          name = excluded.name,
          status = 'running',
          backup_path = COALESCE(excluded.backup_path, schema_migrations.backup_path),
          error_message = NULL,
          started_at = excluded.started_at,
          updated_at = excluded.updated_at`,
      args: [RUNTIME_MIGRATION_VERSION, RUNTIME_MIGRATION_NAME, backupPath, startedAt, startedAt]
    });
    await client.execute({
      sql: `INSERT INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'running', ?, NULL, ?, NULL, ?)
        ON CONFLICT(version) DO UPDATE SET
          name = excluded.name,
          status = 'running',
          backup_path = COALESCE(excluded.backup_path, schema_migrations.backup_path),
          error_message = NULL,
          started_at = excluded.started_at,
          updated_at = excluded.updated_at`,
      args: [IMPORT_RUNS_MIGRATION.version, IMPORT_RUNS_MIGRATION.name, backupPath, startedAt, startedAt]
    });

    await client.execute('BEGIN IMMEDIATE;');
    transactionStarted = true;

    await fixBrokenForeignKeys(client);

    await ensureCoreTables(client);
    // Bancos das primeiras versões não possuíam a tabela de contatos. Ela precisa
    // existir antes de reconstruirmos oportunidades com o vínculo opcional de lead.
    await ensureContatos(client);
    await ensureOpportunityCRM(client);

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
    await addColumnIfTableExists(client, 'clientes', 'tipo_pessoa', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'rg', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'inscricao_estadual', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'celular_whatsapp', 'INTEGER DEFAULT 0');
    await addColumnIfTableExists(client, 'clientes', 'sem_numero', 'INTEGER DEFAULT 0');
    await addColumnIfTableExists(client, 'clientes', 'complemento', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'municipio', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'uf', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'cep', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'origem_principal', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'origem_detalhe', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'indicado_por', 'TEXT');
    await addColumnIfTableExists(client, 'clientes', 'perfis', 'TEXT');

    // Migração aditiva: os campos legados permanecem intactos e alimentam os novos campos.
    await client.execute(`
      UPDATE clientes
      SET tipo_pessoa = CASE
        WHEN coalesce(cnpj, '') <> ''
          OR categoria LIKE '%Pessoa Jurídica%'
          OR categoria LIKE '%Empresa%'
          OR length(replace(replace(replace(replace(coalesce(documento, ''), '.', ''), '/', ''), '-', ''), ' ', '')) = 14
        THEN 'PJ'
        ELSE 'PF'
      END
      WHERE tipo_pessoa IS NULL OR tipo_pessoa = ''
    `);
    await client.execute(`
      UPDATE clientes
      SET origem_principal = CASE
        WHEN trim(substr(origem, 1, CASE WHEN instr(origem, ',') > 0 THEN instr(origem, ',') - 1 ELSE length(origem) END))
          IN ('Site', 'Indicação', 'Instagram', 'Google', 'WhatsApp', 'Outro')
        THEN trim(substr(origem, 1, CASE WHEN instr(origem, ',') > 0 THEN instr(origem, ',') - 1 ELSE length(origem) END))
        ELSE 'Outro'
      END,
      origem_detalhe = CASE
        WHEN origem IS NOT NULL AND origem <> ''
          AND trim(substr(origem, 1, CASE WHEN instr(origem, ',') > 0 THEN instr(origem, ',') - 1 ELSE length(origem) END))
            NOT IN ('Site', 'Indicação', 'Instagram', 'Google', 'WhatsApp', 'Outro')
        THEN origem
        ELSE origem_detalhe
      END
      WHERE (origem_principal IS NULL OR origem_principal = '') AND origem IS NOT NULL AND origem <> ''
    `);

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

    await ensureProjectSpecializedTables(client);

    await addColumnIfTableExists(client, 'compromissos', 'google_event_id', 'TEXT');
    await addColumnIfTableExists(client, 'compromissos', 'ultimo_sync_google', 'TEXT');
    await addColumnIfTableExists(client, 'compromissos', 'hora', 'TEXT');

    await addColumnIfTableExists(client, 'orcamentos', 'projeto_id', 'TEXT');
    await addColumnIfTableExists(client, 'orcamentos', 'itens_json', 'TEXT');
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
    await ensureFilesystemOperations(client);
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
    await ensureClientDocumentIntegrity(client);

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

    await migrateLegacyBudgetJson(client);

    await ensureBudgetModule(client);
    await ensureManagerialFinance(client);
    await ensureStrategicPlanning(client);
    await ensureStrategicGovernance(client);
    await ensureOperationalIntegrity(client);
    await ensureUnifiedAlerts(client);
    await ensureClientWorkspaceIntegrity(client);
    await ensurePropertyGeography(client);
    await ensureImportRunsWithClient(client);
    await ensureGeospatialLayers(client);
    await ensureGeospatialPolish(client);

    // Após migrar, os campos originais poderiam ser descartados, mas o SQLite não permite DROP COLUMN facilmente.
    // Vamos apenas deixá-los null ou ignora-los nas queries futuras.

    // Índices de otimização para chaves estrangeiras e filtros frequentes
    await client.execute('CREATE INDEX IF NOT EXISTS idx_clientes_active_created_at ON clientes(created_at DESC) WHERE deleted_at IS NULL;');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_projetos_cliente_status_data ON projetos(cliente_id, status, data_entrega);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_orcamentos_cliente_projeto_status ON orcamentos(cliente_id, projeto_id, status, data_competencia);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_parcelas_orcamento_status_data ON parcelas(orcamento_id, status_pagamento, data_vencimento);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_despesas_cliente_projeto_status ON despesas(cliente_id, projeto_id, status, data, categoria);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_tarefas_cliente_projeto_status ON tarefas(cliente_id, projeto_id, status, data_limite);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_interacoes_cliente_data ON interacoes_cliente(cliente_id, data);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_documentos_cliente_projeto_cat ON documentos(cliente_id, projeto_id, categoria_id, caminho);');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_reports_projetos_periodo ON projetos(data_inicio, created_at) WHERE deleted_at IS NULL;');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_reports_orcamentos_periodo ON orcamentos(data_competencia, data_emissao, data_orcamento, created_at) WHERE deleted_at IS NULL;');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_reports_orcamentos_pagamento ON orcamentos(data_pagamento) WHERE deleted_at IS NULL;');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_reports_parcelas_periodo ON parcelas(data_competencia, data_vencimento, data_pagamento, orcamento_id) WHERE deleted_at IS NULL AND cancelada_em IS NULL;');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_reports_recebimentos_periodo ON recebimentos(data_recebimento, parcela_id) WHERE deleted_at IS NULL AND estornado_em IS NULL;');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_reports_despesas_periodo ON despesas(data_pagamento, data_competencia, data) WHERE deleted_at IS NULL AND cancelada_em IS NULL AND estornada_em IS NULL;');
    await assertForeignKeyIntegrity(client);
    const appliedAt = new Date().toISOString();
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (1, 'backend-hardening-2026-07-21', 'success', NULL, NULL, ?, ?, ?)`,
      args: [appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'success', NULL, NULL, ?, ?, ?)`,
      args: [FILESYSTEM_OUTBOX_MIGRATION.version, FILESYSTEM_OUTBOX_MIGRATION.name, appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'success', NULL, NULL, ?, ?, ?)`,
      args: [CLIENT_DOCUMENT_INTEGRITY_MIGRATION.version, CLIENT_DOCUMENT_INTEGRITY_MIGRATION.name, appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'success', NULL, NULL, ?, ?, ?)`,
      args: [MANAGERIAL_FINANCE_MIGRATION.version, MANAGERIAL_FINANCE_MIGRATION.name, appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'success', NULL, NULL, ?, ?, ?)`,
      args: [STRATEGIC_PLANNING_MIGRATION.version, STRATEGIC_PLANNING_MIGRATION.name, appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'success', NULL, NULL, ?, ?, ?)`,
      args: [STRATEGIC_GOVERNANCE_MIGRATION.version, STRATEGIC_GOVERNANCE_MIGRATION.name, appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'success', NULL, NULL, ?, ?, ?)`,
      args: [OPERATIONAL_INTEGRITY_MIGRATION.version, OPERATIONAL_INTEGRITY_MIGRATION.name, appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'success', NULL, NULL, ?, ?, ?)`,
      args: [UNIFIED_ALERTS_MIGRATION.version, UNIFIED_ALERTS_MIGRATION.name, appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'success', NULL, NULL, ?, ?, ?)`,
      args: [CLIENT_WORKSPACE_INTEGRITY_MIGRATION.version, CLIENT_WORKSPACE_INTEGRITY_MIGRATION.name, appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'success', NULL, NULL, ?, ?, ?)`,
      args: [PROPERTY_GEOGRAPHY_MIGRATION.version, PROPERTY_GEOGRAPHY_MIGRATION.name, appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'success', NULL, NULL, ?, ?, ?)`,
      args: [IMPORT_RUNS_MIGRATION.version, IMPORT_RUNS_MIGRATION.name, appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO schema_migrations (
          version, name, status, backup_path, error_message, started_at, applied_at, updated_at
        ) VALUES (?, ?, 'success', NULL, NULL, ?, ?, ?)`,
      args: [GEOSPATIAL_LAYERS_MIGRATION.version, GEOSPATIAL_LAYERS_MIGRATION.name, appliedAt, appliedAt, appliedAt]
    });
    await client.execute({
      sql: `UPDATE schema_migrations
        SET status = 'success', error_message = NULL, applied_at = ?, updated_at = ?
        WHERE version IN (1, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        appliedAt,
        appliedAt,
        FILESYSTEM_OUTBOX_MIGRATION.version,
        CLIENT_DOCUMENT_INTEGRITY_MIGRATION.version,
        MANAGERIAL_FINANCE_MIGRATION.version,
        STRATEGIC_PLANNING_MIGRATION.version,
        STRATEGIC_GOVERNANCE_MIGRATION.version,
        OPERATIONAL_INTEGRITY_MIGRATION.version,
        UNIFIED_ALERTS_MIGRATION.version,
        CLIENT_WORKSPACE_INTEGRITY_MIGRATION.version
      ]
    });
    await client.execute({
      sql: `UPDATE schema_migrations
        SET status = 'success', error_message = NULL, applied_at = ?, updated_at = ?
        WHERE version = ?`,
      args: [appliedAt, appliedAt, RUNTIME_MIGRATION_VERSION]
    });
    await client.execute({
      sql: `UPDATE schema_migrations
        SET status = 'success', error_message = NULL, applied_at = ?, updated_at = ?
        WHERE version = ?`,
      args: [appliedAt, appliedAt, PROPERTY_GEOGRAPHY_MIGRATION.version]
    });
    await client.execute({
      sql: `UPDATE schema_migrations
        SET status = 'success', error_message = NULL, applied_at = ?, updated_at = ?
        WHERE version = ?`,
      args: [appliedAt, appliedAt, IMPORT_RUNS_MIGRATION.version]
    });
    await client.execute({
      sql: `UPDATE schema_migrations
        SET status = 'success', error_message = NULL, applied_at = ?, updated_at = ?
        WHERE version = ?`,
      args: [appliedAt, appliedAt, GEOSPATIAL_LAYERS_MIGRATION.version]
    });
    await client.execute(`PRAGMA user_version = ${RUNTIME_MIGRATION_VERSION};`);
    await client.execute('COMMIT;');
    transactionStarted = false;
    await OperationalLogService.info('runtime-migration-completed', {
      durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
      fastPath: false,
      schemaVersion: RUNTIME_MIGRATION_VERSION
    });
    return { fastPath: false, schemaVersion: RUNTIME_MIGRATION_VERSION };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.execute('ROLLBACK;');
      } catch {
        // SQLite also rolls back an open transaction when the connection closes.
      }
      transactionStarted = false;
    }
    if (migrationLedgerReady) {
      const failedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Falha desconhecida na migração';
      try {
        for (const version of [IMPORT_RUNS_MIGRATION.version, RUNTIME_MIGRATION_VERSION]) {
          await client.execute({
            sql: `UPDATE schema_migrations
              SET status = 'failed', error_message = ?, updated_at = ?
              WHERE version = ? AND status = 'running'`,
            args: [message, failedAt, version]
          });
        }
      } catch {
        // A falha original é mais relevante; o próximo preflight reavaliará o banco.
      }
    }
    await OperationalLogService.warn('runtime-migration-failed', {
      durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
      schemaVersion: RUNTIME_MIGRATION_VERSION,
      error
    });
    throw error;
  } finally {
    await client.close();
  }
}

export function runRuntimeMigrations() {
  return MaintenanceCoordinator.runExclusive('migration', executeRuntimeMigrations);
}
