import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { performance } from 'node:perf_hooks';
import { closeDb, db, dbReady } from './db';
import { schema } from '@geogestor/database';
import { eq, sql } from 'drizzle-orm';
import { clientesRoutes } from './routes/clientes.routes';
import { dashboardRoutes } from './routes/dashboard.routes';
import { projetosRoutes } from './routes/projetos.routes';
import { financeiroRoutes } from './routes/financeiro.routes';
import { arquivosRoutes } from './routes/arquivos.routes';
import { tarefasRoutes } from './routes/tarefas.routes';
import { relatoriosRoutes } from './routes/relatorios.routes';
import { compromissosRoutes } from './routes/compromissos.routes';
import { oportunidadesRoutes } from './routes/oportunidades.routes';
import { auditRoutes } from './routes/audit.routes';
import { searchRoutes } from './routes/search.routes';
import { contatosRoutes } from './routes/contatos.routes';
import { licencasRoutes } from './routes/licencas.routes';
import { ambientalRoutes } from './routes/ambiental.routes';
import { orcamentosRoutes } from './routes/orcamentos.routes';
import { strategicPlanningRoutes } from './routes/strategic-planning.routes';
import { operationalDataRoutes } from './routes/operational-data.routes';
import { alertasRoutes } from './routes/alertas.routes';
import { importacoesRoutes } from './routes/importacoes.routes';
import { runRuntimeMigrations } from './services/runtime-migrations.service';
import { FileSystemService } from './services/fs.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { SchedulerService } from './services/scheduler.service';
import { BackupService } from './services/backup.service';
import { BackupPolicyService } from './services/backup-policy.service';
import { LocalSecretService } from './services/local-secret.service';
import { AuditLogService } from './services/audit.service';
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
import { z } from 'zod';
import { isValidCnpj } from '@geogestor/contracts';

const RESET_CONFIRMATION = 'APAGAR DADOS DO GEOGESTOR';
const RESTORE_CONFIRMATION = 'RESTAURAR BACKUP DO GEOGESTOR';
const apiProcessStartedAt = performance.now();
const trimmedRequired = (label: string, max: number) => z.string({ required_error: `${label} é obrigatório.` })
  .trim().min(1, `${label} é obrigatório.`).max(max, `${label} excede o limite de ${max} caracteres.`);
const nullableTrimmed = (max: number) => z.string().trim().max(max).nullable().optional();

const configuracaoCreateSchema = z.object({
  empresaNome: trimmedRequired('Nome da empresa', 200),
  dadosPasta: trimmedRequired('Pasta de dados', 2_048),
  adminNome: trimmedRequired('Nome do administrador', 200),
  adminEmail: z.string().trim().min(1, 'E-mail é obrigatório.').max(320).email('Informe um e-mail válido.'),
  adminSenha: z.string().min(8, 'A senha local deve ter pelo menos 8 caracteres.').max(200)
}).strict();

const configuracaoPatchSchema = z.object({
  empresaNome: trimmedRequired('Nome da empresa', 200).optional(),
  empresaCnpj: nullableTrimmed(18).refine((value) => !value || isValidCnpj(value), 'Informe um CNPJ válido.'),
  dadosPasta: trimmedRequired('Pasta de dados', 2_048).optional(),
  adminNome: trimmedRequired('Nome do administrador', 200).optional(),
  adminEmail: z.string().trim().min(1, 'E-mail é obrigatório.').max(320).email('Informe um e-mail válido.').optional(),
  adminSenha: z.string().min(8, 'A senha local deve ter pelo menos 8 caracteres.').max(200).optional(),
  googleClientId: nullableTrimmed(2_048),
  googleClientSecret: z.string().max(4_096).optional(),
  googleRefreshToken: z.null().optional(),
  googleAccessToken: z.null().optional(),
  googleSyncActive: z.boolean().optional()
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'Informe ao menos um campo para atualizar.'
});

