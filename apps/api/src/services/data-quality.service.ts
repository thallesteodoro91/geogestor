import path from 'node:path';
import fs from 'node:fs/promises';
import { createClient } from '@libsql/client';
import { databaseClientConfig } from '@geogestor/database';
import { BackupPolicyService } from './backup-policy.service';
import { BackupService } from './backup.service';
import { OperationalLogService } from './operational-log.service';
import { FileSystemService } from './fs.service';

type Severity = 'critical' | 'warning' | 'info';
type Definition = {
  module: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  sql: string;
};

const definitions: Record<string, Definition> = {
  projectsWithoutActiveClient: {
    module: 'Projetos', severity: 'critical', title: 'Projetos sem cliente ativo',
    description: 'O projeto aponta para um cliente ausente ou excluído.', recommendation: 'Revise o cliente e faça uma reatribuição auditada.',
    sql: `SELECT p.id, p.cliente_id AS clienteId, p.nome AS label FROM projetos p LEFT JOIN clientes c ON c.id=p.cliente_id AND c.deleted_at IS NULL WHERE p.deleted_at IS NULL AND c.id IS NULL`
  },
  projectsWithForeignProperty: {
    module: 'Projetos', severity: 'critical', title: 'Propriedade de outro cliente',
    description: 'O projeto e sua propriedade pertencem a clientes diferentes.', recommendation: 'Corrija o vínculo por uma operação transacional.',
    sql: `SELECT p.id, p.cliente_id AS clienteId, p.nome AS label FROM projetos p JOIN propriedades i ON i.id=p.propriedade_id WHERE p.deleted_at IS NULL AND i.cliente_id<>p.cliente_id`
  },
  budgetsWithForeignProject: {
    module: 'Orçamentos', severity: 'critical', title: 'Orçamento com projeto incompatível',
    description: 'O projeto do orçamento pertence a outro cliente.', recommendation: 'Revise o orçamento antes de qualquer movimentação financeira.',
    sql: `SELECT o.id, o.cliente_id AS clienteId, COALESCE(o.codigo_orcamento,o.id) AS label FROM orcamentos o JOIN projetos p ON p.id=o.projeto_id WHERE o.deleted_at IS NULL AND p.cliente_id<>o.cliente_id`
  },
  budgetsWithForeignProperty: {
    module: 'Orçamentos', severity: 'critical', title: 'Orçamento com propriedade incompatível',
    description: 'A propriedade do orçamento pertence a outro cliente.', recommendation: 'Selecione uma propriedade do mesmo cliente.',
    sql: `SELECT o.id, o.cliente_id AS clienteId, COALESCE(o.codigo_orcamento,o.id) AS label FROM orcamentos o JOIN propriedades i ON i.id=o.propriedade_id WHERE o.deleted_at IS NULL AND i.cliente_id<>o.cliente_id`
  },
  approvedBudgetsWithoutProject: {
    module: 'Orçamentos', severity: 'critical', title: 'Orçamentos aprovados sem projeto',
    description: 'Um orçamento contratado não possui projeto.', recommendation: 'Vincule ou crie o projeto antes de prosseguir.',
    sql: `SELECT id, cliente_id AS clienteId, COALESCE(codigo_orcamento,id) AS label FROM orcamentos WHERE deleted_at IS NULL AND lower(status) IN ('aprovado','pago') AND projeto_id IS NULL`
  },
  approvedBudgetsWithoutInstallments: {
    module: 'Financeiro', severity: 'critical', title: 'Orçamentos aprovados sem parcelas',
    description: 'A receita contratada não gerou contas a receber.', recommendation: 'Reprocesse a aprovação de forma auditada.',
    sql: `SELECT o.id, o.cliente_id AS clienteId, COALESCE(o.codigo_orcamento,o.id) AS label FROM orcamentos o WHERE o.deleted_at IS NULL AND lower(o.status) IN ('aprovado','pago') AND NOT EXISTS (SELECT 1 FROM parcelas p WHERE p.orcamento_id=o.id AND p.deleted_at IS NULL)`
  },
  installmentTotalsMismatch: {
    module: 'Financeiro', severity: 'critical', title: 'Parcelas divergentes do valor contratado',
    description: 'A soma das parcelas ativas não corresponde ao valor total do orçamento aprovado.', recommendation: 'Revise a composição das parcelas sem apagar o histórico.',
    sql: `SELECT o.id, o.cliente_id AS clienteId, COALESCE(o.codigo_orcamento,o.id) AS label FROM orcamentos o JOIN parcelas p ON p.orcamento_id=o.id AND p.deleted_at IS NULL AND p.cancelada_em IS NULL WHERE o.deleted_at IS NULL AND lower(o.status) IN ('aprovado','pago') GROUP BY o.id HAVING ABS(SUM(p.valor)-o.valor_total)>1`
  },
  installmentOverpayments: {
    module: 'Financeiro', severity: 'critical', title: 'Recebimento acima da parcela',
    description: 'O valor pago registrado supera o valor previsto da parcela.', recommendation: 'Revise recebimentos e estornos associados.',
    sql: `SELECT p.id, o.cliente_id AS clienteId, 'Parcela '||p.numero AS label FROM parcelas p JOIN orcamentos o ON o.id=p.orcamento_id WHERE p.deleted_at IS NULL AND p.valor_pago>p.valor`
  },
  tasksWithForeignProject: {
    module: 'Tarefas', severity: 'critical', title: 'Tarefas com cliente divergente',
    description: 'A tarefa e seu projeto apontam para clientes diferentes.', recommendation: 'Derive novamente o cliente a partir do projeto.',
    sql: `SELECT t.id, t.cliente_id AS clienteId, t.titulo AS label FROM tarefas t JOIN projetos p ON p.id=t.projeto_id WHERE t.deleted_at IS NULL AND t.cliente_id<>p.cliente_id`
  },
  documentsWithForeignProject: {
    module: 'Documentos', severity: 'critical', title: 'Documentos com cliente divergente',
    description: 'O documento e seu projeto apontam para clientes diferentes.', recommendation: 'Reconcilie os metadados e a pasta pela outbox.',
    sql: `SELECT d.id, d.cliente_id AS clienteId, d.nome AS label FROM documentos d JOIN projetos p ON p.id=d.projeto_id WHERE d.deleted_at IS NULL AND d.cliente_id<>p.cliente_id`
  },
  invoicesWithForeignLinks: {
    module: 'Financeiro', severity: 'critical', title: 'Notas fiscais com vínculos incompatíveis',
    description: 'A nota aponta para projeto ou orçamento de outro cliente.', recommendation: 'Revise os vínculos da nota antes de emitir relatórios.',
    sql: `SELECT n.id, n.cliente_id AS clienteId, n.numero AS label FROM notas_fiscais n LEFT JOIN projetos p ON p.id=n.projeto_id LEFT JOIN orcamentos o ON o.id=n.orcamento_id WHERE n.deleted_at IS NULL AND ((p.id IS NOT NULL AND p.cliente_id<>n.cliente_id) OR (o.id IS NOT NULL AND o.cliente_id<>n.cliente_id))`
  },
  projectsWithoutProperty: {
    module: 'Propriedades', severity: 'warning', title: 'Projetos sem propriedade estruturada',
    description: 'O projeto ainda não está ligado a uma propriedade estruturada.', recommendation: 'Cadastre ou vincule a propriedade quando aplicável.',
    sql: `SELECT id, cliente_id AS clienteId, nome AS label FROM projetos WHERE deleted_at IS NULL AND propriedade_id IS NULL`
  },
  legacyPropertyData: {
    module: 'Propriedades', severity: 'warning', title: 'Dados imobiliários legados',
    description: 'Existem campos de imóvel no projeto sem propriedade estruturada.', recommendation: 'Execute a migração assistida de propriedades.',
    sql: `SELECT id, cliente_id AS clienteId, nome AS label FROM projetos WHERE deleted_at IS NULL AND propriedade_id IS NULL AND COALESCE(matricula,car,ccir,itr,situacao_imovel) IS NOT NULL`
  }
};

