import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { performance } from 'node:perf_hooks';
import { closeDb, db } from './db';
import { schema } from '@geogestor/database';
import { eq, sql } from 'drizzle-orm';
import { registerApiRoutes } from './routes/register-api-routes';
import { FileSystemService } from './services/fs.service';
import { SchedulerService } from './services/scheduler.service';
import { BackupService } from './services/backup.service';
import { BackupPolicyService } from './services/backup-policy.service';
import { OperationalLogService } from './services/operational-log.service';
import { ResetInProgressError, SystemResetService } from './services/system-reset.service';
import { SystemHealthService } from './services/system-health.service';
import { DataQualityService } from './services/data-quality.service';
import { PerformanceMetricsService, normalizeRegisteredRoute } from './services/performance-metrics.service';
import { LocalSessionService, verifyAdminPassword } from './services/local-session.service';
import { DataDirectoryService } from './services/data-directory.service';
import { MaintenanceHistoryService } from './services/maintenance-history.service';
import { MaintenanceOperationService } from './services/maintenance-operation.service';
import { BackupActivityService } from './services/backup-activity.service';
import { BackupDeviceService } from './services/backup-device.service';
import { BackupProviderService } from './services/backup-provider.service';
import { BackupRecoveryService } from './services/backup-recovery.service';
import { BackupRecoverySessionService } from './services/backup-recovery-session.service';
import { RestoreAuthorizationService } from './services/restore-authorization.service';
import { buildBackupProtectionStatus } from './services/backup-status.service';
import { z } from 'zod';
import { configureProductionFrontend, startServer } from './server-lifecycle';
import { registerConfigurationAndGoogleRoutes, registerLocalAuthRoutes } from './core-access.routes';

const RESET_CONFIRMATION = 'APAGAR DADOS DO GEOGESTOR';
const RESTORE_CONFIRMATION = 'RESTAURAR BACKUP DO GEOGESTOR';
const apiProcessStartedAt = performance.now();
const trimmedRequired = (label: string, max: number) => z.string({ required_error: `${label} é obrigatório.` })
  .trim().min(1, `${label} é obrigatório.`).max(max, `${label} excede o limite de ${max} caracteres.`);
const resetSchema = z.object({ confirmation: z.literal(RESET_CONFIRMATION) }).strict();
const restoreSchema = z.object({
  bundlePath: trimmedRequired('Diretório do backup', 4_096),
  bundleAuthorization: trimmedRequired('Autorização do backup', 2_048),
  confirmation: z.literal(RESTORE_CONFIRMATION),
  recoveryCode: z.string().trim().max(256).nullable().optional(),
  recoverySession: z.string().trim().max(256).nullable().optional()
}).strict();
const restorePreflightSchema = z.object({
  bundlePath: trimmedRequired('Diretório do backup', 4_096),
  bundleAuthorization: trimmedRequired('Autorização do backup', 2_048),
  recoveryCode: z.string().trim().max(256).nullable().optional(),
  recoverySession: z.string().trim().max(256).nullable().optional()
}).strict();
const recoveryRevealSchema = z.object({ password: z.string().min(1).max(200) }).strict();
const recoveryKitSchema = z.object({
  password: z.string().min(1).max(200),
  kitPassword: z.string().min(12).max(300)
}).strict();
const recoveryKitDocumentSchema = z.object({
  format: z.literal('GeoGestor-Recovery-Kit'),
  version: z.literal(1),
  createdAt: z.string().datetime(),
  recoveryKeyId: z.string().regex(/^[a-f0-9]{24}$/),
  kdf: z.object({
    algorithm: z.literal('scrypt'),
    salt: z.string().max(256),
    N: z.number().int(),
    r: z.number().int(),
    p: z.number().int(),
    keyLength: z.literal(32)
  }).strict(),
  encryption: z.object({
    algorithm: z.literal('AES-256-GCM'),
    iv: z.string().max(256),
    tag: z.string().max(256),
    ciphertext: z.string().max(4_096)
  }).strict()
}).strict();
const recoveryKitImportSchema = z.object({
  kit: recoveryKitDocumentSchema,
  kitPassword: z.string().min(12).max(300),
  purpose: z.enum(['restore', 'confirm'])
}).strict();
const backupPolicySchema = z.object({
  automaticEnabled: z.boolean().optional().default(true),
  changeDebounceMinutes: z.number().int().min(1).max(24 * 60).optional().default(5),
  databaseIntervalHours: z.number().int().min(1).max(24 * 30),
  completeIntervalDays: z.number().int().min(1).max(365),
  retention: z.number().int().min(1).max(365),
  retentionRecentHours: z.number().int().min(1).max(24 * 30).optional().default(24),
  retentionDailyDays: z.number().int().min(1).max(3650).optional().default(30),
  retentionMonthlyMonths: z.number().int().min(1).max(120).optional().default(12),
  destinationDirectory: z.string().trim().max(4_096).nullable(),
  maxStorageBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  overdueGraceHours: z.number().int().min(0).max(24 * 30),
  runOnStartup: z.boolean(),
  runOnShutdown: z.boolean(),
  runRestoreTests: z.boolean().optional().default(true),
  restoreTestIntervalDays: z.number().int().min(1).max(365).optional().default(30)
}).strict();
const backupDestinationSchema = z.object({
  destinationDirectory: trimmedRequired('Pasta de destino', 4_096)
}).strict();

export function backupMutationScope(method: string, rawUrl: string, statusCode: number, contentType = ''): 'database' | 'complete' | null {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) || statusCode >= 400) return null;
  const pathname = rawUrl.split('?')[0];
  const excludedPrefixes = [
    '/api/auth/',
    '/api/sistema/backup',
    '/api/sistema/backups/',
    '/api/sistema/restaurar-backup',
    '/api/sistema/manutencao',
    '/api/sistema/reset',
    '/api/sistema/diagnostico',
    '/api/google/'
  ];
  if (!pathname.startsWith('/api/') || excludedPrefixes.some((prefix) => pathname.startsWith(prefix))) return null;
  return pathname.startsWith('/api/arquivos') || contentType.toLowerCase().includes('multipart/form-data')
    ? 'complete'
    : 'database';
}

