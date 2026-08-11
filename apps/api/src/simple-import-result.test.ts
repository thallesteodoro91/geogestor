import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { finishSimpleImport } from './services/simple-import-result.service';

test('resultado simples não produz sucesso falso', () => {
  const result = finishSimpleImport(new Date().toISOString(), 2, [
    { index: 0, status: 'failed', errors: ['Documento inválido'] },
    { index: 1, status: 'failed', errors: ['Telefone inválido'] }
  ]);
  assert.equal(result.status, 'failed');
  assert.equal(result.imported, 0);
  assert.equal(result.failed, 2);
  assert.equal(result.results[0].row, 2);
});

test('resultado simples identifica importação parcial', () => {
  const result = finishSimpleImport(new Date().toISOString(), 2, [
    { index: 0, status: 'success', id: crypto.randomUUID() },
    { index: 1, status: 'failed', errors: ['Cliente não localizado'] }
  ]);
  assert.equal(result.status, 'partial');
  assert.equal(result.imported, 1);
  assert.equal(result.failed, 1);
});
