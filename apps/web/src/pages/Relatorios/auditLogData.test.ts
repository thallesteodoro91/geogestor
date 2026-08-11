import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAuditData, redactSensitiveAuditValue } from './auditLogData';

test('interpreta auditoria válida e rejeita JSON inválido ou legado sem interromper a tela', () => {
  assert.deepEqual(parseAuditData('{"nome":"Cliente"}'), { data: { nome: 'Cliente' }, invalid: false });
  assert.equal(parseAuditData('{inválido').invalid, true);
  assert.equal(parseAuditData('valor legado').invalid, true);
  assert.equal(parseAuditData('[1,2,3]').invalid, true);
});

test('protege credenciais em estruturas aninhadas de auditoria', () => {
  assert.deepEqual(redactSensitiveAuditValue({ nome: 'Cliente', token: 'segredo', nested: { senha: '123' } }), {
    nome: 'Cliente', token: '[PROTEGIDO]', nested: { senha: '[PROTEGIDO]' }
  });
});