export function shouldTrackBackupMutation(method: string, rawUrl: string, statusCode: number) {
  return backupMutationScope(method, rawUrl, statusCode) !== null;
}
const dataDirectoryPreflightSchema = z.object({
  targetDirectory: trimmedRequired('Pasta de destino', 4_096)
}).strict();
const dataDirectoryMigrationSchema = z.object({
  targetDirectory: trimmedRequired('Pasta de destino', 4_096),
  strategy: z.enum(['use', 'copy', 'move']),
  confirmation: z.literal('ALTERAR PASTA DE DADOS DO GEOGESTOR')
}).strict();
const maintenanceHistoryQuerySchema = z.object({
  type: z.enum(['backup_database', 'backup_complete', 'restore_test', 'restore', 'data_migration', 'operational_reset', 'integrity_check', 'diagnostic_export']).optional(),
  status: z.enum(['running', 'success', 'failed', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
}).strict();
function validationError(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] ? String(issue.path[0]) : '_root';
    if (!fields[field]) fields[field] = issue.message;
  }
  return { error: 'Revise os campos informados e tente novamente.', fields };
}

function redactRequestUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, 'http://127.0.0.1');
    return parsed.pathname.split('/').map((segment) => (
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment)
      || /^\d+$/.test(segment)
      || /^[0-9a-f]{24,}$/i.test(segment)
        ? ':id'
        : segment
    )).join('/');
  } catch {
    return '/unmatched';
  }
}

function redactErrorMessage(message: string) {
  return message
    .replace(/params?:\s*[\s\S]*$/i, 'params: [REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .slice(0, 500);
}

export const server = Fastify({
  logger: {
    base: { pid: process.pid },
    hooks: {
      logMethod(args, method) {
        if (args[0] instanceof Error) {
          return method.apply(this, [{ err: args[0] }, 'Falha interna registrada']);
        }
        return method.apply(this, args);
      }
    },
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: redactRequestUrl(request.url),
          hostname: request.hostname,
          remoteAddress: request.ip
        };
      },
      err(error) {
        const candidate = error as Error & { code?: string };
        const message = redactErrorMessage(candidate.message);
        return {
          type: candidate.name,
          name: candidate.name,
          message,
          stack: `${candidate.name}: ${message}`,
          code: candidate.code
        };
      }
    }
  }
}).withTypeProvider<ZodTypeProvider>();

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

