const crypto = require('crypto');
const path = require('path');

const RESTORE_AUTHORIZATION_TTL_MS = 60 * 60 * 1000;

function issueRestoreAuthorization(bundlePath, secret, now = Date.now()) {
  if (typeof bundlePath !== 'string' || bundlePath.length > 4096 || !path.isAbsolute(bundlePath)) {
    throw new Error('O diretório de backup selecionado é inválido.');
  }
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('A autorização segura de restauração não está disponível.');
  }
  const resolvedPath = path.resolve(bundlePath);
  const payload = {
    version: 1,
    bundlePath: resolvedPath,
    expiresAt: now + RESTORE_AUTHORIZATION_TTL_MS,
    nonce: crypto.randomUUID()
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return {
    bundlePath: resolvedPath,
    authorization: `${encoded}.${signature}`,
    expiresAt: new Date(payload.expiresAt).toISOString()
  };
}

module.exports = { issueRestoreAuthorization, RESTORE_AUTHORIZATION_TTL_MS };
