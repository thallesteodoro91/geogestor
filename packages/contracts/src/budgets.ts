import { z } from 'zod';

export const BUDGET_STATUSES = [
  'rascunho',
  'emitido',
  'enviado',
  'em_negociacao',
  'aprovado',
  'rejeitado',
  'expirado',
  'cancelado',
  'substituido'
] as const;

export type BudgetStatus = (typeof BUDGET_STATUSES)[number];
export type AdjustmentType = 'fixo' | 'percentual';
export type FinancialComponent = 'servico' | 'despesa' | 'taxa_repassada';
export type CostClassification = 'custo_proprio' | 'despesa_reembolsavel' | 'taxa_repassada';

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  rascunho: 'Rascunho',
  emitido: 'Emitido',
  enviado: 'Enviado',
  em_negociacao: 'Em negociação',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  expirado: 'Expirado',
  cancelado: 'Cancelado',
  substituido: 'Substituído'
};

export const BUDGET_TRANSITIONS: Record<BudgetStatus, readonly BudgetStatus[]> = {
  rascunho: ['emitido', 'cancelado'],
  emitido: ['enviado', 'em_negociacao', 'aprovado', 'rejeitado', 'expirado', 'cancelado'],
  enviado: ['em_negociacao', 'aprovado', 'rejeitado', 'expirado', 'cancelado'],
  em_negociacao: ['enviado', 'aprovado', 'rejeitado', 'expirado', 'cancelado'],
  aprovado: ['cancelado', 'substituido'],
  rejeitado: [],
  expirado: [],
  cancelado: [],
  substituido: []
};

export function normalizeBudgetStatus(status?: string | null): BudgetStatus {
  const normalized = (status || '').trim().toLocaleLowerCase('pt-BR');
  const aliases: Record<string, BudgetStatus> = {
    rascunho: 'rascunho',
    'em análise': 'rascunho',
    'em analise': 'rascunho',
    pendente: 'rascunho',
    emitido: 'emitido',
    enviado: 'enviado',
    'em negociação': 'em_negociacao',
    'em negociacao': 'em_negociacao',
    em_negociacao: 'em_negociacao',
    aprovado: 'aprovado',
    pago: 'aprovado',
    rejeitado: 'rejeitado',
    expirado: 'expirado',
    cancelado: 'cancelado',
    substituído: 'substituido',
    substituido: 'substituido'
  };
  return aliases[normalized] || 'rascunho';
}

export function canTransitionBudget(from: BudgetStatus, to: BudgetStatus) {
  return BUDGET_TRANSITIONS[from].includes(to);
}

export function validateBudgetTransition(from: BudgetStatus, to: BudgetStatus, reason?: string | null) {
  if (!canTransitionBudget(from, to)) {
    return `Não é permitido alterar o orçamento de ${BUDGET_STATUS_LABELS[from]} para ${BUDGET_STATUS_LABELS[to]}.`;
  }
  if ((to === 'rejeitado' || to === 'cancelado') && !reason?.trim()) {
    return `Informe o motivo para marcar o orçamento como ${BUDGET_STATUS_LABELS[to].toLocaleLowerCase('pt-BR')}.`;
  }
  return null;
}

const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER);
const DECIMAL_SCALE = 1_000_000n;

function signedRoundDiv(numerator: bigint, denominator: bigint) {
  if (denominator === 0n) throw new Error('Divisor inválido.');
  const negative = (numerator < 0n) !== (denominator < 0n);
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const rounded = (absoluteNumerator + absoluteDenominator / 2n) / absoluteDenominator;
  return negative ? -rounded : rounded;
}

function toSafeNumber(value: bigint, field: string) {
  if (value > MAX_SAFE_CENTS || value < -MAX_SAFE_CENTS) {
    throw new Error(`${field} excede o limite monetário suportado.`);
  }
  return Number(value);
}