function tokensMatch(candidate: unknown, expected: string) {
  if (typeof candidate !== 'string') return false;
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

const PUBLIC_API_ROUTES = new Set([
  '/api/ready',
  '/api/health',
  '/api/auth/status',
  '/api/auth/unlock',
  '/api/google/callback'
]);

function getRequestToken(request: FastifyRequest, name: string) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

// Hook para segurança de acesso local à API
server.addHook('onRequest', async (request, reply) => {
  const token = process.env.GEOGESTOR_API_TOKEN;
  if (!token && process.env.NODE_ENV === 'production') {
    return reply.status(503).send({ error: 'A API local não iniciou com uma credencial válida.' });
  }

  // Apenas rotas sob /api/ precisam do token
  if (!request.url.startsWith('/api/')) {
    return;
  }

  // O Google retorna pelo navegador e não consegue enviar o token efêmero do Electron.
  // Esta única rota usa um state OAuth temporário e de uso único, validado no handler.
  const requestPath = request.url.split('?')[0];
  if (request.method === 'GET' && requestPath === '/api/google/callback') {
    return;
  }

  // Preflight requests (OPTIONS) para o CORS não enviam cabeçalhos de autorização customizados e devem passar
  if (request.method === 'OPTIONS') {
    return;
  }

  if (token) {
    const queryTokenAllowed = request.method === 'GET'
      && (requestPath === '/api/arquivos/download' || requestPath === '/api/arquivos/preview'
        || /^\/api\/arquivos\/geospatial\/basemaps\/[^/]+\/tiles\//.test(requestPath));
    const requestToken = request.headers['x-api-token']
      || (request.headers['authorization']?.toString().startsWith('Bearer ')
        ? request.headers['authorization'].toString().slice(7)
        : undefined)
      || (queryTokenAllowed ? (request.query as any)?.token : undefined);

    if (!tokensMatch(requestToken, token)) {
      await OperationalLogService.writeRequired('security-access-denied', {
        method: request.method,
        route: normalizeRegisteredRoute(request.routeOptions?.url),
        reason: 'invalid-api-token'
      }, 'warn');
      return reply.status(401).send({ error: 'Unauthorized: Invalid API Token' });
    }
  }

  const localAuthenticationRequired = process.env.GEOGESTOR_REQUIRE_UNLOCK === '1'
    || process.env.NODE_ENV === 'production';
  if (process.env.GEOGESTOR_AUTH_DISABLED === '1' || !localAuthenticationRequired) return;
  if (request.method === 'OPTIONS') return;

  const isInitialSetup = request.method === 'POST' && requestPath === '/api/configuracoes';
  if (isInitialSetup || PUBLIC_API_ROUTES.has(requestPath)) {
    return;
  }

  const tileQuerySessionAllowed = request.method === 'GET' && /^\/api\/arquivos\/geospatial\/basemaps\/[^/]+\/tiles\//.test(requestPath);
  const localSession = getRequestToken(request, 'x-local-session')
    || (tileQuerySessionAllowed ? (request.query as any)?.session : undefined);
  if (!LocalSessionService.validate(localSession)) {
    return reply.status(423).send({
      error: 'A sessão local está bloqueada ou expirou.',
      code: 'session_locked'
    });
  }
});

server.addHook('onResponse', async (request, reply) => {
  const scope = backupMutationScope(request.method, request.url, reply.statusCode, String(request.headers['content-type'] || ''));
  if (scope) await BackupActivityService.markChanged(scope);
});

const httpErrorsLogged = new WeakSet<object>();

server.addHook('onResponse', async (request, reply) => {
  const route = normalizeRegisteredRoute(request.routeOptions?.url);
  const responseLengthHeader = reply.getHeader('content-length');
  const responseBytes = Number(responseLengthHeader);
  const observation = {
    route,
    method: request.method,
    statusCode: reply.statusCode,
    durationMs: reply.elapsedTime,
    responseBytes: Number.isFinite(responseBytes) ? responseBytes : undefined
  };
  const slowObservation = PerformanceMetricsService.record(observation);
  if (slowObservation) void OperationalLogService.warn('http-route-slow', slowObservation);

  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const isHttpError = reply.statusCode >= 400;
  if (isMutation || (isHttpError && !httpErrorsLogged.has(request))) {
    await OperationalLogService.writeRequired('http-request-completed', {
      route,
      method: request.method,
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime * 100) / 100,
      classification: PerformanceMetricsService.classify(reply.elapsedTime),
      responseBytes: observation.responseBytes
    }, reply.statusCode >= 500 ? 'error' : 'info');
  }
});

server.addHook('onError', async (request, reply, error) => {
  httpErrorsLogged.add(request);
  await OperationalLogService.error('http-request-failed', {
    method: request.method,
    route: normalizeRegisteredRoute(request.routeOptions?.url),
    statusCode: reply.statusCode,
    error
  });
});

server.addHook('onClose', async () => {
  await OperationalLogService.shutdown();
});

const getDatabasePath = () =>
  process.env.GEOGESTOR_DB_PATH || path.resolve(__dirname, '../../../data/geogestor.db');

let restoreScheduled = false;

async function writeRestoreResult(status: 'success' | 'failed', message: string) {
  const target = path.join(getDataDirectory(), 'last-restore-result.json');
  const temporary = `${target}.pending`;
  await fs.writeFile(temporary, `${JSON.stringify({ status, message, completedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, target);
}

async function executeManagedRestore(input: { bundlePath: string; targetFilesRoot?: string; allowedBackupDirectory?: string; recoveryCode?: string | null; recoverySecret?: string | null }) {
  let exitCode = 76;
  try {
    SchedulerService.stop();
    await server.close();
    await closeDb();
    await BackupService.restoreBackup({
      bundlePath: input.bundlePath,
      targetDatabasePath: getDatabasePath(),
      targetFilesRoot: input.targetFilesRoot,
      allowedBackupDirectory: input.allowedBackupDirectory,
      recoveryCode: input.recoveryCode,
      recoverySecret: input.recoverySecret,
      confirmation: 'RESTORE_GEOGESTOR'
    });
    await writeRestoreResult('success', 'Backup restaurado e validado com sucesso.');
    exitCode = 75;
  } catch (error) {
    const message = error instanceof Error ? redactErrorMessage(error.message) : 'Falha desconhecida durante a restauração.';
    await writeRestoreResult('failed', message).catch(() => undefined);
  } finally {
    process.exit(exitCode);
  }
}

const getDataDirectory = () => path.dirname(getDatabasePath());

const getErrorCode = (err: unknown) => (err as NodeJS.ErrnoException | undefined)?.code;
const getErrorMessage = (err: unknown, fallback: string) => (
  err instanceof Error ? err.message : fallback
);

async function copyIfExists(source: string, target: string) {
  try {
    await fs.copyFile(source, target);
    return true;
  } catch (err) {
    if (getErrorCode(err) === 'ENOENT') return false;
    throw err;
  }
}

type BackupPathStats = {
  bytes: number;
  files: number;
  directories: number;
};

const emptyPathStats = (): BackupPathStats => ({ bytes: 0, files: 0, directories: 0 });

async function getPathStats(targetPath: string): Promise<BackupPathStats> {
  try {
    const stats = await fs.lstat(targetPath);

    if (stats.isSymbolicLink()) {
      return { bytes: stats.size, files: 1, directories: 0 };
    }

    if (stats.isDirectory()) {
      const entries = await fs.readdir(targetPath);
      const total = emptyPathStats();
      total.directories += 1;

      for (const entry of entries) {
        const childStats = await getPathStats(path.join(targetPath, entry));
        total.bytes += childStats.bytes;
        total.files += childStats.files;
        total.directories += childStats.directories;
      }

      return total;
    }

    return { bytes: stats.size, files: 1, directories: 0 };
  } catch (err) {
    if (getErrorCode(err) === 'ENOENT') return emptyPathStats();
    throw err;
  }
}

async function getDatabaseBundleStats(databasePath: string) {
  const total = emptyPathStats();

  for (const source of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    const stats = await getPathStats(source);
    total.bytes += stats.bytes;
    total.files += stats.files;
    total.directories += stats.directories;
  }

  return total;
}

function openFolder(folderPath: string) {
  const opener =
    process.platform === 'win32'
      ? { command: 'explorer.exe', args: [folderPath] }
      : process.platform === 'darwin'
        ? { command: 'open', args: [folderPath] }
        : { command: 'xdg-open', args: [folderPath] };

  execFile(opener.command, opener.args, (error) => {
    if (error) server.log.error(error);
  });
}

server.register(multipart, {
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max file size
  }
});

server.register(cors, {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const port = String(Number(process.env.PORT) || 3001);
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? new Set([`http://127.0.0.1:${port}`])
      : new Set([
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          `http://127.0.0.1:${port}`,
          ...(process.env.GEOGESTOR_WEB_ORIGIN ? [process.env.GEOGESTOR_WEB_ORIGIN] : [])
        ]);
    callback(null, allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

registerApiRoutes(server);

// Health check
server.get('/api/ready', async (_request, reply) => {
  try {
    await db.run(sql`SELECT 1`);
    return { status: 'ready' };
  } catch {
    return reply.status(503).send({ status: 'starting' });
  }
});

server.get('/api/health', async (request, reply) => {
  try {
    const health = await SystemHealthService.inspect();
    return { status: health.status, time: health.checkedAt, checks: health.checks };
  } catch (error) {
    server.log.error({ err: error }, 'Falha no health check interno');
    return reply.status(503).send({ status: 'degraded', time: new Date().toISOString() });
  }
});

registerLocalAuthRoutes(server);

server.get('/api/sistema/info', async () => {
  const databasePath = getDatabasePath();
  const dataDirectory = getDataDirectory();
  let filesRootDirectory: string | null = null;
  try {
    filesRootDirectory = await FileSystemService.getRootFolder();
  } catch {
    filesRootDirectory = null;
  }

  const policy = await BackupPolicyService.get();
  return {
    mode: process.env.NODE_ENV || 'development',
    desktop: Boolean(process.env.GEOGESTOR_DB_PATH),
    databasePath,
    dataDirectory,
    backupDirectory: BackupService.getBackupDirectory(policy.destinationDirectory),
    filesRootDirectory,
    webDistPath: process.env.GEOGESTOR_WEB_DIST || null
  };
});

server.post('/api/sistema/backup', async (request, reply) => {
  const startedAt = new Date().toISOString();
  const startedAtMs = performance.now();
  let operation: ReturnType<typeof MaintenanceOperationService.begin> | null = null;
  await OperationalLogService.setState('backup', 'running', { attemptedAt: startedAt });
  try {
    const policy = await BackupPolicyService.get();
    const databaseStats = await getDatabaseBundleStats(getDatabasePath());
    operation = MaintenanceOperationService.begin('backup_database', {
      totalFiles: databaseStats.files,
      totalBytes: databaseStats.bytes
    }, 'Preparando backup do banco');
    const result = await BackupService.createLocalBackup({
      destinationDirectory: policy.destinationDirectory,
      retention: policy.retention,
      maxStorageBytes: policy.maxStorageBytes,
      retentionRecentHours: policy.retentionRecentHours,
      retentionDailyDays: policy.retentionDailyDays,
      retentionMonthlyMonths: policy.retentionMonthlyMonths,
      shouldCancel: operation.shouldCancel,
      onProgress: operation.update
    });
    operation.setCancellable(false);
    operation.finish();
    const completedAt = new Date().toISOString();
    await OperationalLogService.setState('backup', 'ok', {
      attemptedAt: startedAt,
      completedAt,
      durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
      totalBytes: result.totalBytes,
      totalFiles: result.totalFiles
    });
    return {
      message: 'Backup criado com sucesso',
      ...result
    };
  } catch (err) {
    operation?.fail(err);
    await OperationalLogService.setState('backup', 'failed', {
      attemptedAt: startedAt,
      durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
      error: err
    });
    server.log.error(err);
    return reply.status(500).send({ error: getErrorMessage(err, 'Erro ao criar backup local') });
  }
});

server.get('/api/sistema/backups/politica', async () => BackupPolicyService.get());

server.put('/api/sistema/backups/politica', async (request, reply) => {
  const parsed = backupPolicySchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  try {
    const saved = await BackupPolicyService.save(parsed.data);
    const storage = await BackupService.getStorageStatus(saved.destinationDirectory);
    return { policy: saved, storage };
  } catch (error) {
    return reply.status(422).send({ error: getErrorMessage(error, 'Não foi possível salvar a política de backup.') });
  }
});

server.post('/api/sistema/backups/testar-destino', async (request, reply) => {
  const parsed = backupDestinationSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  try {
    return await BackupPolicyService.validateDestination(parsed.data.destinationDirectory);
  } catch (error) {
    return reply.status(422).send({ error: getErrorMessage(error, 'Não foi possível usar a pasta de backups.') });
  }
});

server.post('/api/sistema/backups/testar-restauracao', async (_request, reply) => {
  let operation: ReturnType<typeof MaintenanceOperationService.begin> | null = null;
  try {
    const policy = await BackupPolicyService.get();
    const storage = await BackupService.getStorageStatus(policy.destinationDirectory);
    const latest = storage.latestByType.complete;
    if (!latest) return reply.status(404).send({ error: 'Crie um backup completo antes de testar a restauração.' });
    operation = MaintenanceOperationService.begin('restore_test', {
      totalFiles: latest.files,
      totalBytes: latest.bytes
    }, 'Criando área temporária isolada');
    operation.setCancellable(false);
    const result = await BackupService.testRestore(
      path.join(storage.backupDirectory, latest.directory),
      storage.backupDirectory
    );
    operation.update({
      stage: 'Restauração isolada validada',
      processedFiles: result.totals.files,
      processedBytes: result.totals.bytes,
      totalFiles: result.totals.files,
      totalBytes: result.totals.bytes
    });
    operation.finish();
    return result;
  } catch (error) {
    operation?.fail(error);
    return reply.status(422).send({ error: getErrorMessage(error, 'Não foi possível testar o último backup completo.') });
  }
});

server.post('/api/sistema/backups/verificar-integridade', async (_request, reply) => {
  const startedAt = new Date().toISOString();
  const startedAtMs = performance.now();
  let operation: ReturnType<typeof MaintenanceOperationService.begin> | null = null;
  let sourceLabel: string | null = null;
  try {
    const policy = await BackupPolicyService.get();
    const storage = await BackupService.getStorageStatus(policy.destinationDirectory);
    const latest = storage.history[0];
    if (!latest) return reply.status(404).send({ error: 'Crie um backup antes de verificar a integridade.' });
    sourceLabel = latest.directory;
    operation = MaintenanceOperationService.begin('integrity_check', {
      totalFiles: latest.files,
      totalBytes: latest.bytes
    }, 'Recalculando checksums do último backup');
    operation.setCancellable(false);
    const bundlePath = path.join(storage.backupDirectory, latest.directory);
    const validation = await BackupService.validateBackup(bundlePath, storage.backupDirectory);
    operation.update({
      stage: 'Checksums recalculados e comparados',
      processedFiles: validation.manifest.totals.files,
      processedBytes: validation.manifest.totals.bytes,
      totalFiles: validation.manifest.totals.files,
      totalBytes: validation.manifest.totals.bytes
    });
    const completedAt = new Date().toISOString();
    await MaintenanceHistoryService.record({
      type: 'integrity_check',
      status: 'success',
      startedAt,
      completedAt,
      durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
      sourceLabel,
      destinationLabel: 'verificação local',
      files: validation.manifest.totals.files,
      bytes: validation.manifest.totals.bytes,
      user: 'admin',
      auditId: null,
      details: { checksumsVerified: validation.checksumFilesVerified, integrity: validation.integrity }
    });
    operation.finish();
    return { verified: true, completedAt, checksumFilesVerified: validation.checksumFilesVerified, integrity: validation.integrity };
  } catch (error) {
    operation?.fail(error);
    await MaintenanceHistoryService.record({
      type: 'integrity_check',
      status: 'failed',
      startedAt,
      durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
      sourceLabel,
      destinationLabel: 'verificação local',
      files: null,
      bytes: null,
      user: 'admin',
      auditId: null,
      error
    }).catch(() => undefined);
    return reply.status(422).send({ error: getErrorMessage(error, 'A integridade do backup não pôde ser confirmada.') });
  }
});

const RECOVERY_AUTHORIZATION_ERROR = 'Não foi possível autorizar esta operação de recuperação. Verifique a senha e tente novamente.';

async function authorizeRecoverySecret(password: string, attemptKey: string, operation: 'reveal-code' | 'export-kit') {
  const retryAfter = LocalSessionService.getRetryAfterSeconds(attemptKey);
  if (retryAfter > 0) {
    await OperationalLogService.writeRequired('backup-recovery-authorization-blocked', {
      operation,
      retryAfter
    }, 'warn');
    return { authorized: false as const, status: 429 as const, retryAfter };
  }

  const [configuration] = await db.select({ adminSenhaHash: schema.configuracoes.adminSenhaHash }).from(schema.configuracoes).limit(1);
  if (!configuration || !verifyAdminPassword(password, configuration.adminSenhaHash)) {
    const blockedFor = LocalSessionService.recordFailure(attemptKey);
    await OperationalLogService.writeRequired('backup-recovery-authorization-failed', {
      operation,
      blocked: blockedFor > 0,
      retryAfter: blockedFor || null
    }, 'warn');
    return {
      authorized: false as const,
      status: blockedFor > 0 ? 429 as const : 401 as const,
      retryAfter: blockedFor || 0
    };
  }

  LocalSessionService.clearFailures(attemptKey);
  const secret = BackupRecoveryService.getConfiguredRecoverySecret(true);
  await OperationalLogService.writeRequired('backup-recovery-authorized', { operation });
  return { authorized: true as const, secret };
}

function sendRecoveryAuthorizationError(reply: FastifyReply, authorization: {
  status: 401 | 429;
  retryAfter: number;
}) {
  if (authorization.retryAfter > 0) reply.header('Retry-After', String(authorization.retryAfter));
  return reply.status(authorization.status).send({
    error: RECOVERY_AUTHORIZATION_ERROR,
    code: authorization.status === 429 ? 'too_many_attempts' : 'recovery_authorization_failed',
    retryAfter: authorization.retryAfter || undefined
  });
}

server.get('/api/sistema/backups/recuperacao', async () => {
  const secret = BackupRecoveryService.getConfiguredRecoverySecret(false);
  return {
    configured: Boolean(secret),
    confirmed: process.env.GEOGESTOR_BACKUP_RECOVERY_CONFIRMED === '1',
    confirmedAt: process.env.GEOGESTOR_BACKUP_RECOVERY_CONFIRMED_AT || null,
    keyId: secret ? BackupRecoveryService.keyId(secret) : null,
    state: !secret
      ? 'device_only'
      : process.env.GEOGESTOR_BACKUP_RECOVERY_CONFIRMED === '1'
        ? 'configured'
        : 'not_confirmed'
  };
});

server.post('/api/sistema/backups/recuperacao/codigo', async (request, reply) => {
  const parsed = recoveryRevealSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  try {
    const authorization = await authorizeRecoverySecret(parsed.data.password, `backup-recovery:${request.ip || 'local'}`, 'reveal-code');
    if (!authorization.authorized) return sendRecoveryAuthorizationError(reply, authorization);
    const secret = authorization.secret;
    if (!secret) throw new Error('A recuperação de emergência ainda não foi configurada.');
    return { recoveryCode: BackupRecoveryService.formatRecoveryCode(secret), keyId: BackupRecoveryService.keyId(secret) };
  } catch (error) {
    return reply.status(401).send({ error: getErrorMessage(error, 'Não foi possível revelar o código de recuperação.') });
  }
});

server.post('/api/sistema/backups/recuperacao/kit', async (request, reply) => {
  const parsed = recoveryKitSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  try {
    const authorization = await authorizeRecoverySecret(parsed.data.password, `backup-recovery:${request.ip || 'local'}`, 'export-kit');
    if (!authorization.authorized) return sendRecoveryAuthorizationError(reply, authorization);
    const secret = authorization.secret;
    if (!secret) throw new Error('A recuperação de emergência ainda não foi configurada.');
    return BackupRecoveryService.exportKit(secret, parsed.data.kitPassword);
  } catch (error) {
    return reply.status(401).send({ error: getErrorMessage(error, 'Não foi possível exportar o kit de recuperação.') });
  }
});

server.post('/api/sistema/backups/recuperacao/kit/validar', async (request, reply) => {
  const parsed = recoveryKitImportSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  try {
    if (parsed.data.purpose === 'confirm') {
      const configuredSecret = BackupRecoveryService.getConfiguredRecoverySecret(true);
      if (!configuredSecret) throw new Error('A recuperação de emergência ainda não foi configurada neste computador.');
      const result = BackupRecoverySessionService.validate(
        parsed.data.kit,
        parsed.data.kitPassword,
        BackupRecoveryService.keyId(configuredSecret)
      );
      const confirmedAt = new Date().toISOString();
      process.env.GEOGESTOR_BACKUP_RECOVERY_CONFIRMED = '1';
      process.env.GEOGESTOR_BACKUP_RECOVERY_CONFIRMED_AT = confirmedAt;
      return { ...result, confirmedAt };
    }
    return BackupRecoverySessionService.create(parsed.data.kit, parsed.data.kitPassword);
  } catch (error) {
    return reply.status(422).send({ error: getErrorMessage(error, 'Não foi possível validar o kit de recuperação.') });
  }
});

server.get('/api/sistema/backups/status', async () => {
  const policy = await BackupPolicyService.get();
  const state = OperationalLogService.getState();
  const storage = await BackupService.getStorageStatus(policy.destinationDirectory);
  const restoreTests = await MaintenanceHistoryService.list({ type: 'restore_test', limit: 1 });
  const [device, cloud] = await Promise.all([
    BackupDeviceService.getIdentity(),
    BackupProviderService.inspect(policy.destinationDirectory)
  ]);
  const activity = BackupActivityService.snapshot();
  const recoverySecret = BackupRecoveryService.getConfiguredRecoverySecret(false);
  const componentDetails = (component: typeof state[string] | undefined) => {
    const details = component?.details || {};
    const error = details.error && typeof details.error === 'object' && 'message' in details.error
      ? String(details.error.message)
      : typeof details.error === 'string' ? details.error : null;
    return {
      attemptedAt: typeof details.attemptedAt === 'string' ? details.attemptedAt : component?.updatedAt || null,
      completedAt: typeof details.completedAt === 'string' ? details.completedAt : null,
      durationMs: typeof details.durationMs === 'number' ? details.durationMs : null,
      totalBytes: typeof details.totalBytes === 'number' ? details.totalBytes : null,
      totalFiles: typeof details.totalFiles === 'number' ? details.totalFiles : null,
      error
    };
  };
  const databaseDetails = componentDetails(state.backup);
  const completeDetails = componentDetails(state.backupComplete);
  const databaseCompletedAt = storage.latestByType.database?.completedAt || null;
  const completeCompletedAt = storage.latestByType.complete?.completedAt || null;
  const lastBackupAt = [databaseCompletedAt, completeCompletedAt]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] || null;
  const nextAt = (value: string | null, intervalMs: number) => value
    ? new Date(Date.parse(value) + intervalMs).toISOString()
    : null;
  const now = Date.now();
  const classify = (value: string | null, intervalMs: number, operationStatus?: string) => {
    if (operationStatus === 'running') return 'running';
    if (operationStatus === 'failed') return 'failed';
    if (!value) return 'incomplete';
    return now > Date.parse(value) + intervalMs + policy.overdueGraceHours * 60 * 60 * 1000 ? 'overdue' : 'current';
  };
  const databaseIntervalMs = policy.databaseIntervalHours * 60 * 60 * 1000;
  const completeIntervalMs = policy.completeIntervalDays * 24 * 60 * 60 * 1000;
  const databaseStatus = classify(databaseCompletedAt, databaseIntervalMs, state.backup?.status);
  const completeStatus = classify(completeCompletedAt, completeIntervalMs, state.backupComplete?.status);
  const recoveryConfigured = Boolean(recoverySecret);
  const recoveryConfirmed = process.env.GEOGESTOR_BACKUP_RECOVERY_CONFIRMED === '1';
  const latestRestoreTestRecord = restoreTests[0]?.status === 'success' || restoreTests[0]?.status === 'failed' ? restoreTests[0] : null;
  const latestRestoreTest = latestRestoreTestRecord
    ? {
      status: latestRestoreTestRecord.status === 'success' ? 'success' as const : 'failed' as const,
      completedAt: latestRestoreTestRecord.completedAt,
      durationMs: latestRestoreTestRecord.durationMs
    }
    : null;
  const protectionStatus = buildBackupProtectionStatus({
    hasDestination: Boolean(policy.destinationDirectory),
    providerConfirmation: cloud.confirmation,
    providerMessage: cloud.message,
    pendingChanges: activity.pendingChanges,
    lastBackupAt,
    hasCompleteBackup: Boolean(completeCompletedAt),
    databaseStatus,
    completeStatus,
    integrity: storage.history[0]?.integrity || null,
    integrityFailed: storage.history[0]?.integrityState === 'failed',
    integrityVerifiedAt: storage.history[0]?.integrityVerifiedAt || null,
    recoveryConfigured,
    recoveryConfirmed,
    restoreTest: latestRestoreTest,
    restoreTestIntervalDays: policy.restoreTestIntervalDays,
    changeDebounceMinutes: policy.changeDebounceMinutes
  });
  return {
    policy,
    storage,
    database: {
      ...databaseDetails,
      completedAt: databaseCompletedAt,
      nextAt: nextAt(databaseCompletedAt, databaseIntervalMs),
      status: databaseStatus
    },
    complete: {
      ...completeDetails,
      completedAt: completeCompletedAt,
      nextAt: nextAt(completeCompletedAt, completeIntervalMs),
      status: completeStatus
    },
    restoreTest: latestRestoreTestRecord,
    activeOperation: MaintenanceOperationService.snapshot(),
    activity,
    device,
    cloud,
    recovery: {
      configured: recoveryConfigured,
      confirmed: recoveryConfirmed,
      confirmedAt: process.env.GEOGESTOR_BACKUP_RECOVERY_CONFIRMED_AT || null,
      keyId: recoverySecret ? BackupRecoveryService.keyId(recoverySecret) : null,
      state: !recoverySecret ? 'device_only' : recoveryConfirmed ? 'configured' : 'not_confirmed'
    },
    ...protectionStatus
  };
});

const resetHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  const parsed = resetSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  try {
    return await SystemResetService.resetOperationalData();
  } catch (err) {
    if (err instanceof ResetInProgressError) {
      return reply.status(409).send({ error: err.message });
    }
    server.log.error(err);
    return reply.status(500).send({ error: getErrorMessage(err, 'Erro ao apagar informações do banco de dados') });
  }
};

server.post('/api/sistema/reset-dados', resetHandler);
server.delete('/api/sistema/reset', resetHandler);

server.get('/api/sistema/diagnostico', async (request, reply) => {
  try {
    return await SystemHealthService.inspect();
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: 'Erro ao gerar diagnóstico do sistema' });
  }
});

