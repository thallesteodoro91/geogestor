import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { db, dbReady } from './db';
import { schema } from '@geogestor/database';
import { eq } from 'drizzle-orm';
import { clientesRoutes } from './routes/clientes.routes';
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
import { runRuntimeMigrations } from './services/runtime-migrations.service';
import { FileSystemService } from './services/fs.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { SchedulerService } from './services/scheduler.service';
import { BackupService } from './services/backup.service';
import { LocalSecretService } from './services/local-secret.service';

function redactRequestUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, 'http://127.0.0.1');
    for (const key of ['token', 'access_token', 'refresh_token', 'code']) {
      if (parsed.searchParams.has(key)) parsed.searchParams.set(key, '[REDACTED]');
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return rawUrl.split('?')[0];
  }
}

export const server = Fastify({
  logger: {
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: redactRequestUrl(request.url),
          hostname: request.hostname,
          remoteAddress: request.ip
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
  const { adminSenhaHash, googleRefreshToken, googleAccessToken, ...safeConfig } = config;
  return {
    ...safeConfig,
    googleClientSecret: LocalSecretService.reveal(safeConfig.googleClientSecret)
  };
}

function tokensMatch(candidate: unknown, expected: string) {
  if (typeof candidate !== 'string') return false;
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return candidateBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

// Hook para segurança de acesso local à API
server.addHook('onRequest', async (request, reply) => {
  const token = process.env.GEOGESTOR_API_TOKEN;
  if (!token) {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(503).send({ error: 'A API local não iniciou com uma credencial válida.' });
    }
    return;
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

  const queryTokenAllowed = request.method === 'GET'
    && (requestPath === '/api/arquivos/download' || requestPath === '/api/arquivos/preview');
  const requestToken = request.headers['x-api-token']
    || (request.headers['authorization']?.toString().startsWith('Bearer ')
      ? request.headers['authorization'].toString().slice(7)
      : undefined)
    || (queryTokenAllowed ? (request.query as any)?.token : undefined);

  if (!tokensMatch(requestToken, token)) {
    return reply.status(401).send({ error: 'Unauthorized: Invalid API Token' });
  }
});

const getDatabasePath = () =>
  process.env.GEOGESTOR_DB_PATH || path.resolve(__dirname, '../../../data/geogestor.db');

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
      : new Set(['http://localhost:5173', 'http://127.0.0.1:5173', `http://127.0.0.1:${port}`]);
    callback(null, allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// Registrar rotas modulares
server.register(clientesRoutes, { prefix: '/api/clientes' });
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

// Health check
server.get('/api/health', async (request, reply) => {
  return { status: 'ok', time: new Date().toISOString() };
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

  return {
    mode: process.env.NODE_ENV || 'development',
    desktop: Boolean(process.env.GEOGESTOR_DB_PATH),
    databasePath,
    dataDirectory,
    backupDirectory: path.join(dataDirectory, 'backups'),
    filesRootDirectory,
    webDistPath: process.env.GEOGESTOR_WEB_DIST || null
  };
});

server.post('/api/sistema/backup', async (request, reply) => {
  try {
    const result = await BackupService.createLocalBackup();
    return {
      message: 'Backup criado com sucesso',
      ...result
    };
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: 'Erro ao criar backup local' });
  }
});

const resetHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const recoveryBackup = await BackupService.createLocalBackup();
    await db.transaction(async (tx) => {
      // Filhos primeiro para preservar a integridade referencial sem desligar
      // as foreign keys da conexão durante a limpeza.
      await tx.delete(schema.auditLogs);
      await tx.delete(schema.documentos);
      await tx.delete(schema.interacoes_cliente);
      await tx.delete(schema.oportunidades);
      await tx.delete(schema.compromissos);
      await tx.delete(schema.tarefas);
      await tx.delete(schema.despesas);
      await tx.delete(schema.parcelas);
      await tx.delete(schema.orcamentoProjetos);
      await tx.delete(schema.orcamentoVersoes);
      await tx.delete(schema.orcamentoStatusHistorico);
      await tx.delete(schema.orcamentoCondicoesPagamento);
      await tx.delete(schema.orcamentoImpostos);
      await tx.delete(schema.orcamento_despesas);
      await tx.delete(schema.orcamento_itens);
      await tx.delete(schema.orcamentos);
      await tx.delete(schema.tributos);
      await tx.delete(schema.perfisTributarios);
      await tx.delete(schema.orcamentoModelos);
      await tx.delete(schema.parametrosPrecificacao);
      await tx.delete(schema.projetos);
      await tx.delete(schema.clientes);
      await tx.delete(schema.contatos);
    });

    return {
      message: 'Todos os dados foram apagados com sucesso',
      recoveryBackupPath: recoveryBackup.bundlePath
    };
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: getErrorMessage(err, 'Erro ao apagar informações do banco de dados') });
  }
};

