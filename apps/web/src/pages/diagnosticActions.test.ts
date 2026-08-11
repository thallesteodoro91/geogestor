import assert from 'node:assert/strict';
import test from 'node:test';
import { requestOpenDiagnosticsFolder } from './diagnosticActions';

test('informa claramente quando a ponte do aplicativo desktop não está disponível', async () => {
  assert.deepEqual(await requestOpenDiagnosticsFolder(undefined), {
    success: false,
    error: 'A pasta de diagnósticos está disponível somente no aplicativo desktop.'
  });
});

test('preserva o resultado estruturado da ponte desktop e trata rejeições', async () => {
  assert.deepEqual(await requestOpenDiagnosticsFolder(async () => ({ success: true, path: 'C:\\GeoGestor\\diagnostics' })), {
    success: true,
    path: 'C:\\GeoGestor\\diagnostics'
  });
  assert.equal((await requestOpenDiagnosticsFolder(async () => { throw new Error('falha'); })).success, false);
});