server.get('/api/sistema/diagnostico/resumo', async () => SystemHealthService.diagnosticExportSummary());

server.post('/api/sistema/diagnostico', async (request, reply) => {
  try {
    return await SystemHealthService.createDiagnosticSnapshot();
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: 'Erro ao criar pacote de diagnóstico' });
  }
});

const qualityQuerySchema = z.object({
  module: z.string().trim().max(100).optional(),
  severity: z.enum(['critical', 'warning', 'info']).optional(),
  clienteId: z.string().uuid().optional()
});

server.get('/api/sistema/qualidade-dados', async (request, reply) => {
  const parsed = qualityQuerySchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  return DataQualityService.inspect(parsed.data);
});

server.get('/api/sistema/qualidade-dados.csv', async (request, reply) => {
  const parsed = qualityQuerySchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  const report = await DataQualityService.inspect(parsed.data);
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [['Módulo', 'Gravidade', 'Problema', 'Quantidade', 'Recomendação']]
    .concat(report.issues.map((issue) => [issue.module, issue.severity, issue.title, String(issue.count), issue.recommendation]));
  return reply.type('text/csv; charset=utf-8')
    .header('content-disposition', 'attachment; filename="qualidade-dados.csv"')
    .send(`\uFEFF${rows.map((row) => row.map(quote).join(';')).join('\n')}`);
});