server.post('/api/sistema/reset-dados', resetHandler);
server.delete('/api/sistema/reset', resetHandler);

server.get('/api/sistema/backup-completo/preflight', async (request, reply) => {
  try {
    const databasePath = getDatabasePath();
    const dataDirectory = getDataDirectory();
    const backupDirectory = path.join(dataDirectory, 'backups');
    const filesRootDirectory = await FileSystemService.getRootFolder();
    const [databaseStats, filesStats] = await Promise.all([
      getDatabaseBundleStats(databasePath),
      getPathStats(filesRootDirectory)
    ]);

    return {
      databasePath,
      filesRootDirectory,
      backupDirectory,
      databaseStats,
      filesStats,
      totalBytes: databaseStats.bytes + filesStats.bytes,
      totalFiles: databaseStats.files + filesStats.files
    };
  } catch (err) {
    server.log.error(err);
    return reply.status(500).send({ error: 'Erro ao calcular estimativa do backup completo' });
  }
});

server.post('/api/sistema/backup-completo', async (request, reply) => {
  try {
    const databasePath = getDatabasePath();
    const filesRootDirectory = await FileSystemService.getRootFolder();
    const [databaseStats, filesStats] = await Promise.all([
      getDatabaseBundleStats(databasePath),
      getPathStats(filesRootDirectory)
    ]);
    const backup = await BackupService.createCompleteBackup(filesRootDirectory);

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
    server.log.error(err);
    return reply.status(500).send({ error: 'Erro ao criar backup completo' });
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

// Configuracoes
server.get('/api/configuracoes', async (request, reply) => {
  const configs = await db.select().from(schema.configuracoes).limit(1);
  return sanitizeConfiguracao(configs[0]);
});

server.post('/api/configuracoes', async (request, reply) => {
  const data = request.body as any;
  const existingConfigs = await db.select({ id: schema.configuracoes.id }).from(schema.configuracoes).limit(1);
  if (existingConfigs.length > 0) {
    return reply.status(409).send({ error: 'A configuração inicial já foi concluída.' });
  }

  if (!data.empresaNome || !data.dadosPasta || !data.adminNome || !data.adminEmail) {
    return reply.status(400).send({ error: 'Preencha todos os dados obrigatórios da configuração inicial.' });
  }

  if (typeof data.adminSenha !== 'string' || data.adminSenha.length < 8) {
    return reply.status(400).send({ error: 'A senha local deve ter pelo menos 8 caracteres.' });
  }

  const config = await db.insert(schema.configuracoes).values({
    id: crypto.randomUUID(),
    empresaNome: data.empresaNome,
    dadosPasta: data.dadosPasta,
    adminNome: data.adminNome,
    adminEmail: data.adminEmail,
    adminSenhaHash: hashAdminPassword(data.adminSenha),
    setupConcluido: true
  }).returning();
  return sanitizeConfiguracao(config[0]);
});

server.patch('/api/configuracoes', async (request, reply) => {
  const data = request.body as any;
  try {
    if (data.adminSenha !== undefined && (typeof data.adminSenha !== 'string' || data.adminSenha.length < 8)) {
      return reply.status(400).send({ error: 'A senha local deve ter pelo menos 8 caracteres.' });
    }

    const configs = await db.select().from(schema.configuracoes).limit(1);
    
    if (configs.length > 0) {
      const configAtualizada = await db.update(schema.configuracoes).set({
        empresaNome: data.empresaNome !== undefined ? data.empresaNome : undefined,
        dadosPasta: data.dadosPasta !== undefined ? data.dadosPasta : undefined,
        adminNome: data.adminNome !== undefined ? data.adminNome : undefined,
        adminEmail: data.adminEmail !== undefined ? data.adminEmail : undefined,
        adminSenhaHash: data.adminSenha !== undefined ? hashAdminPassword(data.adminSenha) : undefined,
        googleClientId: data.googleClientId !== undefined ? data.googleClientId : undefined,
        googleClientSecret: data.googleClientSecret !== undefined ? LocalSecretService.protect(data.googleClientSecret) : undefined,
        googleRefreshToken: data.googleRefreshToken !== undefined ? LocalSecretService.protect(data.googleRefreshToken) : undefined,
        googleAccessToken: data.googleAccessToken !== undefined ? LocalSecretService.protect(data.googleAccessToken) : undefined,
        googleSyncActive: data.googleSyncActive !== undefined ? data.googleSyncActive : undefined,
        updatedAt: new Date().toISOString()
      }).where(eq(schema.configuracoes.id, configs[0].id)).returning();
      return sanitizeConfiguracao(configAtualizada[0]);
    } else {
      const newConfig = await db.insert(schema.configuracoes).values({
        id: crypto.randomUUID(),
        empresaNome: data.empresaNome || 'GeoGestor',
        dadosPasta: data.dadosPasta || '~/GeoGestor',
        adminNome: data.adminNome || 'Administrador',
        adminEmail: data.adminEmail || 'admin@geogestor.com',
        adminSenhaHash: hashAdminPassword(data.adminSenha),
        setupConcluido: true,
        googleClientId: data.googleClientId || null,
        googleClientSecret: LocalSecretService.protect(data.googleClientSecret || null),
        googleRefreshToken: LocalSecretService.protect(data.googleRefreshToken || null),
        googleAccessToken: LocalSecretService.protect(data.googleAccessToken || null),
        googleSyncActive: data.googleSyncActive || false
      }).returning();
      return sanitizeConfiguracao(newConfig[0]);
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
  try {
    if (process.env.NODE_ENV === 'production' && !process.env.GEOGESTOR_API_TOKEN) {
      throw new Error('Inicialização recusada: GEOGESTOR_API_TOKEN não foi configurado.');
    }
    if (process.env.NODE_ENV === 'production' && !process.env.GEOGESTOR_SECRET_KEY) {
      throw new Error('Inicialização recusada: a chave local de proteção de segredos não foi configurada.');
    }
    const dataDir = getDataDirectory();
    await fs.mkdir(dataDir, { recursive: true });

    await dbReady;
    
    // Run schema migrations via code
    await runRuntimeMigrations();
    await LocalSecretService.migrateStoredGoogleSecrets();

    const port = Number(process.env.PORT) || 3001;
    server.listen({ port, host: '127.0.0.1' }, (err, address) => {
      if (err) {
        server.log.error(err);
        process.exit(1);
      }
      
      // Inicia os serviços de agendamento em background (Backups, Calendário, etc)
      SchedulerService.start();

      console.log(`[GEO-API] Geogestor API Server running on ${address}`);
      if (process.send) {
        process.send('ready');
      }
    });

    // Graceful Shutdown
    process.on('SIGTERM', () => {
      SchedulerService.stop();
      server.close().then(() => {
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