function parseScaledDecimal(value: string | number | null | undefined, scale = DECIMAL_SCALE) {
  const source = String(value ?? '0').trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(source)) {
    throw new Error(`Valor decimal inválido: ${source || '(vazio)'}.`);
  }
  const negative = source.startsWith('-');
  const unsigned = negative ? source.slice(1) : source;
  const [integerPart, fractionPart = ''] = unsigned.split('.');
  const scaleDigits = scale.toString().length - 1;
  const padded = fractionPart.padEnd(scaleDigits, '0');
  const retained = padded.slice(0, scaleDigits);
  const discarded = padded.slice(scaleDigits);
  let parsed = BigInt(integerPart) * scale + BigInt(retained || '0');
  if (discarded[0] && discarded[0] >= '5') parsed += 1n;
  return negative ? -parsed : parsed;
}

function cents(value: number | string | null | undefined, field: string) {
  const source = String(value ?? '0');
  if (!/^-?\d+$/.test(source)) throw new Error(`${field} deve ser informado em centavos inteiros.`);
  return BigInt(source);
}

function multiplyCentsByDecimal(valueCents: bigint, decimal: string | number) {
  return signedRoundDiv(valueCents * parseScaledDecimal(decimal), DECIMAL_SCALE);
}

function percentOf(valueCents: bigint, percent: string | number) {
  return signedRoundDiv(valueCents * parseScaledDecimal(percent), 100n * DECIMAL_SCALE);
}

export function percentageToBasisPoints(percent: string | number) {
  return toSafeNumber(signedRoundDiv(parseScaledDecimal(percent) * 100n, DECIMAL_SCALE), 'Percentual');
}

export function basisPointsToPercentage(basisPoints: number) {
  const sign = basisPoints < 0 ? '-' : '';
  const absolute = Math.abs(basisPoints);
  const integer = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0').replace(/0+$/, '');
  return `${sign}${integer}${fraction ? `.${fraction}` : ''}`;
}

function ratioOf(value: bigint, numerator: bigint, denominator: bigint) {
  if (denominator === 0n) return 0n;
  return signedRoundDiv(value * numerator, denominator);
}

export interface AdjustmentInput {
  type: AdjustmentType;
  value: string;
}

export interface BudgetItemInput {
  id?: string;
  code?: string | null;
  group?: string | null;
  stage?: string | null;
  category?: string | null;
  description: string;
  unit: string;
  quantity: string;
  unitCostCents: number;
  unitPriceCents: number;
  discount: AdjustmentInput;
  addition: AdjustmentInput;
  taxable: boolean;
  component: FinancialComponent;
  optional?: boolean;
  required?: boolean;
  notes?: string | null;
  order?: number;
}

export interface BudgetCostInput {
  id?: string;
  category: string;
  description: string;
  amountCents: number;
  classification: CostClassification;
  taxable?: boolean;
  notes?: string | null;
  order?: number;
}

export interface BudgetTaxInput {
  id?: string;
  taxId?: string | null;
  name: string;
  acronym: string;
  ratePercent: string;
  calculationBase: 'tributavel' | 'servicos' | 'taxas' | 'total';
  includedInPrice: boolean;
  cumulative?: boolean;
  manualAdjustmentCents?: number;
  adjustmentReason?: string | null;
}

export interface BudgetCalculationInput {
  items: BudgetItemInput[];
  costs?: BudgetCostInput[];
  taxes?: BudgetTaxInput[];
  globalDiscount?: AdjustmentInput;
  globalAddition?: AdjustmentInput;
}

export interface CalculatedBudgetItem extends BudgetItemInput {
  subtotalCents: number;
  discountCents: number;
  additionCents: number;
  totalCents: number;
  estimatedCostCents: number;
}

export interface CalculatedBudgetTax extends BudgetTaxInput {
  baseCents: number;
  amountCents: number;
}

