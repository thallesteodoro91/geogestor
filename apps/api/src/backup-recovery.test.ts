import assert from 'node:assert/strict';
import test from 'node:test';
import { BackupRecoveryService } from './services/backup-recovery.service';

test('código e kit recuperam a mesma chave sem armazená-la em texto puro', () => {
  const secret = BackupRecoveryService.generateRecoverySecret();
  const code = BackupRecoveryService.formatRecoveryCode(secret);
  assert.match(code, /^GG-R1-/);
  assert.equal(BackupRecoveryService.recoveryCodeToSecret(code.toLowerCase()), secret);

  const kit = BackupRecoveryService.exportKit(secret, 'senha-forte-do-kit-2026');
  assert.equal(kit.kdf.algorithm, 'scrypt');
  assert.equal(kit.encryption.algorithm, 'AES-256-GCM');
  assert.equal(JSON.stringify(kit).includes(secret), false);
  assert.equal(BackupRecoveryService.importKit(kit, 'senha-forte-do-kit-2026'), secret);
  assert.throws(() => BackupRecoveryService.importKit(kit, 'senha-incorreta-2026'), /Senha incorreta|danificado/);
  assert.throws(() => BackupRecoveryService.recoveryCodeToSecret(`${code.slice(0, -1)}$`), /caracteres inválidos/);
});

test('envelopes independentes abrem e rotacionam a chave de dados sem descriptografar arquivos', () => {
  const dataKey = Buffer.alloc(32, 11);
  const deviceKey = Buffer.alloc(32, 12).toString('base64');
  const currentRecovery = Buffer.alloc(32, 13).toString('base64');
  const nextRecovery = Buffer.alloc(32, 14).toString('base64');
  const deviceEnvelope = BackupRecoveryService.wrapDataKey(dataKey, deviceKey, 'device');
  const recoveryEnvelope = BackupRecoveryService.wrapDataKey(dataKey, currentRecovery, 'recovery');

  assert.deepEqual(BackupRecoveryService.unwrapDataKey(deviceEnvelope, deviceKey), dataKey);
  assert.deepEqual(BackupRecoveryService.unwrapDataKey(recoveryEnvelope, currentRecovery), dataKey);
  assert.throws(() => BackupRecoveryService.unwrapDataKey(recoveryEnvelope, nextRecovery), /não corresponde/);

  const opened = BackupRecoveryService.unwrapDataKey(recoveryEnvelope, currentRecovery);
  const rotatedEnvelope = BackupRecoveryService.wrapDataKey(opened, nextRecovery, 'recovery');
  opened.fill(0);
  assert.deepEqual(BackupRecoveryService.unwrapDataKey(rotatedEnvelope, nextRecovery), dataKey);
});
