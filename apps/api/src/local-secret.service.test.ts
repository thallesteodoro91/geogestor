import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import test from 'node:test';

process.env.GEOGESTOR_DB_PATH = path.resolve(process.cwd(), 'scratch', 'api-tests', 'local-secret.service.test.db');
process.env.GEOGESTOR_SECRET_KEY = crypto.randomBytes(32).toString('base64');

test('segredo local é autenticado, cifrado e reversível somente com a chave correta', async () => {
  const { LocalSecretService } = await import('./services/local-secret.service');
  const plaintext = 'segredo-sintético-de-teste';
  const protectedValue = LocalSecretService.protect(plaintext);
  assert.notEqual(protectedValue, plaintext);
  assert.equal(LocalSecretService.isProtected(protectedValue), true);
  assert.equal(LocalSecretService.reveal(protectedValue), plaintext);

  process.env.GEOGESTOR_SECRET_KEY = crypto.randomBytes(32).toString('base64');
  assert.throws(() => LocalSecretService.reveal(protectedValue));
});