const resetSchema = z.object({ confirmation: z.literal(RESET_CONFIRMATION) }).strict();
const restoreSchema = z.object({
  bundlePath: trimmedRequired('Diretório do backup', 4_096),
  confirmation: z.literal(RESTORE_CONFIRMATION),
  recoveryCode: z.string().trim().max(256).nullable().optional()
}).strict();
const restorePreflightSchema = z.object({
  bundlePath: trimmedRequired('Diretório do backup', 4_096),
  recoveryCode: z.string().trim().max(256).nullable().optional()
}).strict();
const recoveryRevealSchema = z.object({ password: z.string().min(1).max(200) }).strict();
const recoveryKitSchema = z.object({
  password: z.string().min(1).max(200),
  kitPassword: z.string().min(12).max(300)
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
const unlockSchema = z.object({
  password: z.string().min(1, 'Informe a senha local.').max(200)
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

const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const googleOAuthStates = new Map<string, number>();

function createGoogleOAuthState() {
  const now = Date.now();
  for (const [state, expiresAt] of googleOAuthStates) {
    if (expiresAt <= now) googleOAuthStates.delete(state);
  }

  const state = crypto.randomBytes(32).toString('base64url');
  googleOAuthStates.set(state, now + GOOGLE_OAUTH_STATE_TTL_MS);
  return state;
}

function consumeGoogleOAuthState(state: string) {
  const expiresAt = googleOAuthStates.get(state);
  googleOAuthStates.delete(state);
  return expiresAt !== undefined && expiresAt > Date.now();
}

function hashAdminPassword(password: unknown) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('A senha local deve ter pelo menos 8 caracteres.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function sanitizeConfiguracao(config: any | null | undefined) {
  if (!config) return null;
  const { adminSenhaHash, googleClientSecret, googleRefreshToken, googleAccessToken, ...safeConfig } = config;
  return {
    ...safeConfig,
    googleClientSecretConfigured: Boolean(googleClientSecret)
  };
}

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
      && (requestPath === '/api/arquivos/download' || requestPath === '/api/arquivos/preview');
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

  const localSession = getRequestToken(request, 'x-local-session');
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

async function executeManagedRestore(input: { bundlePath: string; targetFilesRoot?: string; allowedBackupDirectory?: string; recoveryCode?: string | null }) {
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

// Registrar rotas modulares
server.register(clientesRoutes, { prefix: '/api/clientes' });
server.register(dashboardRoutes, { prefix: '/api/dashboard' });
server.register(projetosRoutes, { prefix: '/api/projetos' });
server.register(financeiroRoutes, { prefix: '/api/financeiro' });
server.register(arquivosRoutes, { prefix: '/api/arquivos' });
server.register(tarefasRoutes, { prefix: '/api/tarefas' });
server.register(relatoriosRoutes, { prefix: '/api/relatorios' });
server.register(compromissosRoutes, { prefix: '/api/compromissos' });
server.register(oportunidadesRoutes, { prefix: '/api/oportunidades' });
server.register(auditRoutes, { prefix: '/api/audit-logs' });
server.register(searchRoutes, { prefix: '/api/search' });
server.register(contatosRoutes, { prefix: '/api/contatos' });
server.register(licencasRoutes, { prefix: '/api/licencas' });
server.register(ambientalRoutes, { prefix: '/api/ambiental' });
server.register(orcamentosRoutes, { prefix: '/api/orcamentos' });
server.register(strategicPlanningRoutes, { prefix: '/api/planejamento' });
server.register(operationalDataRoutes, { prefix: '/api/dados-operacionais' });
server.register(alertasRoutes, { prefix: '/api/alertas' });
server.register(importacoesRoutes, { prefix: '/api/importacoes' });

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

server.get('/api/auth/status', async (request, reply) => {
  try {
    const configs = await db.select().from(schema.configuracoes).limit(1);
    const config = configs[0];
    if (!config) {
      return {
        setupRequired: true,
        locked: false,
        idleMinutes: LocalSessionService.idleMinutes,
        identity: null
      };
    }

    const managedAuthentication = process.env.GEOGESTOR_AUTH_DISABLED !== '1'
      && (process.env.GEOGESTOR_REQUIRE_UNLOCK === '1' || process.env.NODE_ENV === 'production');
    const localSession = getRequestToken(request, 'x-local-session');
    const locked = managedAuthentication && !LocalSessionService.validate(localSession);
    return {
      setupRequired: false,
      locked,
      idleMinutes: LocalSessionService.idleMinutes,
      identity: locked ? null : {
        name: config.adminNome,
        email: config.adminEmail,
        company: config.empresaNome
      }
    };
  } catch (error) {
    server.log.error({ err: error }, 'Falha ao consultar o estado da sessão local');
    return reply.status(503).send({
      error: 'O banco local não respondeu à verificação de sessão.',
      code: 'database_unavailable'
    });
  }
});

server.post('/api/auth/unlock', async (request, reply) => {
  const parsed = unlockSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));

  const attemptKey = request.ip || 'local';
  const retryAfter = LocalSessionService.getRetryAfterSeconds(attemptKey);
  if (retryAfter > 0) {
    reply.header('Retry-After', String(retryAfter));
    return reply.status(429).send({
      error: `Muitas tentativas incorretas. Aguarde ${retryAfter} segundos e tente novamente.`,
      code: 'too_many_attempts',
      retryAfter
    });
  }

  const configs = await db.select().from(schema.configuracoes).limit(1);
  const config = configs[0];
  if (!config) {
    return reply.status(409).send({
      error: 'Conclua a configuração inicial antes de desbloquear o GeoGestor.',
      code: 'setup_required'
    });
  }

  if (!verifyAdminPassword(parsed.data.password, config.adminSenhaHash)) {
    const blockedFor = LocalSessionService.recordFailure(attemptKey);
    if (blockedFor > 0) reply.header('Retry-After', String(blockedFor));
    return reply.status(401).send({
      error: blockedFor > 0
        ? `Muitas tentativas incorretas. Aguarde ${blockedFor} segundos e tente novamente.`
        : 'Senha local incorreta.',
      code: blockedFor > 0 ? 'too_many_attempts' : 'invalid_password',
      retryAfter: blockedFor || undefined
    });
  }

  LocalSessionService.clearFailures(attemptKey);
  const session = LocalSessionService.create();
  await OperationalLogService.writeRequired('local-session-unlocked', {
    idleMinutes: session.idleMinutes
  });
  return {
    ...session,
    identity: {
      name: config.adminNome,
      email: config.adminEmail,
      company: config.empresaNome
    },
    notice: 'A senha bloqueia o acesso pelo aplicativo. Ela não criptografa integralmente o arquivo SQLite.'
  };
});

server.post('/api/auth/lock', async (request) => {
  LocalSessionService.revoke(getRequestToken(request, 'x-local-session'));
  await OperationalLogService.writeRequired('local-session-locked', {});
  return { locked: true };
});

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
    return reply.status(422).send({ error: getErrorMessage(error, 'NÃ£o foi possÃ­vel salvar a polÃ­tica de backup.') });
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
  try {
    const policy = await BackupPolicyService.get();
    const result = await BackupService.testLatestCompleteBackup(policy.destinationDirectory);
    if (!result) return reply.status(404).send({ error: 'Crie um backup completo antes de testar a restauração.' });
    return result;
  } catch (error) {
    return reply.status(422).send({ error: getErrorMessage(error, 'Não foi possível testar o último backup completo.') });
  }
});

async function authorizeRecoverySecret(password: string) {
  const [configuration] = await db.select({ adminSenhaHash: schema.configuracoes.adminSenhaHash }).from(schema.configuracoes).limit(1);
  if (!configuration || !verifyAdminPassword(password, configuration.adminSenhaHash)) {
    throw new Error('Senha administrativa incorreta.');
  }
  return BackupRecoveryService.getConfiguredRecoverySecret(true);
}

server.get('/api/sistema/backups/recuperacao', async () => {
  const secret = BackupRecoveryService.getConfiguredRecoverySecret(false);
  return {
    configured: Boolean(secret),
    confirmed: process.env.GEOGESTOR_BACKUP_RECOVERY_CONFIRMED === '1',
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
    const secret = await authorizeRecoverySecret(parsed.data.password);
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
    const secret = await authorizeRecoverySecret(parsed.data.password);
    if (!secret) throw new Error('A recuperação de emergência ainda não foi configurada.');
    return BackupRecoveryService.exportKit(secret, parsed.data.kitPassword);
  } catch (error) {
    return reply.status(401).send({ error: getErrorMessage(error, 'Não foi possível exportar o kit de recuperação.') });
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
  const databaseCompletedAt = databaseDetails.completedAt;
  const completeCompletedAt = completeDetails.completedAt;
  const lastBackupAt = [databaseCompletedAt, completeCompletedAt].filter((value): value is string => Boolean(value)).sort().reverse()[0] || null;
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
  const running = state.backup?.status === 'running' || state.backupComplete?.status === 'running';
  const failed = state.backupComplete?.status === 'failed' || state.backup?.status === 'failed';
  const restoreTestFailed = restoreTests[0]?.status === 'failed';
  const summaryState = !policy.destinationDirectory
    ? 'not_configured'
    : running
      ? 'running'
      : restoreTestFailed || (failed && activity.pendingChanges > 0)
        ? 'failed'
        : activity.pendingChanges > 0
          ? 'pending'
          : lastBackupAt
            ? cloud.confirmation === 'confirmed' ? 'protected' : 'created'
            : 'incomplete';
  return {
    policy,
    storage,
    database: {
      ...databaseDetails,
      completedAt: databaseCompletedAt,
      nextAt: nextAt(databaseCompletedAt, databaseIntervalMs),
      status: classify(databaseCompletedAt, databaseIntervalMs, state.backup?.status)
    },
    complete: {
      ...completeDetails,
      completedAt: completeCompletedAt,
      nextAt: nextAt(completeCompletedAt, completeIntervalMs),
      status: classify(completeCompletedAt, completeIntervalMs, state.backupComplete?.status)
    },
    restoreTest: restoreTests[0] || null,
    activeOperation: MaintenanceOperationService.snapshot(),
    activity,
    device,
    cloud,
    recovery: {
      configured: Boolean(recoverySecret),
      confirmed: process.env.GEOGESTOR_BACKUP_RECOVERY_CONFIRMED === '1',
      keyId: recoverySecret ? BackupRecoveryService.keyId(recoverySecret) : null,
      state: !recoverySecret ? 'device_only' : process.env.GEOGESTOR_BACKUP_RECOVERY_CONFIRMED === '1' ? 'configured' : 'not_confirmed'
    },
    summary: {
      state: summaryState,
      configured: Boolean(policy.destinationDirectory),
      pendingChanges: activity.pendingChanges,
      lastBackupAt,
      integrity: storage.history[0]?.integrity || null,
      label: summaryState === 'not_configured' ? 'Backup não configurado'
        : summaryState === 'running' ? 'Criando backup…'
          : summaryState === 'failed' ? 'Atenção necessária'
            : summaryState === 'pending' ? `${activity.pendingChanges} ${activity.pendingChanges === 1 ? 'alteração pendente' : 'alterações pendentes'}`
              : summaryState === 'protected' ? 'Backup protegido'
                : summaryState === 'created' ? 'Backup criado'
                  : 'Primeiro backup pendente',
      description: restoreTestFailed
        ? 'O último teste de restauração falhou. Verifique o destino e execute “Testar restauração agora”.'
        : cloud.message
    }
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
  const rows = [['MÃ³dulo', 'Gravidade', 'Problema', 'Quantidade', 'RecomendaÃ§Ã£o']]
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
    const policy = await BackupPolicyService.get();
    const allowedBackupDirectory = BackupService.getBackupDirectory(policy.destinationDirectory);
    const validation = await BackupService.validateBackup(parsed.data.bundlePath, allowedBackupDirectory, { recoveryCode: parsed.data.recoveryCode });
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
    const policy = await BackupPolicyService.get();
    const allowedBackupDirectory = BackupService.getBackupDirectory(policy.destinationDirectory);
    const validation = await BackupService.validateBackup(parsed.data.bundlePath, allowedBackupDirectory, { recoveryCode: parsed.data.recoveryCode });
    operation = MaintenanceOperationService.begin('restore_test', {
      totalFiles: validation.manifest.totals.files,
      totalBytes: validation.manifest.totals.bytes
    }, 'Criando área temporária isolada');
    operation.setCancellable(false);
    const result = await BackupService.testRestore(parsed.data.bundlePath, allowedBackupDirectory, { recoveryCode: parsed.data.recoveryCode });
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
    const policy = await BackupPolicyService.get();
    const allowedBackupDirectory = BackupService.getBackupDirectory(policy.destinationDirectory);
    const validation = await BackupService.validateBackup(parsed.data.bundlePath, allowedBackupDirectory, { recoveryCode: parsed.data.recoveryCode });
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
    restoreScheduled = true;
    setTimeout(() => {
      void executeManagedRestore({ bundlePath: parsed.data.bundlePath, targetFilesRoot, allowedBackupDirectory, recoveryCode: parsed.data.recoveryCode });
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

// Configuracoes
server.get('/api/configuracoes', async (request, reply) => {
  const configs = await db.select().from(schema.configuracoes).limit(1);
  return sanitizeConfiguracao(configs[0]);
});

server.post('/api/configuracoes', async (request, reply) => {
  const parsed = configuracaoCreateSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  const data = parsed.data;
  const existingConfigs = await db.select({ id: schema.configuracoes.id }).from(schema.configuracoes).limit(1);
  if (existingConfigs.length > 0) {
    return reply.status(409).send({ error: 'A configuração inicial já foi concluída.' });
  }

  const config = await db.transaction(async (tx) => {
    const created = await tx.insert(schema.configuracoes).values({
      id: crypto.randomUUID(),
      empresaNome: data.empresaNome,
      dadosPasta: data.dadosPasta,
      adminNome: data.adminNome,
      adminEmail: data.adminEmail,
      adminSenhaHash: hashAdminPassword(data.adminSenha),
      setupConcluido: true
    }).returning();
    await AuditLogService.log('INSERT', 'Configuração', null, created[0], tx);
    return created;
  });
  return sanitizeConfiguracao(config[0]);
});

server.patch('/api/configuracoes', async (request, reply) => {
  const parsed = configuracaoPatchSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send(validationError(parsed.error));
  const data = parsed.data;
  try {
    if (data.googleClientSecret && /^[*•]+$/.test(data.googleClientSecret.trim())) {
      return reply.status(400).send({
        error: 'Revise os campos informados e tente novamente.',
        fields: { googleClientSecret: 'Informe o novo segredo real; valores mascarados não são aceitos.' }
      });
    }

    const configs = await db.select().from(schema.configuracoes).limit(1);
    
    if (configs.length > 0) {
      const protectedClientSecret = data.googleClientSecret?.trim()
        ? LocalSecretService.protect(data.googleClientSecret.trim())
        : undefined;
      const configAtualizada = await db.transaction(async (tx) => {
        const updated = await tx.update(schema.configuracoes).set({
          empresaNome: data.empresaNome !== undefined ? data.empresaNome : undefined,
          empresaCnpj: data.empresaCnpj !== undefined ? data.empresaCnpj : undefined,
          dadosPasta: data.dadosPasta !== undefined ? data.dadosPasta : undefined,
          adminNome: data.adminNome !== undefined ? data.adminNome : undefined,
          adminEmail: data.adminEmail !== undefined ? data.adminEmail : undefined,
          adminSenhaHash: data.adminSenha !== undefined ? hashAdminPassword(data.adminSenha) : undefined,
          googleClientId: data.googleClientId !== undefined ? data.googleClientId : undefined,
          googleClientSecret: protectedClientSecret,
          googleRefreshToken: data.googleRefreshToken === null ? null : undefined,
          googleAccessToken: data.googleAccessToken === null ? null : undefined,
          googleSyncActive: data.googleSyncActive !== undefined ? data.googleSyncActive : undefined,
          updatedAt: new Date().toISOString()
        }).where(eq(schema.configuracoes.id, configs[0].id)).returning();
        await AuditLogService.log('UPDATE', 'Configuração', configs[0], updated[0], tx);
        return updated;
      });
      return sanitizeConfiguracao(configAtualizada[0]);
    } else {
      return reply.status(409).send({ error: 'Conclua a configuração inicial antes de atualizar preferências.' });
    }
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: 'Erro ao atualizar configurações' });
  }
});

// Integração com Google Agenda (Calendar)
server.get('/api/google/status', async (request, reply) => {
  try {
    const configs = await db.select().from(schema.configuracoes).limit(1);
    if (!configs[0]) {
      return { conectado: false, syncActive: false, configured: false };
    }
    const hasKeys = !!(configs[0].googleClientId && configs[0].googleClientSecret);
    const hasToken = !!configs[0].googleRefreshToken;
    return {
      conectado: hasToken,
      syncActive: !!configs[0].googleSyncActive,
      configured: hasKeys
    };
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: 'Erro ao obter status da Google Agenda' });
  }
});

server.get('/api/google/auth-url', async (request, reply) => {
  try {
    const state = createGoogleOAuthState();
    const url = await GoogleCalendarService.getAuthUrl(state);
    return { url };
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: getErrorMessage(err, 'Erro ao gerar URL de autorização do Google') });
  }
});

server.get('/api/google/callback', async (request, reply) => {
  const { code, state, error } = request.query as { code?: string; state?: string; error?: string };
  if (error) {
    return reply.status(400).send({ error: `Autorização do Google não concluída: ${error}` });
  }
  if (!code) {
    return reply.status(400).send({ error: 'Código de autorização inválido' });
  }
  if (!state || !consumeGoogleOAuthState(state)) {
    return reply.status(400).send({
      error: 'Sessão de autorização inválida ou expirada. Volte ao GeoGestor e tente conectar novamente.'
    });
  }

  try {
    await GoogleCalendarService.authenticate(code);
    reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>GeoGestor Conectado</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #09090b; color: #f4f4f5; margin: 0; }
            .card { background-color: #18181b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 4px 30px rgba(0,0,0,0.3); text-align: center; border: 1px solid #27272a; max-width: 400px; }
            h1 { color: #14b8a6; margin-top: 0; }
            p { color: #a1a1aa; line-height: 1.6; }
            .btn { background-color: #14b8a6; color: #09090b; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: bold; cursor: pointer; margin-top: 1.5rem; font-size: 0.9rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Conectado com Sucesso!</h1>
            <p>Seu GeoGestor foi conectado com sucesso à sua conta do Google Agenda. A sincronização agora está ativa.</p>
            <button class="btn" onclick="window.close()">Fechar esta Aba</button>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: 'Erro ao autenticar com o Google' });
  }
});

server.post('/api/google/sync', async (request, reply) => {
  try {
    const results = await GoogleCalendarService.sync();
    return { success: true, ...results };
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: getErrorMessage(err, 'Erro ao sincronizar com Google Agenda') });
  }
});

// In production, serve the compiled React frontend
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Resolve path to the web dist folder
  // In packaged app: resources/app/apps/api/dist -> ../../web/dist
  const webDistPath = process.env.GEOGESTOR_WEB_DIST
    || path.resolve(__dirname, '../../web/dist');

  server.register(fastifyStatic, {
    root: webDistPath,
    prefix: '/',
  });

  // SPA fallback: any non-API route serves index.html
  server.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.status(404).send({ error: 'Not Found' });
    } else {
      return reply.sendFile('index.html');
    }
  });
}

