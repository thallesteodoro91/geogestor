import assert from 'node:assert/strict';
import test from 'node:test';
import { applyProjectAssociationOverride, canConfirmProjectImport, replaceProjectPreviewRow, type ProjectImportPreview } from './projectImport';

const preview: ProjectImportPreview = {
  status: 'blocked',
  counts: { total: 2, automatic: 1, manual: 0, pending: 1, missing: 0, ambiguous: 1, invalid: 0 },
  rows: [
    { index: 0, row: 2, projectName: 'Automático', reference: 'Cliente A', status: 'resolved', reason: 'exact_name', message: 'Automático', association: { clientId: 'a', clientName: 'Cliente A', documentMasked: null, municipality: null, method: 'exact_name' } },
    { index: 1, row: 3, projectName: 'Ambíguo', reference: 'Cliente repetido', status: 'pending', reason: 'ambiguous', message: 'Ambíguo' }
  ]
};

test('aplica e remove associação manual sem alterar a referência original', () => {
  const row = { nome: 'Projeto', clienteReferencia: 'Cliente repetido' };
  assert.deepEqual(applyProjectAssociationOverride(row, { clientId: 'cliente-1' }), { ...row, clienteId: 'cliente-1', associacaoManual: true, associacaoPendente: false });
  assert.deepEqual(applyProjectAssociationOverride(row, { keepPending: true }), { ...row, clienteId: undefined, associacaoManual: false, associacaoPendente: true });
  assert.deepEqual(applyProjectAssociationOverride(row), row);
});

test('revalida apenas a linha alterada e atualiza os totais da prévia', () => {
  const replacement = { index: 0, row: 2, projectName: 'Ambíguo', reference: 'Cliente repetido', status: 'resolved' as const, reason: 'manual' as const, message: 'Confirmado', association: { clientId: 'b', clientName: 'Cliente B', documentMasked: null, municipality: 'Florianópolis', method: 'manual' as const } };
  const next = replaceProjectPreviewRow(preview, 1, replacement);
  assert.equal(next.rows[0], preview.rows[0], 'a linha não alterada deve preservar a mesma referência');
  assert.equal(next.rows[1].index, 1);
  assert.equal(next.rows[1].row, 3);
  assert.equal(next.counts.manual, 1);
  assert.equal(next.counts.pending, 0);
  assert.equal(next.status, 'ready');
  assert.equal(canConfirmProjectImport(next, false), true);
  assert.equal(canConfirmProjectImport(next, true), false);
  assert.equal(canConfirmProjectImport(preview, false), false);
});
