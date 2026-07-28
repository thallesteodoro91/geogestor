import fs from 'node:fs/promises';
import path from 'node:path';

type LogLevel = 'info' | 'warn' | 'error';
type ComponentStatus = 'ok' | 'degraded' | 'failed' | 'running';

type ComponentState = {
  status: ComponentStatus;
  updatedAt: string;
  details?: Record<string, unknown>;
};

type LogRecord = {
  timestamp: string;
  level: LogLevel;
  event: string;
  pid: number;
  data: unknown;
};

type LogFileSystem = Pick<typeof fs, 'mkdir' | 'appendFile' | 'stat' | 'rm' | 'rename' | 'readFile' | 'writeFile'>;

type LogOptions = {
  maxLogBytes: number;
  maxLogFiles: number;
  queueCapacity: number;
  batchSize: number;
  flushIntervalMs: number;
};

const DEFAULT_OPTIONS: LogOptions = {
  maxLogBytes: 5 * 1024 * 1024,
  maxLogFiles: 5,
  queueCapacity: 1_000,
  batchSize: 100,
  flushIntervalMs: 250
};
const SENSITIVE_KEY = /(senha|password|secret|token|cpf|cnpj|documento|email|telefone|celular|endereco|cep|rg|inscricao|authorization|cookie|params|payload|body|path|pasta|directory|folder|arquivo|filename)/i;

function sanitizeText(value: string) {
  return value
    .replace(/params?:\s*.*$/gi, 'params: [REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[REDACTED_DOCUMENT]')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[REDACTED_DOCUMENT]')
    .replace(/(bearer\s+|token[=:]\s*)[^\s&,]+/gi, '$1[REDACTED]')
    .replace(/(?:[A-Za-z]:\\|\\\\)[^\r\n,;]*/g, '[REDACTED_PATH]')
    .replace(/\b[^\s\\/]+\.(?:db|sqlite|sqlite3|pdf|docx?|xlsx?|zip|log|json)\b/gi, '[REDACTED_FILE]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 2_000);
}

function dataDirectory() {
  const databasePath = process.env.GEOGESTOR_DB_PATH
    ? path.resolve(process.env.GEOGESTOR_DB_PATH)
    : path.resolve(__dirname, '../../../../data/geogestor.db');
  return path.dirname(databasePath);
}

function sanitized(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[MAX_DEPTH]';
  if (value instanceof Error) {
    return { name: value.name, message: sanitizeText(value.message).slice(0, 500) };
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitized(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitized(item, depth + 1)
    ]));
  }
  if (typeof value === 'string') return sanitizeText(value);
  return value;
}

export class OperationalLogService {
  private static fileSystem: LogFileSystem = fs;
  private static options: LogOptions = { ...DEFAULT_OPTIONS };
  private static queue: LogRecord[] = [];
  private static writeQueue: Promise<void> = Promise.resolve();
  private static drainPromise: Promise<void> | null = null;
  private static flushTimer: NodeJS.Timeout | null = null;
  private static states: Record<string, ComponentState> = {};
  private static statistics = {
    enqueued: 0,
    written: 0,
    dropped: 0,
    batches: 0,
    writeFailures: 0
  };

  static async info(event: string, data: Record<string, unknown> = {}) {
    this.enqueue(this.createRecord('info', event, data));
  }

  static async warn(event: string, data: Record<string, unknown> = {}) {
    this.enqueue(this.createRecord('warn', event, data));
  }

  static error(event: string, data: Record<string, unknown> = {}) {
    return this.writeRequired(event, data, 'error');
  }

  static writeRequired(event: string, data: Record<string, unknown> = {}, level: LogLevel = 'info') {
    this.clearFlushTimer();
    const records = [...this.queue.splice(0), this.createRecord(level, event, data)];
    return this.schedulePhysicalWrite(records);
  }

  static async flush() {
    this.clearFlushTimer();
    await this.drainQueue();
    await this.writeQueue;
  }

  static async shutdown() {
    this.clearFlushTimer();
    await this.flush();
    await this.writeQueue;
  }

  static async setState(component: string, status: ComponentStatus, details: Record<string, unknown> = {}) {
    this.states[component] = {
      status,
      updatedAt: new Date().toISOString(),
      details: sanitized(details) as Record<string, unknown>
    };
    await this.persistState(false);
  }

  static getState() {
    return structuredClone(this.states);
  }

  static getStatistics() {
    return {
      ...this.statistics,
      queueDepth: this.queue.length,
      queueCapacity: this.options.queueCapacity,
      saturationPolicy: 'drop-low-priority-and-count'
    };
  }

