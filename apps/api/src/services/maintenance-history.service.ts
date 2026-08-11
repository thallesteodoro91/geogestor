import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type MaintenanceHistoryType =
  | 'backup_database'
  | 'backup_complete'
  | 'restore_test'
  | 'restore'
  | 'data_migration'
  | 'operational_reset'
  | 'integrity_check'
  | 'diagnostic_export';

export type MaintenanceHistoryStatus = 'running' | 'success' | 'failed' | 'cancelled';

export type MaintenanceHistoryEntry = {
  id: string;
  type: MaintenanceHistoryType;
  status: MaintenanceHistoryStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  sourceLabel: string | null;
  destinationLabel: string | null;
  files: number | null;
  bytes: number | null;
  user: string | null;
  error: string | null;
  auditId: string | null;
  details?: Record<string, string | number | boolean | null>;
};

type HistoryInput = Omit<MaintenanceHistoryEntry, 'id' | 'completedAt' | 'durationMs' | 'error'> & {
  id?: string;
  completedAt?: string;
  durationMs?: number;
  error?: unknown;
};

const MAX_ENTRIES = 2_000;

function dataDirectory() {
  const databasePath = process.env.GEOGESTOR_DB_PATH
    ? path.resolve(process.env.GEOGESTOR_DB_PATH)
    : path.resolve(__dirname, '../../../../data/geogestor.db');
  return path.dirname(databasePath);
}

function historyPath() {
  return path.join(dataDirectory(), 'logs', 'maintenance-history.ndjson');
}

function safeLabel(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const normalized = value.trim().replace(/[\r\n\t]+/g, ' ');
  if (/^(?:[A-Za-z]:\\|\\\\|\/)/.test(normalized)) {
    return '[local protegido]';
  }
  return normalized.slice(0, 160);
}

function safeError(value: unknown) {
  if (!value) return null;
  const message = value instanceof Error ? value.message : String(value);
  return message
    .replace(/(bearer\s+|token[=:]\s*|secret[=:]\s*)[^\s&,]+/gi, '$1[REDACTED]')
    .replace(/(?:[A-Za-z]:\\|\\\\)[^\r\n,;]*/g, '[REDACTED_PATH]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 800);
}

function safeDetails(details: HistoryInput['details']) {
  if (!details) return undefined;
  return Object.fromEntries(Object.entries(details).map(([key, value]) => {
    if (/(token|secret|credential|password|authorization|cookie|path|directory|folder|email)/i.test(key)) {
      return [key, '[REDACTED]'];
    }
    if (typeof value === 'string') return [key, safeError(value)];
    return [key, value];
  })) as Record<string, string | number | boolean | null>;
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export class MaintenanceHistoryService {
  static async record(input: HistoryInput) {
    const completedAt = input.completedAt || new Date().toISOString();
    const durationMs = input.durationMs ?? Math.max(0, Date.parse(completedAt) - Date.parse(input.startedAt));
    const entry: MaintenanceHistoryEntry = {
      id: input.id || crypto.randomUUID(),
      type: input.type,
      status: input.status,
      startedAt: input.startedAt,
      completedAt,
      durationMs,
      sourceLabel: safeLabel(input.sourceLabel),
      destinationLabel: safeLabel(input.destinationLabel),
      files: input.files ?? null,
      bytes: input.bytes ?? null,
      user: input.user ? String(input.user).slice(0, 120) : null,
      error: safeError(input.error),
      auditId: input.auditId ? String(input.auditId).slice(0, 120) : null,
      details: safeDetails(input.details)
    };
    const target = historyPath();
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.appendFile(target, `${JSON.stringify(entry)}\n`, 'utf8');
    await this.trimIfNeeded(target);
    return entry;
  }

  static async list(options: { type?: MaintenanceHistoryType; status?: MaintenanceHistoryStatus; limit?: number } = {}) {
    const target = historyPath();
    let raw = '';
    try {
      raw = await fs.readFile(target, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const limit = Math.min(500, Math.max(1, options.limit || 100));
    return raw.split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line) as MaintenanceHistoryEntry; } catch { return null; }
      })
      .filter((entry): entry is MaintenanceHistoryEntry => Boolean(entry))
      .filter((entry) => !options.type || entry.type === options.type)
      .filter((entry) => !options.status || entry.status === options.status)
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .slice(0, limit);
  }

  static async exportCsv(options: { type?: MaintenanceHistoryType; status?: MaintenanceHistoryStatus } = {}) {
    const entries = await this.list({ ...options, limit: 500 });
    const header = ['ID', 'Tipo', 'Resultado', 'Início', 'Término', 'Duração (ms)', 'Origem', 'Destino', 'Arquivos', 'Bytes', 'Usuário', 'Erro', 'Auditoria'];
    const rows = entries.map((entry) => [
      entry.id, entry.type, entry.status, entry.startedAt, entry.completedAt, entry.durationMs,
      entry.sourceLabel, entry.destinationLabel, entry.files, entry.bytes, entry.user, entry.error, entry.auditId
    ]);
    return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(';')).join('\n')}`;
  }

  static getPathForTests() {
    return historyPath();
  }

  private static async trimIfNeeded(target: string) {
    const stats = await fs.stat(target);
    if (stats.size < 5 * 1024 * 1024) return;
    const lines = (await fs.readFile(target, 'utf8')).split(/\r?\n/).filter(Boolean);
    const temporary = `${target}.pending`;
    await fs.writeFile(temporary, `${lines.slice(-MAX_ENTRIES).join('\n')}\n`, 'utf8');
    await fs.rename(temporary, target);
  }
}