export interface BudgetCalculationResult {
  items: CalculatedBudgetItem[];
  taxes: CalculatedBudgetTax[];
  subtotalServicesCents: number;
  subtotalExpensesCents: number;
  subtotalFeesCents: number;
  globalDiscountCents: number;
  globalAdditionCents: number;
  taxableBaseCents: number;
  outsideTaxesCents: number;
  includedTaxesCents: number;
  estimatedTaxesCents: number;
  totalCents: number;
  estimatedCostCents: number;
  grossRevenueCents: number;
  grossFeesCents: number;
  netFeesCents: number;
  estimatedProfitCents: number;
  estimatedMarginBasisPoints: number | null;
  markupBasisPoints: number | null;
  reimbursableCents: number;
  nonTaxableCents: number;
  warnings: string[];
}

function calculateAdjustment(base: bigint, adjustment: AdjustmentInput | undefined, kind: 'discount' | 'addition') {
  if (!adjustment) return 0n;
  const parsedValue = parseScaledDecimal(adjustment.value);
  const label = kind === 'discount' ? 'Desconto' : 'Acréscimo';
  if (parsedValue < 0n) throw new Error(`${label} não pode ser negativo.`);
  if (kind === 'discount' && adjustment.type === 'percentual' && parsedValue > 100n * DECIMAL_SCALE) {
    throw new Error('Desconto percentual deve ficar entre 0% e 100%.');
  }
  if (adjustment.type === 'percentual') return percentOf(base, adjustment.value);
  return cents(adjustment.value, 'Ajuste fixo');
}

