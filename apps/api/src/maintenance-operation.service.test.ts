import assert from 'node:assert/strict';
import test from 'node:test';
import { MaintenanceOperationService } from './services/maintenance-operation.service';

test('operação longa publica progresso e aceita cancelamento somente em etapa segura', () => {
  MaintenanceOperationService.resetForTests();
  const operation = MaintenanceOperationService.begin('backup_complete', { totalFiles: 4, totalBytes: 400 }, 'Preparando');
  operation.update({ stage: 'Copiando', processedFiles: 2, processedBytes: 190, totalFiles: 4, totalBytes: 400 });
  assert.equal(MaintenanceOperationService.snapshot()?.processedFiles, 2);
  assert.equal(MaintenanceOperationService.requestCancel(operation.id), true);
  assert.equal(operation.shouldCancel(), true);
  operation.fail(new Error('Operação cancelada pelo usuário'));
  assert.equal(MaintenanceOperationService.snapshot()?.status, 'cancelled');
  assert.match(MaintenanceOperationService.snapshot()?.stage || '', /cancelada/i);

  MaintenanceOperationService.resetForTests();
  const commit = MaintenanceOperationService.begin('data_migration', { totalFiles: 1, totalBytes: 10 });
  commit.setCancellable(false);
  assert.equal(MaintenanceOperationService.requestCancel(commit.id), false);
  commit.finish();
  assert.equal(MaintenanceOperationService.snapshot()?.status, 'success');
});

test('operação longa impede concorrência destrutiva', () => {
  MaintenanceOperationService.resetForTests();
  const operation = MaintenanceOperationService.begin('restore_test', { totalFiles: 1, totalBytes: 1 });
  assert.throws(() => MaintenanceOperationService.begin('backup_database', { totalFiles: 1, totalBytes: 1 }), /operação de manutenção em andamento/i);
  operation.finish();
});