server.get('/api/sistema/backup-completo/preflight', async (request, reply) => {
  try {
    const databasePath = getDatabasePath();
    const policy = await BackupPolicyService.get();
    const backupDirectory = BackupService.getBackupDirectory(policy.destinationDirectory);
    const filesRootDirectory = await FileSystemService.getRootFolder();
    const [databaseStats, filesStats] = await Promise.all([
      getDatabaseBundleStats(databasePath),
      getPathStats(filesRootDirectory)
    ]);
    await fs.mkdir(backupDirectory, { recursive: true });
    const disk = await fs.statfs(backupDirectory);
    const availableBytes = Number(disk.bavail) * Number(disk.bsize);
    const totalBytes = databaseStats.bytes + filesStats.bytes;

    return {
      databasePath,
      filesRootDirectory,
      backupDirectory,
      databaseStats,
      filesStats,
      totalBytes,
      totalFiles: databaseStats.files + filesStats.files,
      availableBytes,
      estimatedRequiredBytes: Math.ceil(totalBytes * 1.1),
      canProceed: availableBytes >= Math.ceil(totalBytes * 1.1)
    };
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: 'Erro ao calcular estimativa do backup completo' });
  }
});

server.post('/api/sistema/backup-completo', async (request, reply) => {
  const startedAt = new Date().toISOString();
  const startedAtMs = performance.now();
  let operation: ReturnType<typeof MaintenanceOperationService.begin> | null = null;
  await OperationalLogService.setState('backupComplete', 'running', { attemptedAt: startedAt });
  const protectedSequence = BackupActivityService.captureSequence();
  try {
    const databasePath = getDatabasePath();
    const filesRootDirectory = await FileSystemService.getRootFolder();
    const [databaseStats, filesStats] = await Promise.all([
      getDatabaseBundleStats(databasePath),
      getPathStats(filesRootDirectory)
    ]);
    operation = MaintenanceOperationService.begin('backup_complete', {
      totalFiles: databaseStats.files + filesStats.files,
      totalBytes: databaseStats.bytes + filesStats.bytes
    }, 'Preparando backup completo');
    const policy = await BackupPolicyService.get();
    const backup = await BackupService.createCompleteBackup(filesRootDirectory, {
      destinationDirectory: policy.destinationDirectory,
      retention: policy.retention,
      maxStorageBytes: policy.maxStorageBytes,
      retentionRecentHours: policy.retentionRecentHours,
      retentionDailyDays: policy.retentionDailyDays,
      retentionMonthlyMonths: policy.retentionMonthlyMonths,
      shouldCancel: operation.shouldCancel,
      onProgress: operation.update
    });
    operation.setCancellable(false);
    operation.finish();

    const completedAt = new Date().toISOString();
    await OperationalLogService.setState('backupComplete', 'ok', {
      attemptedAt: startedAt,
      completedAt,
      durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
      totalBytes: backup.totalBytes,
      totalFiles: backup.totalFiles
    });
    await BackupActivityService.markProtected(protectedSequence, {
      completedAt,
      bundleName: path.basename(backup.bundlePath)
    });
    return {
      message: 'Backup completo criado com sucesso',
      ...backup,
      filesBackupPath: path.join(backup.bundlePath, 'files'),
      databaseStats,
      filesStats,
      totalBytes: databaseStats.bytes + filesStats.bytes,
      totalFiles: databaseStats.files + filesStats.files
    };
  } catch (err) {
    operation?.fail(err);
    await OperationalLogService.setState('backupComplete', 'failed', {
      attemptedAt: startedAt,
      durationMs: Number((performance.now() - startedAtMs).toFixed(2)),
      error: err
    });
    server.log.error(err);
    return reply.status(500).send({ error: getErrorMessage(err, 'Erro ao criar backup completo') });
  }
});

