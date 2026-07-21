import { calculateBudget, percentageToBasisPoints, type BudgetCalculationResult } from '@geogestor/contracts/src/budgets';
import type { BudgetDetail, BudgetFormItem, BudgetFormState } from './types';

export type BudgetValidationSection = 'header' | 'client' | 'characterization' | 'items' | 'costs' | 'taxes' | 'fees' | 'payment' | 'summary' | 'notes' | 'document';

export interface BudgetValidationIssue {
  fieldId: string;
  message: string;
  section: BudgetValidationSection;
}

export const formatCurrency = (cents: number | null | undefined) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
}).format((cents || 0) / 100);

export const formatBasisPoints = (basisPoints: number | null | undefined) => basisPoints === null || basisPoints === undefined
  ? 'Não calculável'
  : new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
      .format(basisPoints / 10_000);

export const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00.000Z`))
  : 'Não informada';

export const formatDateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  : 'Não informada';

function uid() {
  return globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function currencyInputToCents(input: string) {
  let source = input.trim().replace(/\s/g, '').replace(/^R\$/i, '');
  if (!source) return 0;
  if (source.includes(',') && source.includes('.')) source = source.replace(/\./g, '').replace(',', '.');
  else source = source.replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(source)) throw new Error(`Valor monetário inválido: ${input}.`);
  const negative = source.startsWith('-');
  const unsigned = negative ? source.slice(1) : source;
  const [integerPart, fractionPart = ''] = unsigned.split('.');
  const padded = fractionPart.padEnd(3, '0');
  let result = BigInt(integerPart) * 100n + BigInt(padded.slice(0, 2));
  if (padded[2] >= '5') result += 1n;
  const signed = negative ? -result : result;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('Valor monetário acima do limite suportado.');
  }
  return Number(signed);
}

export function centsToCurrencyInput(cents: number | null | undefined) {
  const value = cents || 0;
  const negative = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  return `${negative}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
}

export function emptyBudgetItem(): BudgetFormItem {
  return {
    id: uid(),
    code: '',
    group: 'Serviços técnicos',
    stage: '',
    category: 'Serviços',
    description: '',
    unit: 'serviço',
    quantity: '1',
    unitCost: '0,00',
    unitPrice: '0,00',
    discountType: 'percentual',
    discountValue: '0',
    additionType: 'percentual',
    additionValue: '0',
    taxable: true,
    component: 'servico',
    optional: false,
    notes: ''
  };
}

export const DEFAULT_BUDGET_TERMS = 'Esta proposta contempla exclusivamente os serviços e entregáveis descritos. Alterações de escopo serão objeto de revisão formal.';

export function createDefaultBudgetForm(clientId = ''): BudgetFormState {
  const issueDate = localDateKey();
  return {
    clientId,
    projectId: '',
    propertyId: '',
    description: '',
    internalNotes: '',
    clientNotes: '',
    terms: DEFAULT_BUDGET_TERMS,
    issueDate,
    validUntil: addDays(issueDate, 15),
    technicalLead: '',
    source: 'manual',
    serviceType: 'Levantamento topográfico planimétrico',
    propertyType: 'rural',
    propertyName: '',
    municipality: '',
    state: 'SC',
    methodology: '',
    deliverables: '',
    executionDays: '15',
    characterization: {
      estimatedArea: '', areaUnit: 'hectare', estimatedPerimeter: '', estimatedVertices: '', neighbors: '',
      record: '', registryOffice: '', ruralCode: '', approximateCoordinates: '', distanceKm: '',
      accessConditions: '', terrain: '', vegetation: '', complexity: 'média', travelRequired: false,
      lodgingRequired: false, additionalTeam: false, equipment: '', surveyMethod: '', physicalGroundControl: '',
      gnssElectronicBase: '', technicalNotes: ''
    },
    globalDiscountType: 'percentual',
    globalDiscountValue: '0',
    globalAdditionType: 'percentual',
    globalAdditionValue: '0',
    items: [emptyBudgetItem()],
    costs: [],
    taxes: [],
    paymentType: 'parcelas',
    paymentDescription: 'À vista na aprovação',
    paymentMethod: 'PIX',
    financialAccount: '',
    interestBasisPoints: '0',
    fineBasisPoints: '0',
    earlyDiscountBasisPoints: '0',
    installments: [{ percentage: '100', daysAfterApproval: 0, label: 'Pagamento na aprovação' }]
  };
}

