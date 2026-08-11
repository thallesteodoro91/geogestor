import assert from 'node:assert/strict';
import test from 'node:test';
import { projectImportPreviewRow, resolveProjectImportClient, summarizeProjectImportPreview, type ImportClientReference } from './services/project-import-client-resolution.service';

const clients: ImportClientReference[] = [
  { id: 'cliente-1', nome: 'Empresa Modelo', documentoNormalizado: '45723174000110' },
  { id: 'cliente-2', nome: 'Nome Repetido', documentoNormalizado: null },
  { id: 'cliente-3', nome: 'Nome Repetido', documentoNormalizado: null }
];

test('localiza cliente de projeto por documento válido sem exigir UUID', () => {
  const result = resolveProjectImportClient({ clienteReferencia: '45.723.174/0001-10' }, clients);
  assert.equal(result.status, 'resolved');
  if (result.status === 'resolved') {
    assert.equal(result.client.id, 'cliente-1');
    assert.equal(result.method, 'document');
  }
});

test('localiza cliente de projeto por nome exato sem diferenciar caixa e espaços', () => {
  const result = resolveProjectImportClient({ clienteReferencia: '  EMPRESA MODELO ' }, clients);
  assert.equal(result.status, 'resolved');
  if (result.status === 'resolved') {
    assert.equal(result.client.id, 'cliente-1');
    assert.equal(result.method, 'exact_name');
  }
});

test('rejeita cliente inexistente, ambíguo e documento inválido por linha', () => {
  assert.equal(resolveProjectImportClient({ clienteReferencia: 'Cliente inexistente' }, clients).status, 'missing');
  assert.equal(resolveProjectImportClient({ clienteReferencia: 'Nome Repetido' }, clients).status, 'ambiguous');
  const invalid = resolveProjectImportClient({ clienteReferencia: '11.111.111/1111-11' }, clients);
  assert.equal(invalid.status, 'invalid_document');
  assert.ok(!invalid.message.includes('11111111111111'), 'a mensagem não deve expor o documento completo');
});

test('associação manual usa somente cliente existente na lista ativa e pode permanecer pendente', () => {
  const manual = resolveProjectImportClient({ clienteId: 'cliente-1', associacaoManual: true }, clients);
  assert.equal(manual.status, 'resolved');
  if (manual.status === 'resolved') assert.equal(manual.method, 'manual');
  assert.equal(resolveProjectImportClient({ clienteId: 'cliente-inativo', associacaoManual: true }, clients).status, 'missing');
  assert.equal(resolveProjectImportClient({ clienteId: 'cliente-1', associacaoPendente: true }, clients).status, 'manual_pending');
});

test('prévia mascara documento, registra critério e resume pendências', () => {
  const rows = [
    projectImportPreviewRow({ nome: 'Projeto automático', clienteReferencia: '45.723.174/0001-10' }, 0, clients),
    projectImportPreviewRow({ nome: 'Projeto manual', clienteId: 'cliente-1', associacaoManual: true }, 1, clients),
    projectImportPreviewRow({ nome: 'Projeto ambíguo', clienteReferencia: 'Nome Repetido' }, 2, clients)
  ];
  assert.equal(rows[0].reference, 'CNPJ **.***.***/****-10');
  assert.ok(!JSON.stringify(rows).includes('45723174000110'));
  assert.equal(rows[1].association?.method, 'manual');
  assert.deepEqual(summarizeProjectImportPreview(rows), { total: 3, automatic: 1, manual: 1, pending: 1, missing: 0, ambiguous: 1, invalid: 0 });
});