server.post('/api/sistema/restaurar-backup/preflight', async (request, reply) => {
  const parsed = restorePreflightSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  try {
    const authorization = RestoreAuthorizationService.verify({ bundlePath: parsed.data.bundlePath, authorization: parsed.data.bundleAuthorization });
    const recovery = BackupRecoverySessionService.resolve(parsed.data.recoverySession);
    const allowedBackupDirectory = authorization.bundlePath;
    const validation = await BackupService.validateBackup(parsed.data.bundlePath, allowedBackupDirectory, { recoveryCode: parsed.data.recoveryCode, recoverySecret: recovery?.recoverySecret });
    const dataDisk = await fs.statfs(getDataDirectory());
    let availableBytes = Number(dataDisk.bavail) * Number(dataDisk.bsize);
    if (validation.manifest.type === 'complete') {
      const filesRoot = await FileSystemService.getRootFolder();
      await fs.mkdir(filesRoot, { recursive: true });
      const filesDisk = await fs.statfs(filesRoot);
      availableBytes = Math.min(availableBytes, Number(filesDisk.bavail) * Number(filesDisk.bsize));
    }
    const estimatedRequiredBytes = Math.ceil(validation.manifest.totals.bytes * 1.1);
    return {
      valid: true,
      application: validation.manifest.application,
      type: validation.manifest.type,
      createdAt: validation.manifest.createdAt,
      completedAt: validation.manifest.completedAt,
      schemaVersion: validation.manifest.schemaVersion,
      formatVersion: validation.manifest.formatVersion,
      totals: validation.manifest.totals,
      encrypted: Boolean(validation.manifest.encryption),
      integrity: validation.integrity,
      checksumFilesVerified: validation.checksumFilesVerified,
      credentialsExcluded: Boolean(validation.manifest.credentialsExcluded),
      availableBytes,
      estimatedRequiredBytes,
      canProceed: availableBytes >= estimatedRequiredBytes
    };
  } catch (error) {
    return reply.status(422).send({ error: getErrorMessage(error, 'O backup selecionado não pôde ser validado.') });
  }
});