export function detailToForm(detail: BudgetDetail): BudgetFormState {
  const base = createDefaultBudgetForm(detail.clienteId);
  const characterization = (detail.characterization || {}) as Partial<BudgetFormState['characterization']>;
  return {
    ...base,
    clientId: detail.clienteId,
    projectId: detail.projetoId || '',
    propertyId: detail.propriedadeId || '',
    description: detail.descricao || '',
    internalNotes: detail.anotacoes || '',
    clientNotes: detail.observacoesCliente || '',
    terms: detail.termosCondicoes || base.terms,
    issueDate: detail.dataEmissao || base.issueDate,
    validUntil: detail.validadeAte || base.validUntil,
    technicalLead: detail.responsavelTecnico || '',
    source: 'manual',
    serviceType: detail.servicoTipo || base.serviceType,
    propertyType: detail.imovelTipo || 'rural',
    propertyName: detail.imovelNome || '',
    municipality: detail.municipio || '',
    state: detail.uf || 'SC',
    methodology: detail.metodologia || '',
    deliverables: detail.entregaveis || '',
    executionDays: detail.prazoExecucaoDias === null || detail.prazoExecucaoDias === undefined ? '' : String(detail.prazoExecucaoDias),
    characterization: { ...base.characterization, ...characterization },
    globalDiscountType: detail.descontoGlobalTipo || 'fixo',
    globalDiscountValue: detail.descontoGlobalValor || '0',
    globalAdditionType: detail.acrescimoGlobalTipo || 'fixo',
    globalAdditionValue: detail.acrescimoGlobalValor || '0',
    items: detail.items.map((item) => ({
      id: item.id,
      code: item.code || '',
      group: item.group || '',
      stage: item.stage || '',
      category: item.category || 'Serviços',
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitCost: centsToCurrencyInput(item.unitCostCents),
      unitPrice: centsToCurrencyInput(item.unitPriceCents),
      discountType: item.discount.type,
      discountValue: item.discount.type === 'fixo' ? centsToCurrencyInput(Number(item.discount.value)) : item.discount.value,
      additionType: item.addition.type,
      additionValue: item.addition.type === 'fixo' ? centsToCurrencyInput(Number(item.addition.value)) : item.addition.value,
      taxable: item.taxable,
      component: item.component,
      optional: item.optional,
      notes: item.notes || ''
    })),
    costs: detail.costs.map((cost) => ({
      id: cost.id,
      category: cost.category,
      description: cost.description,
      amount: centsToCurrencyInput(cost.amountCents),
      classification: cost.classification,
      taxable: cost.taxable,
      notes: cost.notes || ''
    })),
    taxes: detail.taxes.map((tax) => ({
      id: tax.id,
      taxId: tax.taxId,
      name: tax.name,
      acronym: tax.acronym,
      ratePercent: tax.ratePercent,
      calculationBase: tax.calculationBase,
      includedInPrice: tax.includedInPrice,
      cumulative: tax.cumulative,
      manualAdjustment: centsToCurrencyInput(tax.manualAdjustmentCents),
      adjustmentReason: tax.adjustmentReason || ''
    })),
    paymentType: detail.payment?.type || base.paymentType,
    paymentDescription: detail.payment?.description || '',
    paymentMethod: detail.payment?.paymentMethod || '',
    financialAccount: detail.payment?.financialAccount || '',
    interestBasisPoints: String(detail.payment?.interestBasisPoints || 0),
    fineBasisPoints: String(detail.payment?.fineBasisPoints || 0),
    earlyDiscountBasisPoints: String(detail.payment?.earlyDiscountBasisPoints || 0),
    installments: detail.payment?.installments?.length ? detail.payment.installments : base.installments
  };
}

