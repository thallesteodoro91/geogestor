import assert from 'node:assert/strict';
import test from 'node:test';
import { BackupRecoveryService } from './services/backup-recovery.service';
import { BackupRecoverySessionService } from './services/backup-recovery-session.service';

test('kit válido cria apenas sessão opaca e pode ser consumido uma vez', () => {
  BackupRecoverySessionService.resetForTests();
  const secret = BackupRecoveryService.generateRecoverySecret();
  const kit = BackupRecoveryService.exportKit(secret, 'senha-segura-do-kit-2026');
  const session = BackupRecoverySessionService.create(kit, 'senha-segura-do-kit-2026');
  assert.equal(JSON.stringify(session).includes(secret), false);
  assert.equal(session.keyId, BackupRecoveryService.keyId(secret));
  assert.equal(BackupRecoverySessionService.resolve(session.token)?.recoverySecret, secret);
  assert.equal(BackupRecoverySessionService.resolve(session.token, { consume: true })?.recoverySecret, secret);
  assert.throws(() => BackupRecoverySessionService.resolve(session.token), /expirou/);
});

test('senha incorreta e kit incompatível não criam sessão', () => {
  BackupRecoverySessionService.resetForTests();
  const secret = BackupRecoveryService.generateRecoverySecret();
  const kit = BackupRecoveryService.exportKit(secret, 'senha-segura-do-kit-2026');
  assert.throws(() => BackupRecoverySessionService.create(kit, 'senha-incorreta-2026'), /Senha incorreta|danificado/);
  assert.throws(() => BackupRecoverySessionService.create({ ...kit, version: 2 } as never, 'senha-segura-do-kit-2026'), /incompatível/);
  assert.throws(() => BackupRecoverySessionService.create({ ...kit, encryption: { ...kit.encryption, tag: Buffer.alloc(16, 9).toString('base64') } }, 'senha-segura-do-kit-2026'), /danificado/);
});

test('confirmação só aceita o kit que corresponde à recuperação configurada', () => {
  const configuredSecret = BackupRecoveryService.generateRecoverySecret();
  const matchingKit = BackupRecoveryService.exportKit(configuredSecret, 'senha-segura-do-kit-2026');
  const foreignKit = BackupRecoveryService.exportKit(BackupRecoveryService.generateRecoverySecret(), 'senha-segura-do-kit-2026');
  const expectedKeyId = BackupRecoveryService.keyId(configuredSecret);

  const result = BackupRecoverySessionService.validate(matchingKit, 'senha-segura-do-kit-2026', expectedKeyId);
  assert.equal(result.keyId, expectedKeyId);
  assert.equal(JSON.stringify(result).includes(configuredSecret), false);
  assert.throws(
    () => BackupRecoverySessionService.validate(foreignKit, 'senha-segura-do-kit-2026', expectedKeyId),
    /não corresponde/
  );
});
