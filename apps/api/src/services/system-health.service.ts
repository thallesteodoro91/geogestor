import crypto from 'node:crypto';
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { databaseClientConfig, schema } from '@geogestor/database';
import { db } from '../db';
import { FileSystemOutboxService } from './filesystem-outbox.service';
import { OperationalLogService } from './operational-log.service';
import { PerformanceMetricsService } from './performance-metrics.service';
import { MaintenanceHistoryService } from './maintenance-history.service';

type HealthFileSystem = Pick<typeof fs, 'stat' | 'access' | 'writeFile' | 'rm'>;

export type FilesDirectoryDiagnosticCode =
  | 'ok'
  | 'not_configured'
  | 'directory_missing'
  | 'permission_denied'
  | 'operation_not_permitted'
  | 'invalid_path'
  | 'drive_unavailable'
  | 'temporarily_unavailable'
  | 'unexpected_error';

type FilesDirectoryDiagnostic = {
  status: 'ok' | 'not_configured' | 'failed';
  code: FilesDirectoryDiagnosticCode;
  guidance: string;
};

const GUIDANCE: Record<FilesDirectoryDiagnosticCode, string> = {
  ok: 'A pasta de documentos está disponível para leitura e gravação.',
  not_configured: 'Configure uma pasta de documentos quando o armazenamento de arquivos for necessário.',
  directory_missing: 'Verifique a pasta configurada e crie-a manualmente dentro do local autorizado.',
  permission_denied: 'Conceda ao usuário atual permissão de leitura e gravação na pasta configurada.',
  operation_not_permitted: 'Verifique as políticas de segurança do Windows ou escolha uma pasta autorizada.',
  invalid_path: 'Revise a configuração e informe um caminho de pasta válido.',
  drive_unavailable: 'Reconecte ou disponibilize a unidade configurada e tente novamente.',
  temporarily_unavailable: 'Aguarde a liberação da pasta ou unidade e tente novamente.',
  unexpected_error: 'Revise a configuração da pasta e consulte o diagnóstico técnico antes de tentar novamente.'
};

function databasePath() {
  return process.env.GEOGESTOR_DB_PATH || path.resolve(__dirname, '../../../../data/geogestor.db');
}

function firstValue(row: Record<string, unknown> | undefined) {
  return row ? Object.values(row)[0] : undefined;
}

function result(code: FilesDirectoryDiagnosticCode): FilesDirectoryDiagnostic {
  return {
    status: code === 'ok' ? 'ok' : code === 'not_configured' ? 'not_configured' : 'failed',
    code,
    guidance: GUIDANCE[code]
  };
}

const relationshipQueries: Record<string, string> = {
  projectsWithForeignProperty: `SELECT COUNT(*) AS total FROM projetos p JOIN propriedades i ON i.id = p.propriedade_id WHERE p.deleted_at IS NULL AND i.cliente_id <> p.cliente_id`,
  budgetsWithForeignProject: `SELECT COUNT(*) AS total FROM orcamentos o JOIN projetos p ON p.id = o.projeto_id WHERE o.deleted_at IS NULL AND p.cliente_id <> o.cliente_id`,
  budgetsWithForeignProperty: `SELECT COUNT(*) AS total FROM orcamentos o JOIN propriedades i ON i.id = o.propriedade_id WHERE o.deleted_at IS NULL AND i.cliente_id <> o.cliente_id`,
  approvedBudgetsWithoutProject: `SELECT COUNT(*) AS total FROM orcamentos WHERE deleted_at IS NULL AND lower(status) IN ('aprovado', 'pago') AND projeto_id IS NULL`,
  approvedBudgetsWithoutInstallments: `SELECT COUNT(*) AS total FROM orcamentos o WHERE o.deleted_at IS NULL AND lower(o.status) IN ('aprovado', 'pago') AND NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.orcamento_id = o.id AND p.deleted_at IS NULL)`,
  tasksWithForeignProject: `SELECT COUNT(*) AS total FROM tarefas t JOIN projetos p ON p.id = t.projeto_id WHERE t.deleted_at IS NULL AND t.cliente_id <> p.cliente_id`,
  appointmentsWithForeignProject: `SELECT COUNT(*) AS total FROM compromissos c JOIN projetos p ON p.id = c.projeto_id WHERE c.deleted_at IS NULL AND c.cliente_id <> p.cliente_id`,
  expensesWithForeignProject: `SELECT COUNT(*) AS total FROM despesas d JOIN projetos p ON p.id = d.projeto_id WHERE d.deleted_at IS NULL AND d.cliente_id <> p.cliente_id`,
  documentsWithForeignProject: `SELECT COUNT(*) AS total FROM documentos d JOIN projetos p ON p.id = d.projeto_id WHERE d.deleted_at IS NULL AND d.cliente_id <> p.cliente_id`,
  licensesWithForeignProject: `SELECT COUNT(*) AS total FROM licencas l JOIN projetos p ON p.id = l.projeto_id WHERE l.deleted_at IS NULL AND l.cliente_id IS NOT NULL AND l.cliente_id <> p.cliente_id`,
  environmentalWithForeignProject: `SELECT COUNT(*) AS total FROM ambiental a JOIN projetos p ON p.id = a.projeto_id WHERE a.deleted_at IS NULL AND a.cliente_id IS NOT NULL AND a.cliente_id <> p.cliente_id`,
  assessmentsWithForeignProject: `SELECT COUNT(*) AS total FROM pericias a JOIN projetos p ON p.id = a.projeto_id WHERE a.deleted_at IS NULL AND a.cliente_id IS NOT NULL AND a.cliente_id <> p.cliente_id`,
  opportunitiesWithForeignBudget: `SELECT COUNT(*) AS total FROM oportunidades op JOIN orcamentos o ON o.id = op.orcamento_id WHERE op.deleted_at IS NULL AND op.cliente_id <> o.cliente_id`,
  opportunitiesWithForeignProject: `SELECT COUNT(*) AS total FROM oportunidades op JOIN projetos p ON p.id = op.projeto_id WHERE op.deleted_at IS NULL AND op.cliente_id <> p.cliente_id`
};