function databasePath() {
  return process.env.GEOGESTOR_DB_PATH || path.resolve(__dirname, '../../../../data/geogestor.db');
}

export class DataQualityService {
  static async inspect(filters: { module?: string; severity?: Severity; clienteId?: string } = {}) {
    const client = createClient(databaseClientConfig(databasePath()));
    const issues = [] as Array<{
      code: string; module: string; severity: Severity; title: string; description: string;
      recommendation: string; count: number; records: Array<{ id: string; clienteId: string | null; label: string }>;
    }>;
    try {
      for (const [code, definition] of Object.entries(definitions)) {
        if (filters.module && definition.module !== filters.module) continue;
        if (filters.severity && definition.severity !== filters.severity) continue;
        try {
          const result = await client.execute(definition.sql);
          const records = result.rows.map((row) => ({
            id: String(row.id), clienteId: row.clienteId ? String(row.clienteId) : null, label: String(row.label || row.id)
          })).filter((record) => !filters.clienteId || record.clienteId === filters.clienteId);
          if (!records.length) continue;
          issues.push({ code, ...definition, count: records.length, records: records.slice(0, 200) });
        } catch (error) {
          if (!/no such table|no such column/i.test(error instanceof Error ? error.message : String(error))) throw error;
        }
      }
      if ((!filters.module || filters.module === 'Documentos') && (!filters.severity || filters.severity === 'warning')) {
        try {
          const root = await FileSystemService.getRootFolder();
          const documentRows = await client.execute("SELECT id, cliente_id AS clienteId, nome AS label, caminho, caminho_relativo AS caminhoRelativo FROM documentos WHERE deleted_at IS NULL");
          const missing = [] as Array<{ id: string; clienteId: string | null; label: string }>;
          for (const row of documentRows.rows) {
            if (filters.clienteId && String(row.clienteId || '') !== filters.clienteId) continue;
            const stored = String(row.caminhoRelativo || row.caminho || '');
            if (!stored) {
              missing.push({ id: String(row.id), clienteId: row.clienteId ? String(row.clienteId) : null, label: String(row.label || row.id) });
              continue;
            }
            const target = path.isAbsolute(stored) ? stored : path.resolve(root, stored);
            const exists = await fs.access(target).then(() => true).catch(() => false);
            if (!exists) missing.push({ id: String(row.id), clienteId: row.clienteId ? String(row.clienteId) : null, label: String(row.label || row.id) });
          }
          if (missing.length) issues.push({
            code: 'missingDocumentFiles', module: 'Documentos', severity: 'warning',
            title: 'Documentos ausentes no disco', description: 'O banco possui metadados de arquivos que não foram encontrados.',
            recommendation: 'Restaure o arquivo por um backup completo ou corrija o vínculo de forma auditada.',
            count: missing.length, records: missing.slice(0, 200)
          });
        } catch {
          // A pasta de documentos não configurada já aparece no diagnóstico operacional.
        }
      }
    } finally {
      await client.close();
    }

    const operationState = OperationalLogService.getState();
    const failedOutbox = Number(operationState.outbox?.details?.failed || 0);
    if (failedOutbox > 0 && (!filters.module || filters.module === 'Arquivos') && (!filters.severity || filters.severity === 'critical')) {
      issues.push({
        code: 'failedFilesystemOperations', module: 'Arquivos', severity: 'critical',
        title: 'Operações de arquivos com falha', description: 'A outbox não concluiu todas as operações.',
        recommendation: 'Execute a reconciliação e consulte os logs.', count: failedOutbox, records: []
      });
    }
    const policy = await BackupPolicyService.get();
    const storage = await BackupService.getStorageStatus(policy.destinationDirectory);
    return {
      checkedAt: new Date().toISOString(),
      status: issues.some((issue) => issue.severity === 'critical') ? 'degraded' : 'ok',
      summary: {
        issues: issues.reduce((sum, issue) => sum + issue.count, 0),
        critical: issues.filter((issue) => issue.severity === 'critical').reduce((sum, issue) => sum + issue.count, 0),
        warnings: issues.filter((issue) => issue.severity === 'warning').reduce((sum, issue) => sum + issue.count, 0)
      },
      backup: { policy, storage },
      issues
    };
  }
}
