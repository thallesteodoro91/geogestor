import { BudgetExecutionStartSchema, calculateInstallments, type BudgetExecutionStart, type InstallmentDefinition } from '@geogestor/contracts/src/budgets';
import { formatBasisPoints, formatCurrency, formatDate, formatQuantity, paymentTypeLabel } from './budgetForm';
import type { BudgetDetail, BudgetFormState } from './types';

export function installmentText(installment: InstallmentDefinition, index: number, calculatedValueCents?: number) {
  const amount = installment.percentage?.trim()
    ? `${formatQuantity(installment.percentage)}%${calculatedValueCents != null ? ` (${formatCurrency(calculatedValueCents)})` : ''}`
    : formatCurrency(installment.valueCents);
  const days = installment.daysAfterApproval ?? 0;
  const due = installment.dueDate ? `vencimento em ${formatDate(installment.dueDate)}`
    : days === 0 ? 'na aprovação' : `${days} ${days === 1 ? 'dia' : 'dias'} após a aprovação`;
  return `${index + 1}. ${installment.label?.trim() || `Parcela ${index + 1}`}: ${amount}, ${due}`;
}

export function installmentAmounts(totalCents: number, definitions: InstallmentDefinition[]) {
  try {
    // Only the monetary allocation is used here; relative due dates remain relative.
    return calculateInstallments(totalCents, definitions, '2000-01-01').map(item => item.valueCents);
  } catch {
    // Incomplete drafts must stay editable without showing invented values.
    return [];
  }
}

export function installmentTexts(totalCents: number, definitions: InstallmentDefinition[]) {
  const amounts = installmentAmounts(totalCents, definitions);
  return definitions.map((item, index) => installmentText(item, index, amounts[index]));
}

export function executionDeadlineText(days: number | null | undefined, start?: BudgetExecutionStart) {
  if (days == null) return '';
  const duration = `${days} ${days === 1 ? 'dia' : 'dias'}`;
  if (start?.type === 'approval') return `${duration} após a aprovação`;
  if (start?.type === 'initial_payment') return `${duration} após o pagamento inicial`;
  if (start?.type === 'custom') return `${duration} a partir de: ${start.description}`;
  return duration;
}

export function commercialRows(budget: BudgetDetail): Array<[string, string]> {
  const start = BudgetExecutionStartSchema.safeParse(budget.characterization?.executionStart);
  return [
    ['Investimento total', formatCurrency(budget.valorTotal)],
    ...(budget.validadeAte ? [['Validade', `Até ${formatDate(budget.validadeAte)}`]] : []),
    ...(budget.prazoExecucaoDias != null ? [['Prazo de execução', executionDeadlineText(budget.prazoExecucaoDias, start.success ? start.data : undefined)]] : []),
    ...(budget.payment?.type ? [['Forma de pagamento', paymentTypeLabel(budget.payment.type)]] : []),
    ...(budget.payment?.paymentMethod?.trim() ? [['Meio de pagamento', budget.payment.paymentMethod]] : []),
    ...((budget.payment?.interestBasisPoints || 0) > 0 ? [['Juros', formatBasisPoints(budget.payment?.interestBasisPoints)]] : []),
    ...((budget.payment?.fineBasisPoints || 0) > 0 ? [['Multa', formatBasisPoints(budget.payment?.fineBasisPoints)]] : []),
    ...((budget.payment?.earlyDiscountBasisPoints || 0) > 0 ? [['Desconto por antecipação', formatBasisPoints(budget.payment?.earlyDiscountBasisPoints)]] : [])
  ] as Array<[string, string]>;
}

export function scopeDescription(budget: BudgetDetail) {
  const value = budget.characterization?.scopeDescription;
  return typeof value === 'string' && value.trim() ? value : '';
}

// Deliberately advisory: arbitrary prose cannot be interpreted as a contract.
// Never change snapshots, custom terms, payment text or installments here.
export function commercialReviewWarnings(form: BudgetFormState): string[] {
  const warnings: string[] = [];
  const text = `${form.terms}\n${form.paymentDescription}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/validade|dias uteis/.test(text)) {
    warnings.push('Os textos mencionam validade ou dias úteis. Confira se correspondem à data de validade do orçamento, calculada em dias corridos.');
  }
  if (/\d+(?:[.,]\d+)?\s*%|\d+\s*parcelas?|\d+\s*dias|na aprovacao|na entrega|a vista|parcelad/.test(text)) {
    warnings.push('Os textos mencionam percentuais, parcelas ou vencimentos. Confira se correspondem à forma de pagamento e às parcelas cadastradas.');
  }
  if (form.paymentType === 'avista' && form.installments.length > 1) {
    warnings.push('A forma está “À vista”, mas há mais de uma parcela. Revise a forma de pagamento ou as parcelas.');
  }
  if (form.paymentType === 'parcelas' && form.installments.length === 1) {
    warnings.push('A forma está “Parcelado”, mas há uma única parcela. Confira se o pagamento deve ser apresentado como “À vista”.');
  }
  return warnings;
}
