import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'node:perf_hooks';
import { dbReady } from './db';
import { LocalSecretService } from './services/local-secret.service';
import { OperationalLogService } from './services/operational-log.service';
import { runRuntimeMigrations } from './services/runtime-migrations.service';
import { SchedulerService } from './services/scheduler.service';

export function configureProductionFrontend(server: FastifyInstance) {
  if (process.env.NODE_ENV !== 'production') return;

  const webDistPath = process.env.GEOGESTOR_WEB_DIST
    || path.resolve(__dirname, '../../web/dist');

  server.register(fastifyStatic, {
    root: webDistPath,
    prefix: '/'
  });

  server.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not Found' });
    }
    return reply.sendFile('index.html');
  });
}

interface StartServerOptions {
  server: FastifyInstance;
  apiProcessStartedAt: number;
  getDataDirectory: () => string;
  getErrorMessage: (error: unknown, fallback: string) => string;
}

export async function startServer({
  server,
  apiProcessStartedAt,
  getDataDirectory,
  getErrorMessage
}: StartServerOptions) {
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
    if (process.env.NODE_ENV === 'production' && !process.env.GEOGESTOR_RESTORE_AUTH_SECRET) {
      throw new Error('Inicialização recusada: a autorização segura de restauração não foi configurada.');
    }

    await measurePhase('dataDirectoryMs', () => fs.mkdir(getDataDirectory(), { recursive: true }));
    await measurePhase('databaseReadyMs', () => dbReady);

    try {
      await measurePhase('runtimeMigrationsMs', () => runRuntimeMigrations());
    } catch (error) {
      await OperationalLogService.writeRequired('database-migration-failed', { error }, 'error');
      throw error;
    }

    await measurePhase('localSecretsMs', () => LocalSecretService.migrateStoredGoogleSecrets());
    await measurePhase('operationalStateMs', () => OperationalLogService.loadState());

    const port = Number(process.env.PORT) || 3001;
    const schedulerEnabled = process.env.GEOGESTOR_DISABLE_SCHEDULER !== '1';
    server.listen({ port, host: '127.0.0.1' }, (error, address) => {
      if (error) {
        server.log.error(error);
        process.exit(1);
      }

      if (schedulerEnabled) SchedulerService.start();
      else console.log('[SchedulerService] Desativado pelo ambiente controlado de testes.');

      void OperationalLogService.info('api-startup-ready', {
        ...startupPhases,
        listenMs: Math.round((performance.now() - startupStartedAt) * 100) / 100,
        processUptimeMs: Math.round((performance.now() - apiProcessStartedAt) * 100) / 100
      });
      console.log(`[GEO-API] Geogestor API Server running on ${address}`);
      process.send?.('ready');
    });

    let shutdownStarted = false;
    const shutdownGracefully = async (prepareBackup: boolean) => {
      if (shutdownStarted) return;
      shutdownStarted = true;
      SchedulerService.stop();
      if (prepareBackup) {
        await SchedulerService.prepareForShutdown().catch((error) => {
          server.log.error({ err: error }, 'Falha no backup configurado para o encerramento');
          process.send?.({ type: 'shutdown-backup-failed', message: getErrorMessage(error, 'O backup de encerramento falhou.') });
        });
      }
      await server.close();
      console.log('[GEO-API] Server closed gracefully.');
      process.exit(0);
    };
    const requestGracefulShutdown = (prepareBackup: boolean) => {
      void shutdownGracefully(prepareBackup).catch((error) => {
        server.log.error({ err: error }, 'Falha durante o encerramento gracioso');
        process.exit(1);
      });
    };

    process.once('SIGTERM', () => requestGracefulShutdown(schedulerEnabled));
    if (process.env.GEOGESTOR_E2E_ROOT) {
      process.once('message', (message: unknown) => {
        if (typeof message === 'object' && message !== null && (message as { type?: string }).type === 'geogestor:e2e-shutdown') {
          requestGracefulShutdown(false);
        }
      });
    }
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}