function classifyFileSystemError(error: unknown): FilesDirectoryDiagnosticCode {
  const code = (error as NodeJS.ErrnoException | undefined)?.code || '';
  if (code === 'ENOENT') return 'directory_missing';
  if (code === 'EACCES') return 'permission_denied';
  if (code === 'EPERM') return 'operation_not_permitted';
  if (['EINVAL', 'ENAMETOOLONG', 'ENOTDIR'].includes(code)) return 'invalid_path';
  if (['ENODEV', 'ENXIO', 'ERROR_NOT_READY'].includes(code)) return 'drive_unavailable';
  if (['EAGAIN', 'EBUSY', 'ETIMEDOUT', 'EMFILE', 'ENFILE', 'EIO'].includes(code)) return 'temporarily_unavailable';
  return 'unexpected_error';
}

const DIAGNOSTIC_SENSITIVE_KEY = /(senha|password|secret|token|credential|authorization|cookie|client.?id|user.?id|email|e-mail|telefone|celular|cpf|cnpj|documento|endereco|address|cep|nome|name|owner|arquivo|filename|path|pasta|directory|folder|^cliente$|^usu[aá]rio$|^user$)/i;
const DIAGNOSTIC_MAX_DEPTH = 6;
const DIAGNOSTIC_MAX_ARRAY_ITEMS = 100;
const DIAGNOSTIC_MAX_OBJECT_KEYS = 200;
const DIAGNOSTIC_MAX_TEXT_LENGTH = 2_000;

export function sanitizeDiagnosticValue(value: unknown, key = '', depth = 0): unknown {
  if (depth > DIAGNOSTIC_MAX_DEPTH) return '[MAX_DEPTH]';
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (DIAGNOSTIC_SENSITIVE_KEY.test(key)) return '[REDACTED]';
    return value
      .replace(/(bearer\s+|token[=:]\s*|secret[=:]\s*|password[=:]\s*)[^\s&,]+/gi, '$1[REDACTED]')
      .replace(/(?:[A-Za-z]:\\|\\\\)[^\r\n,;]*/g, '[REDACTED_PATH]')
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[REDACTED_CPF]')
      .replace(/\b\d{2}\.?\d{3}\.?\d{3}[/]?\d{4}-?\d{2}\b/g, '[REDACTED_CNPJ]')
      .replace(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_PHONE]')
      .replace(/\b\d{5}-?\d{3}\b/g, '[REDACTED_CEP]')
      .replace(/\b(?:rua|avenida|av\.?|rodovia|estrada|travessa)\s+[^,;\r\n]+/gi, '[REDACTED_ADDRESS]')
      .replace(/\b(?:nome|cliente|usu[aá]rio|user)\s*[=:]\s*[^,;\r\n]+/gi, '[REDACTED_NAME]')
      .replace(/\b[^\s\\/]+\.(?:db|sqlite3?|pdf|docx?|xlsx?|zip|log|json)\b/gi, '[REDACTED_FILE]')
      .slice(0, DIAGNOSTIC_MAX_TEXT_LENGTH);
  }
  if (Array.isArray(value)) return value.slice(0, DIAGNOSTIC_MAX_ARRAY_ITEMS).map((item) => sanitizeDiagnosticValue(item, key, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, DIAGNOSTIC_MAX_OBJECT_KEYS).map(([childKey, childValue]) => [
      childKey,
      sanitizeDiagnosticValue(childValue, childKey, depth + 1)
    ]));
  }
  return String(value).slice(0, DIAGNOSTIC_MAX_TEXT_LENGTH);
}