export function calculateForm(form: BudgetFormState): BudgetCalculationResult {
  return calculateBudget({
    items: form.items.map((item, index) => ({
      id: item.id,
      code: item.code || null,
      group: item.group || null,
      stage: item.stage || null,
      category: item.category || null,
      description: item.description || `Item ${index + 1}`,
      unit: item.unit,
      quantity: item.quantity || '0',
      unitCostCents: currencyInputToCents(item.unitCost),
      unitPriceCents: currencyInputToCents(item.unitPrice),
      discount: {
        type: item.discountType,
        value: item.discountType === 'fixo' ? String(currencyInputToCents(item.discountValue)) : item.discountValue || '0'
      },
      addition: {
        type: item.additionType,
        value: item.additionType === 'fixo' ? String(currencyInputToCents(item.additionValue)) : item.additionValue || '0'
      },
      taxable: item.taxable,
      component: item.component,
      optional: item.optional,
      required: !item.optional,
      notes: item.notes || null,
      order: index
    })),
    costs: form.costs.map((cost, index) => ({
      id: cost.id,
      category: cost.category,
      description: cost.description || `Custo ${index + 1}`,
      amountCents: currencyInputToCents(cost.amount),
      classification: cost.classification,
      taxable: cost.taxable,
      notes: cost.notes || null,
      order: index
    })),
    taxes: form.taxes.map((tax) => ({
      id: tax.id,
      taxId: tax.taxId || null,
      name: tax.name,
      acronym: tax.acronym,
      ratePercent: tax.ratePercent || '0',
      calculationBase: tax.calculationBase,
      includedInPrice: tax.includedInPrice,
      cumulative: tax.cumulative,
      manualAdjustmentCents: currencyInputToCents(tax.manualAdjustment),
      adjustmentReason: tax.adjustmentReason || null
    })),
    globalDiscount: {
      type: form.globalDiscountType,
      value: form.globalDiscountType === 'fixo' ? String(currencyInputToCents(form.globalDiscountValue)) : form.globalDiscountValue || '0'
    },
    globalAddition: {
      type: form.globalAdditionType,
      value: form.globalAdditionType === 'fixo' ? String(currencyInputToCents(form.globalAdditionValue)) : form.globalAdditionValue || '0'
    }
  });
}

