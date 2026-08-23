import type { BackupSummaryState } from './backupProtectionPresentation';

export type MaintenanceOperation = {
  id: string;
  type: 'backup_database' | 'backup_complete' | 'restore_test' | 'integrity_check';
  status: 'running' | 'success' | 'failed' | 'cancelled';
  stage: string;
  startedAt: string;
  processedFiles: number;
  processedBytes: number;
  totalFiles: number;
  totalBytes: number;
  cancelRequested: boolean;
  cancellable: boolean;
};

export type IntegrityState =
  | 'verified_at_creation'
  | 'verified_again'
  | 'failed'
  | 'legacy_unverified';

export type BackupHistoryItem = {
  directory: string;
  type: 'database' | 'complete';
  completedAt: string;
  files: number;
  bytes: number;
  integrity: string;
  integrityState: IntegrityState;
  integrityVerifiedAt: string | null;
  restoreTestedAt: string | null;
  legacy?: boolean;
  formatVersion?: number | null;
};

export type BackupStatus = {
  policy: {
    destinationDirectory: string | null;
    automaticEnabled: boolean;
    changeDebounceMinutes: number;
    databaseIntervalHours: number;
    completeIntervalDays: number;
    retention: number;
    runRestoreTests: boolean;
    restoreTestIntervalDays: number;
  };
  storage: { backupDirectory: string; history: BackupHistoryItem[] };
  activity: {
    pendingChanges: number;
    lastChangeAt: string | null;
    lastProtectedAt: string | null;
  };
  device: { id: string; name: string };
  cloud: {
    confirmation: 'unavailable' | 'pending' | 'confirmed' | 'failed';
    message: string;
    confirmedAt: string | null;
    error: string | null;
  };
  recovery: {
    configured: boolean;
    confirmed: boolean;
    confirmedAt: string | null;
    keyId: string | null;
    state: 'configured' | 'not_confirmed' | 'device_only';
  };
  database: {
    completedAt: string | null;
    nextAt: string | null;
    status: string;
    error: string | null;
  };
  complete: {
    completedAt: string | null;
    nextAt: string | null;
    status: string;
    error: string | null;
  };
  restoreTest: {
    status: 'success' | 'failed';
    completedAt: string;
    error?: string | null;
    errorMessage?: string | null;
  } | null;
  activeOperation: MaintenanceOperation | null;
  protection: {
    local: {
      state: 'running' | 'failed' | 'empty' | 'overdue' | 'pending' | 'current';
      lastBackupAt: string | null;
      integrity: string | null;
      verifiedAt: string | null;
    };
    external: {
      state: 'not_configured' | 'confirmed' | 'failed' | 'pending' | 'configured_unverified';
      message: string;
    };
    recovery: { state: 'device_only' | 'confirmed' | 'not_confirmed' };
    restoreTest: {
      state: 'failed' | 'never_tested' | 'due' | 'tested';
      completedAt: string | null;
      durationMs: number | null;
    };
    objectives: {
      maximumUnprotectedMinutes: number;
      observedRestoreTimeMs: number | null;
    };
  };
  summary: {
    state: BackupSummaryState;
    configured: boolean;
    pendingChanges: number;
    lastBackupAt: string | null;
    integrity: string | null;
    label: string;
    description: string;
  };
};

export type NativeRecoveryStatus = {
  configured: boolean;
  confirmed: boolean;
  confirmedAt: string | null;
  keyId: string;
};

export type BackupOperationFeedback = {
  tone: 'success' | 'error' | 'info';
  title: string;
  description: string;
  occurredAt: string;
  nextStep?: string;
};

export type RecoveryMethod = 'code' | 'kit';

export type RecoveryErrors = {
  adminPassword?: string;
  kitPassword?: string;
  action?: string;
};
