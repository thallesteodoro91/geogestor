import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { isValidCnpj } from '@geogestor/contracts';
import { schema } from '@geogestor/database';
import { db } from './db';
import { AuditLogService } from './services/audit.service';
import { GoogleCalendarService } from './services/google-calendar.service';
import { LocalSecretService } from './services/local-secret.service';
import { LocalSessionService, verifyAdminPassword } from './services/local-session.service';
import { OperationalLogService } from './services/operational-log.service';

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

const unlockSchema = z.object({
  password: z.string().min(1, 'Informe a senha local.').max(200)
}).strict();

const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const googleOAuthStates = new Map<string, number>();

function validationError(error: z.ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] ? String(issue.path[0]) : '_root';
    if (!fields[field]) fields[field] = issue.message;
  }
  return { error: 'Revise os campos informados e tente novamente.', fields };
}

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

function sanitizeConfiguracao(config: typeof schema.configuracoes.$inferSelect | null | undefined) {
  if (!config) return null;
  const { adminSenhaHash, googleClientSecret, googleRefreshToken, googleAccessToken, ...safeConfig } = config;
  return {
    ...safeConfig,
    googleClientSecretConfigured: Boolean(googleClientSecret)
  };
}

function getRequestToken(request: FastifyRequest, name: string) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function registerLocalAuthRoutes(server: FastifyInstance) {
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


}

export function registerConfigurationAndGoogleRoutes(
  server: FastifyInstance,
  getErrorMessage: (error: unknown, fallback: string) => string
) {
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


}