export const start = async () => {
  const startupStartedAt = performance.now();
  const startupPhases: Record<string, number> = {};
  const measurePhase = async <T>(name: string, task: () => Promise<T>) => {
    const startedAt = performance.now();
    try {
      return await task();
    } finally {
      startupPhases[name] = Math.round((performance.now() - startedAt) * 100) / 100;
    }
  };
  try {
    if (process.env.NODE_ENV === 'production' && !process.env.GEOGESTOR_API_TOKEN) {
      throw new Error('Inicialização recusada: GEOGESTOR_API_TOKEN não foi configurado.');
    }
    if (process.env.NODE_ENV === 'production' && !process.env.GEOGESTOR_SECRET_KEY) {
      throw new Error('Inicialização recusada: a chave local de proteção de segredos não foi configurada.');
    }
    const dataDir = getDataDirectory();
    await measurePhase('dataDirectoryMs', () => fs.mkdir(dataDir, { recursive: true }));

    await measurePhase('databaseReadyMs', () => dbReady);
    
    // Run schema migrations via code
    try {
      await measurePhase('runtimeMigrationsMs', () => runRuntimeMigrations());
    } catch (error) {
      await OperationalLogService.writeRequired('database-migration-failed', { error }, 'error');
      throw error;
    }
    await measurePhase('localSecretsMs', () => LocalSecretService.migrateStoredGoogleSecrets());
    await measurePhase('operationalStateMs', () => OperationalLogService.loadState());

    const port = Number(process.env.PORT) || 3001;
    server.listen({ port, host: '127.0.0.1' }, (err, address) => {
      if (err) {
        server.log.error(err);
        process.exit(1);
      }
      
      // Inicia os serviços de agendamento em background (Backups, Calendário, etc)
      SchedulerService.start();

      const startupEvidence = {
        ...startupPhases,
        listenMs: Math.round((performance.now() - startupStartedAt) * 100) / 100,
        processUptimeMs: Math.round((performance.now() - apiProcessStartedAt) * 100) / 100
      };
      void OperationalLogService.info('api-startup-ready', startupEvidence);
      console.log(`[GEO-API] Geogestor API Server running on ${address}`);
      if (process.send) {
        process.send('ready');
      }
    });

    // Graceful Shutdown
    process.once('SIGTERM', () => {
      SchedulerService.stop();
      SchedulerService.prepareForShutdown().catch((error) => {
        server.log.error({ err: error }, 'Falha no backup configurado para o encerramento');
        process.send?.({ type: 'shutdown-backup-failed', message: getErrorMessage(error, 'O backup de encerramento falhou.') });
      }).then(() => server.close()).then(() => {
        console.log('[GEO-API] Server closed gracefully.');
        process.exit(0);
      });
    });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Auto-start when run directly (not imported by Electron)
if (require.main === module) {
  start();
}
