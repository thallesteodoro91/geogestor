import { schema } from '@geogestor/database';
import { db } from '../db';
import { BackupService } from './backup.service';
import { OperationalLogService } from './operational-log.service';
import { MaintenanceCoordinator } from './maintenance-coordinator.service';
import { BackupPolicyService } from './backup-policy.service';
import { AuditLogService } from './audit.service';
import { MaintenanceHistoryService } from './maintenance-history.service';

type BackupResult = Awaited<ReturnType<typeof BackupService.createLocalBackup>>;

type ResetDependencies = {
  createBackup: () => Promise<BackupResult>;
  validateBackup: (bundlePath: string) => Promise<unknown>;
  beforeDelete?: (tableName: string) => Promise<void>;
};

const defaultDependencies: ResetDependencies = {
  createBackup: async () => {
    const policy = await BackupPolicyService.get();
    return BackupService.createLocalBackup({
      destinationDirectory: policy.destinationDirectory,
      retention: policy.retention,
      maxStorageBytes: policy.maxStorageBytes
    });
  },
  validateBackup: async (bundlePath) => {
    const policy = await BackupPolicyService.get();
    return BackupService.validateBackup(bundlePath, BackupService.getBackupDirectory(policy.destinationDirectory));
  }
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
    const startedAtMs = Date.now();

    return MaintenanceCoordinator.runExclusive('reset', async () => {
    try {
      const recoveryBackup = await this.dependencies.createBackup();
      await this.dependencies.validateBackup(recoveryBackup.bundlePath);
      await OperationalLogService.writeRequired('operational-data-reset-started', {
        startedAt,
        backupCreated: true
      });

      const removedByTable = await db.transaction(async (tx) => {
        const removed: Record<string, number> = {};
        const deletionPlan = [
          ['alerta_ocorrencias', () => tx.delete(schema.alertaOcorrencias)],
          ['snapshots_estrategicos', () => tx.delete(schema.snapshotsEstrategicos)],
          ['decisoes_estrategicas', () => tx.delete(schema.decisoesEstrategicas)],
          ['riscos_estrategicos', () => tx.delete(schema.riscosEstrategicos)],
          ['checkins_estrategicos', () => tx.delete(schema.checkinsEstrategicos)],
          ['iniciativas_estrategicas', () => tx.delete(schema.iniciativasEstrategicas)],
          ['resultados_chave', () => tx.delete(schema.resultadosChave)],
          ['objetivos_estrategicos', () => tx.delete(schema.objetivosEstrategicos)],
          ['pilares_estrategicos', () => tx.delete(schema.pilaresEstrategicos)],
          ['ciclos_estrategicos', () => tx.delete(schema.ciclosEstrategicos)],
          ['condicionantes_ambientais', () => tx.delete(schema.condicionantesAmbientais)],
          ['licencas', () => tx.delete(schema.licencas)],
          ['ambiental', () => tx.delete(schema.ambiental)],
          ['pericias', () => tx.delete(schema.pericias)],
          ['despesa_documentos', () => tx.delete(schema.despesaDocumentos)],
          ['notas_fiscais', () => tx.delete(schema.notasFiscais)],
          ['financeiro_eventos', () => tx.delete(schema.financeiroEventos)],
          ['projeto_financeiro_decisoes', () => tx.delete(schema.projetoFinanceiroDecisoes)],
          ['recebimentos', () => tx.delete(schema.recebimentos)],
          ['oportunidade_estagios_historico', () => tx.delete(schema.oportunidadeEstagiosHistorico)],
          ['filesystem_operations', () => tx.delete(schema.filesystemOperations)],
          ['documentos', () => tx.delete(schema.documentos)],
          ['interacoes_cliente', () => tx.delete(schema.interacoes_cliente)],
          ['oportunidades', () => tx.delete(schema.oportunidades)],
          ['compromissos', () => tx.delete(schema.compromissos)],
          ['tarefas', () => tx.delete(schema.tarefas)],
          ['despesas', () => tx.delete(schema.despesas)],
          ['viagens', () => tx.delete(schema.viagens)],
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
          ['calculos_salvos', () => tx.delete(schema.calculosSalvos)],
          ['projetos', () => tx.delete(schema.projetos)],
          ['propriedades', () => tx.delete(schema.propriedades)],
          ['clientes', () => tx.delete(schema.clientes)],
          ['contatos', () => tx.delete(schema.contatos)]
        ] as const;

        for (const [tableName, remove] of deletionPlan) {
          if (this.dependencies.beforeDelete) await this.dependencies.beforeDelete(tableName);
          const rows = await remove().returning();
          removed[tableName] = rows.length;
        }
        await AuditLogService.log('DELETE', 'ResetOperacional', null, {
          startedAt,
          recoveryBackupCreated: true,
          removedByTable: removed
        }, tx);
        return removed;
      });

      const completedAt = new Date().toISOString();
      await OperationalLogService.writeRequired('operational-data-reset-completed', {
        startedAt,
        completedAt,
        backupCreated: true,
        removedByTable
      });
      const removedTotal = Object.values(removedByTable).reduce((sum, value) => sum + value, 0);
      await MaintenanceHistoryService.record({
        type: 'operational_reset',
        status: 'success',
        startedAt,
        durationMs: Date.now() - startedAtMs,
        sourceLabel: 'dados operacionais',
        destinationLabel: recoveryBackup.bundlePath,
        files: null,
        bytes: null,
        user: 'admin',
        auditId: null,
        details: { removedRecords: removedTotal, recoveryBackupCreated: true }
      });
      return {
        message: 'Todos os dados operacionais do banco de dados foram apagados com sucesso',
        recoveryBackupPath: recoveryBackup.bundlePath,
        removedByTable,
        removedTotal,
        preserved: ['configuracoes', 'configuracoes_operacionais', 'alerta_configuracao', 'alerta_categoria_configuracao', 'audit_logs']
      };
    } catch (error) {
      await OperationalLogService.error('operational-data-reset-failed', { startedAt, error });
      await MaintenanceHistoryService.record({
        type: 'operational_reset',
        status: 'failed',
        startedAt,
        durationMs: Date.now() - startedAtMs,
        sourceLabel: 'dados operacionais',
        destinationLabel: 'backup de recuperação',
        files: null,
        bytes: null,
        user: 'admin',
        auditId: null,
        error
      }).catch(() => undefined);
      throw error;
    } finally {
      this.running = false;
    }
    });
  }
}