export function calculateBudget(input: BudgetCalculationInput): BudgetCalculationResult {
  const calculatedItems = input.items.map((item) => {
    const unitPrice = cents(item.unitPriceCents, 'Preço unitário');
    const unitCost = cents(item.unitCostCents, 'Custo unitário');
    const subtotal = multiplyCentsByDecimal(unitPrice, item.quantity);
    const estimatedCost = multiplyCentsByDecimal(unitCost, item.quantity);
    const discount = calculateAdjustment(subtotal, item.discount, 'discount');
    const addition = calculateAdjustment(subtotal, item.addition, 'addition');
    const total = subtotal - discount + addition;
    return {
      ...item,
      subtotalCents: toSafeNumber(subtotal, 'Subtotal do item'),
      discountCents: toSafeNumber(discount, 'Desconto do item'),
      additionCents: toSafeNumber(addition, 'Acréscimo do item'),
      totalCents: toSafeNumber(total, 'Total do item'),
      estimatedCostCents: toSafeNumber(estimatedCost, 'Custo estimado do item')
    };
  });

  const itemValue = (component: FinancialComponent) => calculatedItems
    .filter((item) => item.component === component && !item.optional)
    .reduce((sum, item) => sum + BigInt(item.totalCents), 0n);

  const subtotalServices = itemValue('servico');
  const itemExpenses = itemValue('despesa');
  const itemFees = itemValue('taxa_repassada');
  const costs = input.costs || [];
  const ownCosts = costs
    .filter((cost) => cost.classification === 'custo_proprio')
    .reduce((sum, cost) => sum + cents(cost.amountCents, 'Custo próprio'), 0n);
  const reimbursable = costs
    .filter((cost) => cost.classification === 'despesa_reembolsavel')
    .reduce((sum, cost) => sum + cents(cost.amountCents, 'Despesa reembolsável'), 0n);
  const passedFees = costs
    .filter((cost) => cost.classification === 'taxa_repassada')
    .reduce((sum, cost) => sum + cents(cost.amountCents, 'Taxa repassada'), 0n);
  const subtotalExpenses = itemExpenses + reimbursable;
  const subtotalFees = itemFees + passedFees;
  const billableBeforeGlobal = subtotalServices + subtotalExpenses + subtotalFees;
  const globalDiscount = calculateAdjustment(billableBeforeGlobal, input.globalDiscount, 'discount');
  const globalAddition = calculateAdjustment(billableBeforeGlobal, input.globalAddition, 'addition');

  const rawTaxable = calculatedItems
    .filter((item) => item.taxable && !item.optional)
    .reduce((sum, item) => sum + BigInt(item.totalCents), 0n)
    + costs.filter((cost) => cost.taxable && cost.classification !== 'custo_proprio')
      .reduce((sum, cost) => sum + cents(cost.amountCents, 'Custo tributável'), 0n);
  const taxableDiscount = ratioOf(globalDiscount, rawTaxable, billableBeforeGlobal);
  const taxableAddition = ratioOf(globalAddition, rawTaxable, billableBeforeGlobal);
  const taxableBase = rawTaxable - taxableDiscount + taxableAddition;

  const serviceDiscount = ratioOf(globalDiscount, subtotalServices, billableBeforeGlobal);
  const serviceAddition = ratioOf(globalAddition, subtotalServices, billableBeforeGlobal);
  const adjustedServices = subtotalServices - serviceDiscount + serviceAddition;
  const adjustedTotalBeforeTaxes = billableBeforeGlobal - globalDiscount + globalAddition;

  let cumulativeBase = taxableBase;
  let outsideTaxes = 0n;
  let includedTaxes = 0n;
  const calculatedTaxes: CalculatedBudgetTax[] = [];

  for (const tax of input.taxes || []) {
    let base = tax.calculationBase === 'servicos'
      ? adjustedServices
      : tax.calculationBase === 'taxas'
        ? subtotalFees
        : tax.calculationBase === 'total'
          ? adjustedTotalBeforeTaxes
          : cumulativeBase;
    if (base < 0n) base = 0n;
    const rate = parseScaledDecimal(tax.ratePercent);
    let amount = tax.includedInPrice
      ? signedRoundDiv(base * rate, 100n * DECIMAL_SCALE + rate)
      : signedRoundDiv(base * rate, 100n * DECIMAL_SCALE);
    const manualAdjustment = cents(tax.manualAdjustmentCents || 0, 'Ajuste manual do imposto');
    if (manualAdjustment !== 0n && !tax.adjustmentReason?.trim()) {
      throw new Error(`Justifique o ajuste manual do imposto ${tax.acronym || tax.name}.`);
    }
    amount += manualAdjustment;
    if (amount < 0n) amount = 0n;
    if (tax.includedInPrice) includedTaxes += amount;
    else outsideTaxes += amount;
    if (tax.cumulative && !tax.includedInPrice) cumulativeBase += amount;
    calculatedTaxes.push({
      ...tax,
      baseCents: toSafeNumber(base, 'Base tributável'),
      amountCents: toSafeNumber(amount, 'Imposto previsto')
    });
  }

  const itemCosts = calculatedItems
    .filter((item) => !item.optional)
    .reduce((sum, item) => sum + BigInt(item.estimatedCostCents), 0n);
  const estimatedCost = itemCosts + ownCosts + reimbursable + passedFees;
  const total = adjustedTotalBeforeTaxes + outsideTaxes;
  const estimatedTaxes = includedTaxes + outsideTaxes;
  const grossFees = subtotalServices;
  const netFees = adjustedServices - estimatedTaxes;
  const consideredRevenue = total - outsideTaxes - reimbursable - passedFees - itemFees;
  const estimatedProfit = consideredRevenue - itemCosts - ownCosts - includedTaxes;
  const margin = consideredRevenue === 0n
    ? null
    : toSafeNumber(signedRoundDiv(estimatedProfit * 10_000n, consideredRevenue), 'Margem');
  const markup = estimatedCost === 0n
    ? null
    : toSafeNumber(signedRoundDiv(estimatedProfit * 10_000n, estimatedCost), 'Markup');
  const nonTaxable = calculatedItems
    .filter((item) => !item.taxable && !item.optional)
    .reduce((sum, item) => sum + BigInt(item.totalCents), 0n)
    + costs.filter((cost) => !cost.taxable && cost.classification !== 'custo_proprio')
      .reduce((sum, cost) => sum + cents(cost.amountCents, 'Valor não tributável'), 0n);

  const warnings: string[] = [];
  if (input.items.length === 0) warnings.push('Adicione pelo menos um item ao orçamento.');
  if (total <= 0n) warnings.push('O total do orçamento deve ser maior que zero para emissão ou aprovação.');
  if (estimatedProfit < 0n) warnings.push('A margem estimada está negativa. Revise custos, descontos e preço.');
  if (total < estimatedCost) warnings.push('O preço está abaixo do custo total estimado.');
  if ((input.taxes || []).length === 0 && taxableBase > 0n) warnings.push('Há base tributável, mas nenhum imposto foi configurado.');

  return {
    items: calculatedItems,
    taxes: calculatedTaxes,
    subtotalServicesCents: toSafeNumber(subtotalServices, 'Subtotal de serviços'),
    subtotalExpensesCents: toSafeNumber(subtotalExpenses, 'Subtotal de despesas'),
    subtotalFeesCents: toSafeNumber(subtotalFees, 'Subtotal de taxas'),
    globalDiscountCents: toSafeNumber(globalDiscount, 'Desconto global'),
    globalAdditionCents: toSafeNumber(globalAddition, 'Acréscimo global'),
    taxableBaseCents: toSafeNumber(taxableBase, 'Base tributável'),
    outsideTaxesCents: toSafeNumber(outsideTaxes, 'Impostos por fora'),
    includedTaxesCents: toSafeNumber(includedTaxes, 'Impostos inclusos'),
    estimatedTaxesCents: toSafeNumber(estimatedTaxes, 'Impostos previstos'),
    totalCents: toSafeNumber(total, 'Total do orçamento'),
    estimatedCostCents: toSafeNumber(estimatedCost, 'Custo total estimado'),
    grossRevenueCents: toSafeNumber(total, 'Receita bruta prevista'),
    grossFeesCents: toSafeNumber(grossFees, 'Honorários brutos'),
    netFeesCents: toSafeNumber(netFees, 'Honorários líquidos'),
    estimatedProfitCents: toSafeNumber(estimatedProfit, 'Lucro estimado'),
    estimatedMarginBasisPoints: margin,
    markupBasisPoints: markup,
    reimbursableCents: toSafeNumber(reimbursable, 'Valor reembolsável'),
    nonTaxableCents: toSafeNumber(nonTaxable, 'Valor não tributável'),
    warnings
  };
}

