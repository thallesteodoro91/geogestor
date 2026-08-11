export type BackupOperationStatus = {
  status: 'current' | 'overdue' | 'incomplete' | 'failed' | 'running';
  completedAt: string | null;
  error?: string | null;
};

export type PostUpdateBackupStatus = {
  database: BackupOperationStatus;
  complete: BackupOperationStatus;
  activity: { pendingChanges: number };
  cloud: { confirmation: 'unavailable' | 'pending' | 'confirmed' | 'failed' };
  recovery: { configured: boolean; confirmed: boolean };
  summary: {
    state: 'not_configured' | 'running' | 'failed' | 'pending' | 'protected' | 'created' | 'incomplete';
    configured: boolean;
    integrity: string | null;
  };
};

export type PostUpdateAssessment = {
  level: 'ok' | 'warning' | 'critical';
  criticalReasons: string[];
  warnings: string[];
};

const failedBackupStatuses = new Set<BackupOperationStatus['status']>(['overdue', 'incomplete', 'failed']);

export function assessPostUpdateStatus(input: {
  healthOk: boolean;
  qualityCritical: number;
  backups: PostUpdateBackupStatus;
}): PostUpdateAssessment {
  const criticalReasons: string[] = [];
  const warnings: string[] = [];

  if (!input.healthOk) criticalReasons.push('A integridade do banco ou dos vínculos exige revisão.');
  if (input.qualityCritical > 0) criticalReasons.push(`${input.qualityCritical} problema(s) crítico(s) de qualidade foram encontrados.`);
  if (failedBackupStatuses.has(input.backups.database.status)) criticalReasons.push('O backup do banco está vencido, incompleto ou com falha.');
  if (failedBackupStatuses.has(input.backups.complete.status)) criticalReasons.push('O backup completo está vencido, incompleto ou com falha.');
  if (input.backups.summary.integrity !== 'verified') criticalReasons.push('O último backup não possui integridade verificada.');
  if (input.backups.activity.pendingChanges > 0 && input.backups.summary.state !== 'protected') {
    criticalReasons.push(`${input.backups.activity.pendingChanges} alteração(ões) ainda não estão protegidas por backup confirmado.`);
  }

  if (!input.backups.summary.configured || input.backups.cloud.confirmation !== 'confirmed') {
    warnings.push('Configure uma cópia externa ou sincronizada para proteger os dados fora deste computador.');
  }
  if (!input.backups.recovery.configured || !input.backups.recovery.confirmed) {
    warnings.push('Configure e confirme o kit de recuperação de emergência.');
  }

  return {
    level: criticalReasons.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'ok',
    criticalReasons,
    warnings
  };
}