export function validateBudgetForm(form: BudgetFormState): BudgetValidationIssue[] {
  const issues: BudgetValidationIssue[] = [];
  const add = (fieldId: string, message: string, section: BudgetValidationSection) => issues.push({ fieldId, message, section });
  let adjustmentsValid = true;
  const validateAdjustment = (
    fieldId: string,
    type: 'fixo' | 'percentual',
    value: string,
    kind: 'discount' | 'addition',
    label: string,
    section: BudgetValidationSection
  ) => {
    if (!value.trim()) {
      adjustmentsValid = false;
      add(fieldId, `Informe o ${label.toLocaleLowerCase('pt-BR')}.`, section);
      return;
    }
    try {
      const parsed = type === 'fixo' ? currencyInputToCents(value) : percentageToBasisPoints(value);
      if (parsed < 0) {
        adjustmentsValid = false;
        add(fieldId, `${label} não pode ser negativo.`, section);
      } else if (kind === 'discount' && type === 'percentual' && parsed > 10_000) {
        adjustmentsValid = false;
        add(fieldId, `${label} percentual deve ficar entre 0% e 100%.`, section);
      }
    } catch {
      adjustmentsValid = false;
      add(fieldId, type === 'fixo' ? `Informe um valor monetário válido para ${label.toLocaleLowerCase('pt-BR')}.` : `Informe um percentual válido para ${label.toLocaleLowerCase('pt-BR')}.`, section);
    }
  };

  if (!form.description.trim()) add('budget-description', 'Informe o título do orçamento.', 'header');
  if (!form.issueDate) add('budget-issue-date', 'Informe a data de emissão.', 'header');
  if (!form.validUntil) add('budget-valid-until', 'Informe a validade da proposta.', 'header');
  if (form.issueDate && form.validUntil && form.validUntil < form.issueDate) {
    add('budget-valid-until', 'A validade deve ser igual ou posterior à data de emissão.', 'header');
  }
  if (form.executionDays && (!Number.isInteger(Number(form.executionDays)) || Number(form.executionDays) < 0)) {
    add('budget-execution-days', 'Informe um prazo inteiro igual ou maior que zero.', 'header');
  }

  if (!form.clientId) add('budget-client', 'Selecione o cliente desta proposta.', 'client');
  if (!form.serviceType.trim()) add('budget-service-type', 'Informe o tipo de serviço.', 'characterization');

  validateAdjustment('global-discount', form.globalDiscountType, form.globalDiscountValue, 'discount', 'Desconto global', 'fees');
  validateAdjustment('global-addition', form.globalAdditionType, form.globalAdditionValue, 'addition', 'Acréscimo global', 'fees');

  if (!form.items.length) {
    add('budget-add-item', 'Adicione pelo menos um item ao orçamento.', 'items');
  }
  form.items.forEach((item, index) => {
    if (!item.description.trim()) add(`budget-item-description-${index}`, `Descreva o item ${index + 1}.`, 'items');
    if (!item.quantity.trim()) add(`budget-item-quantity-${index}`, `Informe a quantidade do item ${index + 1}.`, 'items');
    validateAdjustment(`budget-item-discount-${index}`, item.discountType, item.discountValue, 'discount', `Desconto do item ${index + 1}`, 'items');
    validateAdjustment(`budget-item-addition-${index}`, item.additionType, item.additionValue, 'addition', `Acréscimo do item ${index + 1}`, 'items');
  });

  if (adjustmentsValid) {
    try {
      const calculation = calculateForm({
        ...form,
        globalDiscountType: 'fixo',
        globalDiscountValue: '0',
        globalAdditionType: 'fixo',
        globalAdditionValue: '0',
        items: form.items.map((item) => ({
          ...item,
          discountType: 'fixo',
          discountValue: '0',
          additionType: 'fixo',
          additionValue: '0'
        }))
      });
      const globalBase = calculation.subtotalServicesCents + calculation.subtotalExpensesCents + calculation.subtotalFeesCents;
      if (form.globalDiscountType === 'fixo' && currencyInputToCents(form.globalDiscountValue) > globalBase) {
        add('global-discount', 'O desconto global não pode ser maior que o subtotal faturável.', 'fees');
      }
      form.items.forEach((item, index) => {
        if (item.discountType === 'fixo' && currencyInputToCents(item.discountValue) > (calculation.items[index]?.subtotalCents || 0)) {
          add(`budget-item-discount-${index}`, `O desconto do item ${index + 1} não pode ser maior que o subtotal do item.`, 'items');
        }
      });
    } catch {
      // Outros campos possuem suas próprias mensagens de validação ou aparecem no erro da prévia.
    }
  }

  form.costs.forEach((cost, index) => {
    if (!cost.description.trim()) add(`budget-cost-description-${index}`, `Descreva o custo ${index + 1}.`, 'costs');
  });

  form.taxes.forEach((tax, index) => {
    if (!tax.name.trim()) add(`budget-tax-name-${index}`, `Informe o nome do imposto ${index + 1}.`, 'taxes');
    if (!tax.acronym.trim()) add(`budget-tax-acronym-${index}`, `Informe a sigla do imposto ${index + 1}.`, 'taxes');
    if (!tax.ratePercent.trim()) add(`budget-tax-rate-${index}`, `Informe a alíquota do imposto ${index + 1}.`, 'taxes');
    try {
      if (currencyInputToCents(tax.manualAdjustment) !== 0 && !tax.adjustmentReason.trim()) {
        add(`budget-tax-adjustment-reason-${index}`, `Justifique o ajuste manual do imposto ${index + 1}.`, 'taxes');
      }
    } catch {
      add(`budget-tax-adjustment-${index}`, `Revise o ajuste manual do imposto ${index + 1}.`, 'taxes');
    }
  });

  if (!form.installments.length) {
    add('installment-count', 'Configure ao menos uma parcela.', 'payment');
  } else {
    let percentageSum = 0;
    let usesOnlyPercentages = true;
    form.installments.forEach((installment, index) => {
      if (Number(installment.daysAfterApproval || 0) < 0) {
        add(`budget-installment-days-${index}`, `Os dias da parcela ${index + 1} não podem ser negativos.`, 'payment');
      }
      if (installment.percentage) {
        try {
          percentageSum += percentageToBasisPoints(installment.percentage);
        } catch {
          add(`budget-installment-percentage-${index}`, `Revise o percentual da parcela ${index + 1}.`, 'payment');
        }
      } else if (installment.valueCents === null || installment.valueCents === undefined) {
        usesOnlyPercentages = false;
        add(`budget-installment-percentage-${index}`, `Informe o percentual da parcela ${index + 1}.`, 'payment');
      } else {
        usesOnlyPercentages = false;
      }
    });
    if (usesOnlyPercentages && percentageSum !== 10_000) {
      add('installment-count', 'A soma dos percentuais das parcelas deve ser exatamente 100%.', 'payment');
    }
  }

  return issues;
}