export interface InstallmentDefinition {
  dueDate?: string | null;
  daysAfterApproval?: number | null;
  valueCents?: number | null;
  percentage?: string | null;
  label?: string | null;
}

export interface CalculatedInstallment {
  number: number;
  dueDate: string;
  valueCents: number;
  label: string;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function splitInstallments(totalCents: number, count: number, approvalDate: string): CalculatedInstallment[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new Error('Total financiável inválido.');
  if (!Number.isInteger(count) || count < 1 || count > 120) throw new Error('Quantidade de parcelas inválida.');
  const total = BigInt(totalCents);
  const base = total / BigInt(count);
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    dueDate: addDays(approvalDate, index * 30),
    valueCents: toSafeNumber(index === count - 1 ? total - base * BigInt(count - 1) : base, 'Parcela'),
    label: `Parcela ${index + 1}/${count}`
  }));
}

export function calculateInstallments(
  totalCents: number,
  definitions: InstallmentDefinition[],
  approvalDate: string
): CalculatedInstallment[] {
  if (definitions.length === 0) return splitInstallments(totalCents, 1, approvalDate);
  const total = BigInt(totalCents);
  let allocated = 0n;
  const installments = definitions.map((definition, index) => {
    const isLast = index === definitions.length - 1;
    let value: bigint;
    if (isLast) {
      value = total - allocated;
    } else if (definition.valueCents !== null && definition.valueCents !== undefined) {
      value = cents(definition.valueCents, 'Valor da parcela');
    } else if (definition.percentage) {
      value = percentOf(total, definition.percentage);
    } else {
      throw new Error(`Informe o valor ou percentual da parcela ${index + 1}.`);
    }
    if (value < 0n) throw new Error('O valor de uma parcela não pode ser negativo.');
    allocated += value;
    return {
      number: index + 1,
      dueDate: definition.dueDate || addDays(approvalDate, definition.daysAfterApproval || 0),
      valueCents: toSafeNumber(value, 'Valor da parcela'),
      label: definition.label?.trim() || `Parcela ${index + 1}/${definitions.length}`
    };
  });
  const sum = installments.reduce((acc, installment) => acc + installment.valueCents, 0);
  if (sum !== totalCents) throw new Error('A soma das parcelas deve corresponder ao total financiável.');
  return installments;
}