server.post('/api/sistema/restaurar-backup/testar', async (request, reply) => {
  const parsed = restorePreflightSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  let operation: ReturnType<typeof MaintenanceOperationService.begin> | null = null;
  try {
    const authorization = RestoreAuthorizationService.verify({ bundlePath: parsed.data.bundlePath, authorization: parsed.data.bundleAuthorization });
    const recovery = BackupRecoverySessionService.resolve(parsed.data.recoverySession);
    const allowedBackupDirectory = authorization.bundlePath;
    const unlock = { recoveryCode: parsed.data.recoveryCode, recoverySecret: recovery?.recoverySecret };
    const validation = await BackupService.validateBackup(parsed.data.bundlePath, allowedBackupDirectory, unlock);
    operation = MaintenanceOperationService.begin('restore_test', {
      totalFiles: validation.manifest.totals.files,
      totalBytes: validation.manifest.totals.bytes
    }, 'Criando área temporária isolada');
    operation.setCancellable(false);
    const result = await BackupService.testRestore(parsed.data.bundlePath, allowedBackupDirectory, unlock);
    operation.update({
      stage: 'Restauração isolada validada',
      processedFiles: result.totals.files,
      processedBytes: result.totals.bytes,
      totalFiles: result.totals.files,
      totalBytes: result.totals.bytes
    });
    operation.finish();
    RestoreAuthorizationService.markTested({ bundlePath: parsed.data.bundlePath, authorization: parsed.data.bundleAuthorization });
    return result;
  } catch (error) {
    operation?.fail(error);
    return reply.status(422).send({ error: getErrorMessage(error, 'Não foi possível concluir o teste isolado de restauração.') });
  }
});