export function formToPayload(form: BudgetFormState) {
  const calculation = calculateForm(form);
  return {
    clientId: form.clientId,
    projectId: form.projectId || null,
    propertyId: form.propertyId || null,
    description: form.description,
    internalNotes: form.internalNotes || null,
    clientNotes: form.clientNotes || null,
    terms: form.terms || null,
    issueDate: form.issueDate || null,
    validUntil: form.validUntil || null,
    technicalLead: form.technicalLead || null,
    source: form.source || 'manual',
    serviceType: form.serviceType || null,
    propertyType: form.propertyType,
    propertyName: form.propertyName || null,
    municipality: form.municipality || null,
    state: form.state || null,
    methodology: form.methodology || null,
    deliverables: form.deliverables || null,
    executionDays: form.executionDays ? Number.parseInt(form.executionDays, 10) : null,
    characterization: form.characterization,
    globalDiscount: {
      type: form.globalDiscountType,
      value: form.globalDiscountType === 'fixo' ? String(currencyInputToCents(form.globalDiscountValue)) : form.globalDiscountValue || '0'
    },
    globalAddition: {
      type: form.globalAdditionType,
      value: form.globalAdditionType === 'fixo' ? String(currencyInputToCents(form.globalAdditionValue)) : form.globalAdditionValue || '0'
    },
    items: calculation.items.map((item) => ({
      id: item.id,
      code: item.code,
      group: item.group,
      stage: item.stage,
      category: item.category,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitCostCents: item.unitCostCents,
      unitPriceCents: item.unitPriceCents,
      discount: item.discount,
      addition: item.addition,
      taxable: item.taxable,
      component: item.component,
      optional: item.optional,
      required: item.required,
      notes: item.notes,
      order: item.order
    })),
    costs: form.costs.map((cost, index) => ({
      id: cost.id,
      category: cost.category,
      description: cost.description,
      amountCents: currencyInputToCents(cost.amount),
      classification: cost.classification,
      taxable: cost.taxable,
      notes: cost.notes || null,
      order: index
    })),
    taxes: form.taxes.map((tax) => ({
      id: tax.id,
      taxId: tax.taxId || null,
      name: tax.name,
      acronym: tax.acronym,
      ratePercent: tax.ratePercent,
      calculationBase: tax.calculationBase,
      includedInPrice: tax.includedInPrice,
      cumulative: tax.cumulative,
      manualAdjustmentCents: currencyInputToCents(tax.manualAdjustment),
      adjustmentReason: tax.adjustmentReason || null
    })),
    payment: {
      type: form.paymentType,
      description: form.paymentDescription || null,
      installments: form.installments,
      paymentMethod: form.paymentMethod || null,
      financialAccount: form.financialAccount || null,
      interestBasisPoints: Number.parseInt(form.interestBasisPoints || '0', 10),
      fineBasisPoints: Number.parseInt(form.fineBasisPoints || '0', 10),
      earlyDiscountBasisPoints: Number.parseInt(form.earlyDiscountBasisPoints || '0', 10)
    }
  };
}
