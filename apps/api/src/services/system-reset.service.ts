import { schema } from '@geogestor/database';
import { db } from '../db';
import { BackupService } from './backup.service';
import { OperationalLogService } from './operational-log.service';
import { MaintenanceCoordinator } from './maintenance-coordinator.service';

type BackupResult = Awaited<ReturnType<typeof BackupService.createLocalBackup>>;

type ResetDependencies = {
  createBackup: () => Promise<BackupResult>;
  validateBackup: (bundlePath: string) => Promise<unknown>;
  beforeDelete?: (tableName: string) => Promise<void>;
};

const defaultDependencies: ResetDependencies = {
  createBackup: () => BackupService.createLocalBackup(),
  validateBackup: (bundlePath) => BackupService.validateBackup(bundlePath)
};

export class ResetInProgressError extends Error {
  constructor() {
    super('Já existe uma redefinição de dados em andamento.');
    this.name = 'ResetInProgressError';
  }
}

export class SystemResetService {
  private static running = false;
  private static dependencies: ResetDependencies = defaultDependencies;

  static configureForTests(dependencies: Partial<ResetDependencies> | null) {
    if (process.env.NODE_ENV !== 'test' && !process.env.GEOGESTOR_DB_PATH?.includes('scratch')) {
      throw new Error('Dependências de reset só podem ser substituídas em ambiente de teste.');
    }
    this.dependencies = dependencies ? { ...defaultDependencies, ...dependencies } : defaultDependencies;
  }

  static async resetOperationalData() {
    if (this.running) throw new ResetInProgressError();
    this.running = true;
    const startedAt = new Date().toISOString();

    return MaintenanceCoordinator.runExclusive('reset', async () => {
    try {
      const recoveryBackup = await this.dependencies.createBackup();
      await this.dependencies.validateBackup(recoveryBackup.bundlePath);
      await OperationalLogService.writeRequired('operational-data-reset-started', {
        startedAt,
        backupCreated: true
      });

      await db.transaction(async (tx) => {
        const deletionPlan = [
          ['filesystem_operations', () => tx.delete(schema.filesystemOperations)],
          ['audit_logs', () => tx.delete(schema.auditLogs)],
          ['documentos', () => tx.delete(schema.documentos)],
          ['interacoes_cliente', () => tx.delete(schema.interacoes_cliente)],
          ['oportunidades', () => tx.delete(schema.oportunidades)],
          ['compromissos', () => tx.delete(schema.compromissos)],
          ['tarefas', () => tx.delete(schema.tarefas)],
          ['despesas', () => tx.delete(schema.despesas)],
          ['parcelas', () => tx.delete(schema.parcelas)],
          ['orcamento_projetos', () => tx.delete(schema.orcamentoProjetos)],
          ['orcamento_versoes', () => tx.delete(schema.orcamentoVersoes)],
          ['orcamento_status_historico', () => tx.delete(schema.orcamentoStatusHistorico)],
          ['orcamento_condicoes_pagamento', () => tx.delete(schema.orcamentoCondicoesPagamento)],
          ['orcamento_impostos', () => tx.delete(schema.orcamentoImpostos)],
          ['orcamento_despesas', () => tx.delete(schema.orcamento_despesas)],
          ['orcamento_itens', () => tx.delete(schema.orcamento_itens)],
          ['orcamentos', () => tx.delete(schema.orcamentos)],
          ['tributos', () => tx.delete(schema.tributos)],
          ['perfis_tributarios', () => tx.delete(schema.perfisTributarios)],
          ['orcamento_modelos', () => tx.delete(schema.orcamentoModelos)],
          ['parametros_precificacao', () => tx.delete(schema.parametrosPrecificacao)],
          ['projetos', () => tx.delete(schema.projetos)],
          ['clientes', () => tx.delete(schema.clientes)],
          ['contatos', () => tx.delete(schema.contatos)]
        ] as const;

        for (const [tableName, remove] of deletionPlan) {
          if (this.dependencies.beforeDelete) await this.dependencies.beforeDelete(tableName);
          await remove();
        }
      });

      const completedAt = new Date().toISOString();
      await OperationalLogService.writeRequired('operational-data-reset-completed', {
        startedAt,
        completedAt,
        backupCreated: true
      });
      return {
        message: 'Todos os dados operacionais do banco de dados foram apagados com sucesso',
        recoveryBackupPath: recoveryBackup.bundlePath
      };
    } catch (error) {
      await OperationalLogService.error('operational-data-reset-failed', { startedAt, error });
      throw error;
    } finally {
      this.running = false;
    }
    });
  }
}