export const BudgetAdditionAdjustmentSchema = z.object({
  type: z.enum(['fixo', 'percentual']),
  value: z.string().regex(/^\d+(?:[.,]\d+)?$/, 'Informe um ajuste igual ou maior que zero.')
});

export const BudgetDiscountAdjustmentSchema = BudgetAdditionAdjustmentSchema.superRefine((adjustment, context) => {
  if (adjustment.type !== 'percentual') return;
  try {
    if (percentageToBasisPoints(adjustment.value) > 10_000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'O desconto percentual deve ficar entre 0% e 100%.'
      });
    }
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: 'Informe um percentual válido.'
    });
  }
});

export const BudgetItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().nullable().optional(),
  group: z.string().nullable().optional(),
  stage: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  description: z.string().min(1),
  unit: z.string().min(1),
  quantity: z.string().regex(/^\d+(?:[.,]\d+)?$/),
  unitCostCents: z.number().int().min(0),
  unitPriceCents: z.number().int().min(0),
  discount: BudgetDiscountAdjustmentSchema,
  addition: BudgetAdditionAdjustmentSchema,
  taxable: z.boolean(),
  component: z.enum(['servico', 'despesa', 'taxa_repassada']),
  optional: z.boolean().optional(),
  required: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  order: z.number().int().optional()
});

export const BudgetCostInputSchema = z.object({
  id: z.string().uuid().optional(),
  category: z.string().min(1),
  description: z.string().min(1),
  amountCents: z.number().int().min(0),
  classification: z.enum(['custo_proprio', 'despesa_reembolsavel', 'taxa_repassada']),
  taxable: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  order: z.number().int().optional()
});

export const BudgetTaxInputSchema = z.object({
  id: z.string().uuid().optional(),
  taxId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  acronym: z.string().min(1),
  ratePercent: z.string().regex(/^\d+(?:[.,]\d+)?$/),
  calculationBase: z.enum(['tributavel', 'servicos', 'taxas', 'total']),
  includedInPrice: z.boolean(),
  cumulative: z.boolean().optional(),
  manualAdjustmentCents: z.number().int().optional(),
  adjustmentReason: z.string().nullable().optional()
});

export const InstallmentDefinitionSchema = z.object({
  dueDate: z.string().nullable().optional(),
  daysAfterApproval: z.number().int().min(0).nullable().optional(),
  valueCents: z.number().int().min(0).nullable().optional(),
  percentage: z.string().nullable().optional(),
  label: z.string().nullable().optional()
});

export const BudgetCalculationInputSchema = z.object({
  items: z.array(BudgetItemInputSchema),
  costs: z.array(BudgetCostInputSchema).optional(),
  taxes: z.array(BudgetTaxInputSchema).optional(),
  globalDiscount: BudgetDiscountAdjustmentSchema.optional(),
  globalAddition: BudgetAdditionAdjustmentSchema.optional()
});

export const SERVICE_TYPES = [
  'Levantamento topográfico planimétrico',
  'Levantamento planialtimétrico',
  'Levantamento cadastral',
  'Locação de obra',
  'Nivelamento geométrico',
  'Levantamento com GNSS RTK',
  'Levantamento com estação total',
  'Aerolevantamento e fotogrametria',
  'Georreferenciamento de imóvel rural',
  'Georreferenciamento de imóvel urbano',
  'Desmembramento',
  'Remembramento',
  'Retificação de área',
  'Regularização fundiária',
  'Apoio técnico e consultoria',
  'Outro serviço'
] as const;

export const BUDGET_UNITS = [
  'serviço', 'hora técnica', 'diária', 'hectare', 'metro', 'quilômetro', 'vértice',
  'marco', 'ponto', 'confrontante', 'prancha', 'documento', 'deslocamento',
  'hospedagem', 'unidade personalizada'
] as const;
