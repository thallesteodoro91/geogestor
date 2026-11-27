import assert from 'node:assert/strict';
import test from 'node:test';
import { CLIENT_CATEGORY_OPTIONS, CLIENT_PROFILE_OPTIONS, normalizeClientCategoryTag } from './clientTags';
import { clientRecordToForm, clientFormToPayload, validateClientForm } from '../pages/Clientes/clientForm';
import { clientCategoryIconKind, resolveClientClassification } from '@geogestor/contracts/src/client-categories';

test('tipo, categoria principal e perfil são independentes', () => {
  assert.ok(CLIENT_CATEGORY_OPTIONS.includes('Entidade Pública'));
  const categoryLabels: readonly string[] = CLIENT_CATEGORY_OPTIONS;
  assert.ok(!categoryLabels.includes('Pessoa Jurídica'));
  assert.ok(!categoryLabels.includes('Pessoa Física'));
  assert.deepEqual(CLIENT_PROFILE_OPTIONS, ['Parceiro']);
  assert.equal(normalizeClientCategoryTag('Governo'), 'Entidade Pública');
  assert.equal(normalizeClientCategoryTag('Órgão Público'), 'Entidade Pública');
  const legacy = resolveClientClassification('Pessoa Jurídica, Governo', 'Parceiro');
  assert.equal(legacy.primary, 'Entidade Pública');
  assert.deepEqual(legacy.profiles, ['Parceiro']);
  assert.equal(clientCategoryIconKind('Pessoa Jurídica, Governo'), 'public');
  assert.equal(clientCategoryIconKind('indústria'), 'industry');
  assert.equal(clientCategoryIconKind(null), 'neutral');
});

test('categorias principais ambíguas exigem escolha manual sem perder o texto antigo', () => {
  const legacy = resolveClientClassification('Empresa, Indústria, Parceiro');
  assert.equal(legacy.primary, null);
  assert.equal(legacy.needsReview, true);
  assert.deepEqual(legacy.profiles, ['Parceiro']);
  assert.equal(clientCategoryIconKind('Empresa, Indústria'), 'neutral');
  const form = clientRecordToForm({ nome: 'Legado', tipoPessoa: 'PJ', categoria: 'Empresa, Indústria' });
  assert.equal(form.categoriaPrincipal, '');
  assert.equal(form.categoriaPendente, 'Empresa, Indústria');
  assert.equal(clientFormToPayload(form).categoria, 'Empresa, Indústria');
  assert.ok(validateClientForm(form).errors.categoriaPrincipal);
  assert.equal(clientFormToPayload({ ...form, categoriaPendente: '' }).categoria, null);
});

test('tipo de pessoa ausente não é presumido; entidade pública exige PJ', () => {
  const form = clientRecordToForm({ nome: 'Autarquia', categoria: 'Governo' });
  assert.equal(form.tipoPessoa, '');
  assert.equal(form.categoriaPrincipal, 'Entidade Pública');
  assert.ok(validateClientForm(form).errors.tipoPessoa);
  assert.ok(validateClientForm({ ...form, tipoPessoa: 'PF' }).errors.categoriaPrincipal);
  const corrected = { ...form, tipoPessoa: 'PJ' as const };
  assert.equal(clientFormToPayload(corrected).categoria, 'Entidade Pública');
  assert.equal(clientCategoryIconKind(corrected.categoriaPrincipal), 'public');
});
