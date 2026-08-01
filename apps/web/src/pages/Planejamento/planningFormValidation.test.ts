import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePlanningForm } from './planningFormValidation';

test('aponta todos os campos obrigatórios de uma decisão', () => {
  const errors = validatePlanningForm('decision', { descricao: '', responsavel: '', dataLimite: '', status: 'pendente' });
  assert.deepEqual(Object.keys(errors), ['planning-decision-first', 'decision-owner', 'decision-deadline']);
});

test('exige resultado ao concluir uma decisão', () => {
  const errors = validatePlanningForm('decision', {
    descricao: 'Contratar levantamento', responsavel: 'Ana', dataLimite: '2026-08-10',
    status: 'concluida', notaConclusao: '   '
  });
  assert.equal(errors['decision-completion-note'], 'Registre o resultado antes de concluir a decisão.');
});

test('valida datas do ciclo e da próxima revisão', () => {
  assert.equal(validatePlanningForm('cycle', {
    nome: '2026', dataInicio: '2026-12-01', dataFim: '2026-01-01', visao: 'Crescer'
  })['cycle-end'], 'A data final deve ser igual ou posterior à data inicial.');
  assert.ok(validatePlanningForm('checkin', {
    data: '2026-08-10', narrativa: 'Revisão', proximaRevisao: '2026-08-01'
  })['checkin-next-review']);
});

test('aceita resultado-chave automático sem valor atual manual', () => {
  const errors = validatePlanningForm('keyResult', {
    titulo: 'Receita', objetivoId: 'objective', linhaBase: '100', meta: '200', valorAtual: '', unidade: 'R$'
  }, { hasAutomaticSource: true });
  assert.deepEqual(errors, {});
});

test('limita progresso, orçamento e ordem manual', () => {
  const initiative = validatePlanningForm('initiative', {
    titulo: 'Projeto', objetivoId: 'objective', responsavel: 'Ana', dataLimite: '2026-09-01', progresso: '101', orcamento: '-1'
  });
  assert.ok(initiative['initiative-progress']);
  assert.ok(initiative['initiative-budget']);
  assert.ok(validatePlanningForm('objective', {
    titulo: 'Objetivo', pilarId: 'pillar', responsavel: 'Ana', dataLimite: '2026-09-01', ordem: '1.5'
  })['objective-order']);
});