export function buildSafeDiagnosticHealth(health: Awaited<ReturnType<typeof SystemHealthService.inspect>>) {
  const operationSummary = Object.fromEntries(Object.entries(health.operations).map(([component, state]) => [
    component,
    { status: state.status, updatedAt: state.updatedAt }
  ]));
  return sanitizeDiagnosticValue({
    status: health.status,
    checkedAt: health.checkedAt,
    checks: health.checks,
    operations: operationSummary,
    performance: health.performance,
    logging: health.logging
  });
}

export class SystemHealthService {
  private static fileSystem: HealthFileSystem = fs;

  static async inspect() {
    const checkedAt = new Date().toISOString();
    const dbPath = path.resolve(databasePath());
    const dataDirectory = path.dirname(dbPath);
    let filesystemOperations: Record<string, number> = {};
    let filesystemOperationsAvailable = true;
    try {
      filesystemOperations = await FileSystemOutboxService.getSummary();
    } catch {
      filesystemOperationsAvailable = false;
    }
    const checks = {
      database: 'failed' as 'ok' | 'failed',
      dataDirectoryWritable: false,
      filesDirectoryWritable: null as boolean | null,
      filesDirectory: result('not_configured'),
      filesystemOperations,
      filesystemOperationsAvailable,
      foreignKeyViolations: 0,
      relationshipChecksAvailable: true,
      relationshipViolations: {} as Record<string, number>,
      schemaVersion: 0,
      entityCounts: {} as Record<string, number>,
      residualMigrationTables: [] as string[]
    };

    const client = createClient(databaseClientConfig(dbPath));
    try {
      const databaseCheck = await client.execute('PRAGMA quick_check;');
      checks.database = String(firstValue(databaseCheck.rows[0] as Record<string, unknown> | undefined)) === 'ok' ? 'ok' : 'failed';
      checks.foreignKeyViolations = (await client.execute('PRAGMA foreign_key_check;')).rows.length;
      const versionResult = await client.execute('PRAGMA user_version;');
      checks.schemaVersion = Number(firstValue(versionResult.rows[0] as Record<string, unknown> | undefined) || 0);
      for (const table of ['clientes', 'projetos', 'propriedades', 'orcamentos', 'parcelas', 'recebimentos', 'despesas', 'documentos', 'tarefas', 'compromissos']) {
        try {
          const countResult = await client.execute(`SELECT COUNT(*) AS total FROM ${table}`);
          checks.entityCounts[table] = Number(countResult.rows[0]?.total || 0);
        } catch (error) {
          if (!/no such table/i.test(error instanceof Error ? error.message : String(error))) throw error;
        }
      }
      const residual = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '__new_%' OR name LIKE '%_runtime_migration')");
      checks.residualMigrationTables = residual.rows.map((row) => String(row.name));
      for (const [name, query] of Object.entries(relationshipQueries)) {
        try {
          const queryResult = await client.execute(query);
          checks.relationshipViolations[name] = Number(queryResult.rows[0]?.total || 0);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!/no such table|no such column/i.test(message)) throw error;
          checks.relationshipChecksAvailable = false;
        }
      }
    } finally {
      await client.close();
    }

    const probe = path.join(dataDirectory, `.health-${crypto.randomUUID()}.tmp`);
    try {
      await this.fileSystem.writeFile(probe, 'ok', { encoding: 'utf8', flag: 'wx' });
      checks.dataDirectoryWritable = true;
    } catch {
      checks.dataDirectoryWritable = false;
    } finally {
      await this.fileSystem.rm(probe, { force: true }).catch(() => undefined);
    }

    checks.filesDirectory = await this.inspectFilesDirectory();
    checks.filesDirectoryWritable = checks.filesDirectory.code === 'not_configured'
      ? null
      : checks.filesDirectory.code === 'ok';

    const failedOperations = Number(checks.filesystemOperations.failed || 0);
    const relationshipViolationCount = Object.values(checks.relationshipViolations)
      .reduce((sum, count) => sum + count, 0);
    return {
      status: checks.database === 'ok'
        && checks.dataDirectoryWritable
        && checks.filesDirectoryWritable !== false
        && failedOperations === 0
        && checks.foreignKeyViolations === 0
        && relationshipViolationCount === 0
        ? 'ok'
        : 'degraded',
      checkedAt,
      checks,
      operations: OperationalLogService.getState(),
      performance: PerformanceMetricsService.snapshot(),
      logging: OperationalLogService.getStatistics()
    };
  }

  static async createDiagnosticSnapshot() {
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();
    const health = await this.inspect();
    const directory = path.join(path.dirname(path.resolve(databasePath())), 'diagnostics');
    await fs.mkdir(directory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(directory, `geogestor-diagnostic-${timestamp}.json`);
    const temporary = `${target}.pending`;
    const snapshot = {
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      application: 'GeoGestor Desktop',
      applicationVersion: process.env.npm_package_version || 'unknown',
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      mode: process.env.NODE_ENV || 'development',
      health: buildSafeDiagnosticHealth(health)
    };
    await fs.writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    await fs.rename(temporary, target);
    await OperationalLogService.info('diagnostic-snapshot-created', { createdAt: snapshot.createdAt });
    await MaintenanceHistoryService.record({
      type: 'diagnostic_export',
      status: 'success',
      startedAt,
      durationMs: Date.now() - startedAtMs,
      sourceLabel: 'diagnóstico local',
      destinationLabel: '[diagnóstico local protegido]',
      files: 1,
      bytes: Buffer.byteLength(JSON.stringify(snapshot), 'utf8'),
      user: 'admin',
      auditId: null,
      details: { redacted: true, formatVersion: snapshot.formatVersion }
    });
    return { path: target, createdAt: snapshot.createdAt, health, summary: this.diagnosticExportSummary() };
  }

  static diagnosticExportSummary() {
    return {
      included: [
        'versão do GeoGestor e ambiente de execução',
        'resultado das verificações de integridade do banco',
        'contagens agregadas de entidades e operações',
        'estado agregado de desempenho e logs'
      ],
      excluded: [
        'credenciais, tokens e segredos',
        'conteúdo de documentos',
        'nomes, e-mails e demais dados pessoais',
        'caminhos completos de arquivos e pastas'
      ],
      format: 'JSON protegido por redação',
      containsPersonalData: false,
      containsCredentials: false
    };
  }

  static configureFileSystemForTests(fileSystem: HealthFileSystem | null) {
    if (process.env.NODE_ENV !== 'test' && !process.env.GEOGESTOR_DB_PATH?.includes('scratch')) {
      throw new Error('O diagnóstico de filesystem só pode ser reconfigurado em ambiente de teste.');
    }
    this.fileSystem = fileSystem || fs;
  }

  private static async inspectFilesDirectory(): Promise<FilesDirectoryDiagnostic> {
    let configuredPath: string | null | undefined;
    try {
      const configs = await db.select({ dadosPasta: schema.configuracoes.dadosPasta })
        .from(schema.configuracoes)
        .limit(1);
      configuredPath = configs[0]?.dadosPasta;
    } catch {
      return result('unexpected_error');
    }
    if (!configuredPath?.trim()) return result('not_configured');

    let directory: string;
    try {
      const expanded = configuredPath.startsWith('~/') || configuredPath.startsWith('~\\')
        ? path.join(os.homedir(), configuredPath.slice(2))
        : configuredPath;
      directory = path.resolve(expanded);
    } catch {
      return result('invalid_path');
    }

    const root = path.parse(directory).root;
    try {
      await this.fileSystem.stat(root);
    } catch (error) {
      const code = classifyFileSystemError(error);
      return result(code === 'directory_missing' ? 'drive_unavailable' : code);
    }

    const probe = path.join(directory, `.health-${crypto.randomUUID()}.tmp`);
    try {
      const stats = await this.fileSystem.stat(directory);
      if (!stats.isDirectory()) return result('invalid_path');
      await this.fileSystem.access(directory, constants.W_OK);
      await this.fileSystem.writeFile(probe, 'ok', { encoding: 'utf8', flag: 'wx' });
      return result('ok');
    } catch (error) {
      return result(classifyFileSystemError(error));
    } finally {
      await this.fileSystem.rm(probe, { force: true }).catch(() => undefined);
    }
  }
}
