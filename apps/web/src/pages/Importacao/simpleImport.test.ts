import assert from 'node:assert/strict';
import test from 'node:test';
import { simpleImportOutcome, validateSimpleClientPayload } from './simpleImport';

test('nunca classifica zero registros como sucesso', () => {
  assert.equal(simpleImportOutcome(0, 12), 'failed');
  assert.equal(simpleImportOutcome(0, 0), 'failed');
});

test('diferencia conclusão integral e parcial', () => {
  assert.equal(simpleImportOutcome(5, 0), 'completed');
  assert.equal(simpleImportOutcome(4, 1), 'partial');
});

test('valida CPF, CNPJ, telefone e e-mail antes do envio simples', () => {
  const issues = validateSimpleClientPayload([
    { nome: 'Pessoa válida', tipoPessoa: 'PF', cpf: '529.982.247-25', telefone: '(48) 99999-0000', email: 'pessoa@exemplo.com' },
    { nome: 'Pessoa inválida', tipoPessoa: 'PF', cpf: '111.111.111-11', telefone: '123', email: 'email-inválido' },
    { nome: 'Empresa inválida', tipoPessoa: 'PJ', cnpj: '11.111.111/1111-11', telefone: '(48) 3333-4444' }
  ]);

  assert.equal(issues.length, 2);
  assert.equal(issues[0].row, 3);
  assert.ok(issues[0].errors.some(error => error.includes('CPF')));
  assert.ok(issues[0].errors.some(error => error.includes('telefone')));
  assert.ok(issues[0].errors.some(error => error.includes('e-mail')));
  assert.ok(issues[1].errors.some(error => error.includes('CNPJ')));
});
