import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { RestoreAuthorizationService } from './services/restore-authorization.service';

process.env.NODE_ENV = 'test';

test('autorização temporária aceita somente o bundle selecionado e é consumida na restauração', () => {
  RestoreAuthorizationService.resetForTests();
  const selected = path.resolve(process.cwd(), 'scratch', 'authorized-bundle');
  const authorization = RestoreAuthorizationService.issueForTests(selected, { nonce: 'nonce-autorizado' });
  assert.equal(RestoreAuthorizationService.verify({ bundlePath: selected, authorization }).bundlePath, selected);
  assert.throws(() => RestoreAuthorizationService.assertTested({ bundlePath: selected, authorization }), /teste isolado/);
  assert.throws(() => RestoreAuthorizationService.verify({ bundlePath: `${selected}-outro`, authorization }), /não corresponde/);
  assert.throws(() => RestoreAuthorizationService.verify({ bundlePath: path.join(selected, '..', 'fora-da-raiz'), authorization }), /não corresponde/);
  RestoreAuthorizationService.markTested({ bundlePath: selected, authorization });
  assert.equal(RestoreAuthorizationService.assertTested({ bundlePath: selected, authorization }).bundlePath, selected);
  RestoreAuthorizationService.verify({ bundlePath: selected, authorization }, { consume: true });
  assert.throws(() => RestoreAuthorizationService.verify({ bundlePath: selected, authorization }), /já foi utilizada/);
});

test('autorização expirada ou adulterada é recusada', () => {
  RestoreAuthorizationService.resetForTests();
  const selected = path.resolve(process.cwd(), 'scratch', 'expired-bundle');
  const expired = RestoreAuthorizationService.issueForTests(selected, { expiresAt: Date.now() - 1 });
  assert.throws(() => RestoreAuthorizationService.verify({ bundlePath: selected, authorization: expired }), /expirou/);
  const valid = RestoreAuthorizationService.issueForTests(selected);
  assert.throws(() => RestoreAuthorizationService.verify({ bundlePath: selected, authorization: `${valid}x` }), /inválida/);
});
