import assert from 'node:assert/strict';
import test from 'node:test';
import { BUDGET_EDITOR_GROUPS, budgetEditorGroup, budgetIssuesByGroup } from './budgetEditorGroups';
import { createDefaultBudgetForm, validateBudgetForm } from './budgetForm';

test('six editor groups keep the legacy validation routes and relocate technical deadlines', () => {
  assert.deepEqual(BUDGET_EDITOR_GROUPS.map(group => group.number), ['1', '2', '3', '4', '5', '6']);
  assert.equal(budgetEditorGroup('client'), 'header');
  assert.equal(budgetEditorGroup('header', 'budget-execution-days'), 'characterization');
  assert.equal(budgetEditorGroup('header', 'budget-execution-start-description'), 'characterization');
  assert.equal(budgetEditorGroup('header', 'budget-description'), 'header');
  assert.equal(budgetEditorGroup('taxes'), 'fees');
  assert.equal(budgetEditorGroup('costs'), 'fees');
  assert.equal(budgetEditorGroup('notes'), 'document');
  assert.equal(budgetEditorGroup('summary'), 'document');
});

test('group progress uses actual validation and never adds requirements for optional information', () => {
  const form = createDefaultBudgetForm();
  const issues = validateBudgetForm(form);
  const grouped = budgetIssuesByGroup(issues);
  assert.equal(grouped.reduce((sum, group) => sum + group.issues.length, 0), issues.length);
  assert.equal(grouped.find(group => group.id === 'document')?.issues.length, 0);
  const withCost = { ...form, costs: [{ id: 'fictional-cost', category: 'Outros custos', description: '', amount: '1,23', classification: 'custo_proprio' as const, taxable: false, notes: '' }] };
  assert.ok(budgetIssuesByGroup(validateBudgetForm(withCost)).find(group => group.id === 'fees')?.issues.some(issue => issue.fieldId === 'budget-cost-description-0'));
});