  static async loadState() {
    try {
      const raw = await this.fileSystem.readFile(this.statePath(), 'utf8');
      const value = JSON.parse(raw) as unknown;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.states = value as Record<string, ComponentState>;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        await this.warn('operational-state-load-failed', { error });
      }
    }
  }

  static getPaths() {
    return { logPath: this.logPath(), statePath: this.statePath() };
  }

  static configureForTests(input: { fileSystem?: LogFileSystem; options?: Partial<LogOptions> } | null) {
    if (process.env.NODE_ENV !== 'test' && !process.env.GEOGESTOR_DB_PATH?.includes('scratch')) {
      throw new Error('O logger só pode ser reconfigurado em ambiente de teste.');
    }
    this.clearFlushTimer();
    this.fileSystem = input?.fileSystem || fs;
    this.options = { ...DEFAULT_OPTIONS, ...input?.options };
  }

  static resetForTests() {
    if (process.env.NODE_ENV !== 'test' && !process.env.GEOGESTOR_DB_PATH?.includes('scratch')) {
      throw new Error('O logger só pode ser reiniciado em ambiente de teste.');
    }
    this.clearFlushTimer();
    this.queue = [];
    this.writeQueue = Promise.resolve();
    this.drainPromise = null;
    this.states = {};
    this.statistics = { enqueued: 0, written: 0, dropped: 0, batches: 0, writeFailures: 0 };
    this.fileSystem = fs;
    this.options = { ...DEFAULT_OPTIONS };
  }

  private static createRecord(level: LogLevel, event: string, data: Record<string, unknown>): LogRecord {
    return {
      timestamp: new Date().toISOString(),
      level,
      event: sanitizeText(event).slice(0, 120),
      pid: process.pid,
      data: sanitized(data)
    };
  }

  private static enqueue(record: LogRecord) {
    if (this.queue.length >= this.options.queueCapacity) {
      this.statistics.dropped += 1;
      return false;
    }
    this.queue.push(record);
    this.statistics.enqueued += 1;
    if (this.queue.length >= this.options.batchSize) void this.drainQueue().catch(() => undefined);
    else this.ensureFlushTimer();
    return true;
  }

  private static schedulePhysicalWrite(records: LogRecord[]) {
    const task = async () => {
      try {
        await this.fileSystem.mkdir(path.dirname(this.logPath()), { recursive: true });
        await this.rotateIfNeeded();
        await this.fileSystem.appendFile(
          this.logPath(),
          records.map((record) => JSON.stringify(record)).join('\n') + '\n',
          'utf8'
        );
        this.statistics.written += records.length;
        this.statistics.batches += 1;
      } catch (error) {
        this.statistics.writeFailures += 1;
        throw error;
      }
    };
    const result = this.writeQueue.then(task, task);
    this.writeQueue = result.catch(() => undefined);
    return result;
  }

  private static drainQueue() {
    if (this.drainPromise) return this.drainPromise;
    this.clearFlushTimer();
    const drain = async () => {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.options.batchSize);
        await this.schedulePhysicalWrite(batch);
      }
    };
    this.drainPromise = drain().finally(() => {
      this.drainPromise = null;
      if (this.queue.length > 0) this.ensureFlushTimer();
    });
    return this.drainPromise;
  }

  private static async persistState(required: boolean) {
    const task = async () => {
      const target = this.statePath();
      const temporary = `${target}.pending`;
      await this.fileSystem.mkdir(path.dirname(target), { recursive: true });
      await this.fileSystem.writeFile(temporary, `${JSON.stringify(this.states, null, 2)}\n`, 'utf8');
      await this.fileSystem.rename(temporary, target);
    };
    const result = this.writeQueue.then(task, task);
    this.writeQueue = result.catch(() => undefined);
    if (required) return result;
    return result.catch(() => undefined);
  }

  private static async rotateIfNeeded() {
    const target = this.logPath();
    try {
      const stats = await this.fileSystem.stat(target);
      if (stats.size < this.options.maxLogBytes) return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }

    await this.fileSystem.rm(`${target}.${this.options.maxLogFiles}`, { force: true });
    for (let index = this.options.maxLogFiles - 1; index >= 1; index -= 1) {
      try {
        await this.fileSystem.rename(`${target}.${index}`, `${target}.${index + 1}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    await this.fileSystem.rename(target, `${target}.1`);
  }

  private static ensureFlushTimer() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush().catch(() => undefined);
    }, this.options.flushIntervalMs);
    this.flushTimer.unref?.();
  }

  private static clearFlushTimer() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private static logPath() {
    return path.join(dataDirectory(), 'logs', 'operational.ndjson');
  }

  private static statePath() {
    return path.join(dataDirectory(), 'logs', 'operational-state.json');
  }
}
