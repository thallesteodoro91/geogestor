const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { issueRestoreAuthorization, RESTORE_AUTHORIZATION_TTL_MS } = require('./restore-authorization.cjs');

test('Electron vincula a autorização temporária ao diretório selecionado', () => {
  const now = Date.parse('2026-08-22T12:00:00.000Z');
  const bundlePath = path.resolve(__dirname, 'synthetic-backup');
  const issued = issueRestoreAuthorization(bundlePath, 'segredo-sintetico-com-mais-de-32-caracteres', now);
  assert.equal(issued.bundlePath, bundlePath);
  assert.equal(Date.parse(issued.expiresAt), now + RESTORE_AUTHORIZATION_TTL_MS);
  assert.match(issued.authorization, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(issued.authorization.includes(bundlePath), false);
});

test('Electron recusa caminho relativo e segredo fraco', () => {
  assert.throws(() => issueRestoreAuthorization('relativo', 'segredo-sintetico-com-mais-de-32-caracteres'), /inválido/);
  assert.throws(() => issueRestoreAuthorization(path.resolve(__dirname, 'backup'), 'curto'), /não está disponível/);
});