server.post('/api/sistema/restaurar-backup', async (request, reply) => {
  if (process.env.GEOGESTOR_DESKTOP_MANAGED !== '1') {
    return reply.status(409).send({ error: 'A restauração está disponível somente no aplicativo desktop gerenciado.' });
  }
  if (restoreScheduled) return reply.status(409).send({ error: 'Uma restauração já está em andamento.' });
  const parsed = restoreSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));

  try {
    const authorization = RestoreAuthorizationService.assertTested({ bundlePath: parsed.data.bundlePath, authorization: parsed.data.bundleAuthorization });
    const recovery = BackupRecoverySessionService.resolve(parsed.data.recoverySession);
    const allowedBackupDirectory = authorization.bundlePath;
    const unlock = { recoveryCode: parsed.data.recoveryCode, recoverySecret: recovery?.recoverySecret };
    const validation = await BackupService.validateBackup(parsed.data.bundlePath, allowedBackupDirectory, unlock);
    const restoreDisk = await fs.statfs(getDataDirectory());
    let restoreAvailableBytes = Number(restoreDisk.bavail) * Number(restoreDisk.bsize);
    if (validation.manifest.type === 'complete') {
      const filesRoot = await FileSystemService.getRootFolder();
      await fs.mkdir(filesRoot, { recursive: true });
      const filesDisk = await fs.statfs(filesRoot);
      restoreAvailableBytes = Math.min(restoreAvailableBytes, Number(filesDisk.bavail) * Number(filesDisk.bsize));
    }
    if (restoreAvailableBytes < Math.ceil(validation.manifest.totals.bytes * 1.1)) {
      throw new Error('Não há espaço livre suficiente para restaurar e preservar a cópia de segurança dos dados atuais.');
    }
    const targetFilesRoot = validation.manifest.type === 'complete'
      ? await FileSystemService.getRootFolder()
      : undefined;
    RestoreAuthorizationService.verify({ bundlePath: parsed.data.bundlePath, authorization: parsed.data.bundleAuthorization }, { consume: true });
    const consumedRecovery = BackupRecoverySessionService.resolve(parsed.data.recoverySession, { consume: true });
    restoreScheduled = true;
    setTimeout(() => {
      void executeManagedRestore({
        bundlePath: parsed.data.bundlePath,
        targetFilesRoot,
        allowedBackupDirectory,
        recoveryCode: parsed.data.recoveryCode,
        recoverySecret: consumedRecovery?.recoverySecret || recovery?.recoverySecret
      });
    }, 150);
    return reply.status(202).send({
      message: 'Backup validado. O GeoGestor será reiniciado para concluir a restauração.',
      schemaVersion: validation.manifest.schemaVersion,
      type: validation.manifest.type
    });
  } catch (error) {
    return reply.status(422).send({ error: getErrorMessage(error, 'O backup selecionado não pôde ser validado.') });
  }
});

server.post('/api/sistema/abrir-pasta-dados', async (request, reply) => {
  try {
    const dataDirectory = getDataDirectory();
    await fs.mkdir(dataDirectory, { recursive: true });
    openFolder(dataDirectory);
    return { path: dataDirectory };
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: 'Erro ao abrir pasta de dados' });
  }
});

server.post('/api/sistema/diretorio-arquivos/preflight', async (request, reply) => {
  const parsed = dataDirectoryPreflightSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  try {
    return await DataDirectoryService.preflight(parsed.data.targetDirectory);
  } catch (error) {
    return reply.status(422).send({ error: getErrorMessage(error, 'Não foi possível validar a pasta escolhida.') });
  }
});

server.post('/api/sistema/diretorio-arquivos/migrar', async (request, reply) => {
  const parsed = dataDirectoryMigrationSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  let operation: ReturnType<typeof MaintenanceOperationService.begin> | null = null;
  try {
    const preflight = await DataDirectoryService.preflight(parsed.data.targetDirectory);
    operation = MaintenanceOperationService.begin('data_migration', {
      totalFiles: preflight.current.files,
      totalBytes: preflight.current.bytes
    }, 'Preparando migração dos documentos');
    const result = await DataDirectoryService.migrate({
      ...parsed.data,
      shouldCancel: operation.shouldCancel,
      onProgress: operation.update
    });
    operation.setCancellable(false);
    operation.finish();
    return result;
  } catch (error) {
    operation?.fail(error);
    return reply.status(422).send({ error: getErrorMessage(error, 'Não foi possível alterar a pasta de documentos.') });
  }
});

server.get('/api/sistema/operacoes/status', async () => ({ operation: MaintenanceOperationService.snapshot() }));

server.post('/api/sistema/operacoes/:id/cancelar', async (request, reply) => {
  const id = z.string().uuid().safeParse((request.params as { id?: unknown }).id);
  if (!id.success) return reply.status(400).send({ error: 'Identificador de operação inválido.' });
  if (!MaintenanceOperationService.requestCancel(id.data)) {
    return reply.status(409).send({ error: 'A operação não está ativa ou já entrou em uma etapa que não pode ser cancelada.' });
  }
  return { requested: true, operation: MaintenanceOperationService.snapshot() };
});

server.get('/api/sistema/historico-operacional', async (request, reply) => {
  const parsed = maintenanceHistoryQuerySchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  return { items: await MaintenanceHistoryService.list(parsed.data) };
});

server.get('/api/sistema/historico-operacional/exportar', async (request, reply) => {
  const parsed = maintenanceHistoryQuerySchema.omit({ limit: true }).safeParse(request.query);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  const csv = await MaintenanceHistoryService.exportCsv(parsed.data);
  return reply.type('text/csv; charset=utf-8')
    .header('content-disposition', 'attachment; filename="historico-operacional-geogestor.csv"')
    .send(csv);
});

server.post('/api/sistema/abrir-pasta-arquivos', async (request, reply) => {
  try {
    const root = await FileSystemService.getRootFolder();
    await FileSystemService.ensureFolder(root);
    FileSystemService.openFolderInExplorer(root);
    return { path: root };
  } catch (error) {
    return reply.status(422).send({ error: getErrorMessage(error, 'Não foi possível abrir a pasta de documentos.') });
  }
});

registerConfigurationAndGoogleRoutes(server, getErrorMessage);

configureProductionFrontend(server);

export const start = () => startServer({
  server,
  apiProcessStartedAt,
  getDataDirectory,
  getErrorMessage
});
// Auto-start when run directly (not imported by Electron)
if (require.main === module) {
  start();
}
