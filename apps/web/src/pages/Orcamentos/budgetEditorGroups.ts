import type { BudgetValidationIssue, BudgetValidationSection } from './budgetForm';

export const BUDGET_EDITOR_GROUPS = [
  { id: 'header', number: '1', label: 'Dados da proposta' },
  { id: 'characterization', number: '2', label: 'Escopo técnico' },
  { id: 'items', number: '3', label: 'Itens e preços' },
  { id: 'fees', number: '4', label: 'Formação do preço' },
  { id: 'payment', number: '5', label: 'Pagamento' },
  { id: 'document', number: '6', label: 'Revisão e documento' }
] as const;
export type BudgetEditorGroupId = typeof BUDGET_EDITOR_GROUPS[number]['id'];

/** Presentation mapping only: validation, calculation and payload remain unchanged. */
export function budgetEditorGroup(section: BudgetValidationSection, fieldId?: string): BudgetEditorGroupId {
  if (fieldId && /^(budget-technical-lead|budget-execution-)/.test(fieldId)) return 'characterization';
  if (section === 'client') return 'header';
  if (section === 'costs' || section === 'taxes') return 'fees';
  if (section === 'summary' || section === 'notes') return 'document';
  return section;
}

export function budgetIssuesByGroup(issues: BudgetValidationIssue[]) {
  return BUDGET_EDITOR_GROUPS.map(group => ({ ...group, issues: issues.filter(issue => budgetEditorGroup(issue.section, issue.fieldId) === group.id) }));
}
