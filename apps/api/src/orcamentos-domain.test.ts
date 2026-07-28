import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateBudget,
  calculateInstallments,
  splitInstallments,
  type BudgetCalculationInput,
  type BudgetItemInput
} from '@geogestor/contracts';

const item = (overrides: Partial<BudgetItemInput> = {}): BudgetItemInput => ({
  description: 'Levantamento GNSS RTK',
  unit: 'serviço',
  quantity: '1',
  unitCostCents: 4_000,
  unitPriceCents: 10_000,
  discount: { type: 'fixo', value: '0' },
  addition: { type: 'fixo', value: '0' },
  taxable: true,
  component: 'servico',
  ...overrides
});

const calculate = (overrides: Partial<BudgetCalculationInput> = {}) => calculateBudget({
  items: [item()],
  costs: [],
  taxes: [],
  globalDiscount: { type: 'fixo', value: '0' },
  globalAddition: { type: 'fixo', value: '0' },
  ...overrides
});

test('calcula item com quantidade decimal e arredondamento determinístico em centavos', () => {
  const result = calculate({ items: [item({ quantity: '1.5', unitPriceCents: 10_001 })] });
  assert.equal(result.items[0].subtotalCents, 15_002);
  assert.equal(result.totalCents, 15_002);
});

test('aplica descontos fixo e percentual e acréscimos sem ponto flutuante monetário', () => {
  const fixed = calculate({ items: [item({ discount: { type: 'fixo', value: '1000' } })] });
  assert.equal(fixed.items[0].discountCents, 1_000);
  assert.equal(fixed.totalCents, 9_000);

  const percentage = calculate({
    items: [item({ discount: { type: 'percentual', value: '10' }, addition: { type: 'percentual', value: '5' } })],
    globalDiscount: { type: 'percentual', value: '10' },
    globalAddition: { type: 'fixo', value: '250' }
  });
  assert.equal(percentage.items[0].discountCents, 1_000);
  assert.equal(percentage.items[0].additionCents, 500);
  assert.equal(percentage.globalDiscountCents, 950);
  assert.equal(percentage.globalAdditionCents, 250);
  assert.equal(percentage.totalCents, 8_800);
});

test('recusa ajustes negativos e desconto percentual acima de 100%', () => {
  assert.throws(() => calculate({
    globalDiscount: { type: 'percentual', value: '-1' }
  }), /Desconto não pode ser negativo/);

  assert.throws(() => calculate({
    globalDiscount: { type: 'percentual', value: '100,01' }
  }), /entre 0% e 100%/);

  assert.throws(() => calculate({
    globalAddition: { type: 'fixo', value: '-1' }
  }), /Acréscimo não pode ser negativo/);
});

test('permite desconto de 100% e mantém o total exatamente em zero', () => {
  const result = calculate({
    globalDiscount: { type: 'percentual', value: '100' }
  });
  assert.equal(result.globalDiscountCents, 10_000);
  assert.equal(result.totalCents, 0);
  assert.equal(result.estimatedMarginBasisPoints, null);
});

test('permite acréscimo percentual acima de 100% sem impor limite comercial arbitrário', () => {
  const result = calculate({ globalAddition: { type: 'percentual', value: '125' } });
  assert.equal(result.globalAdditionCents, 12_500);
  assert.equal(result.totalCents, 22_500);
});

test('distingue imposto incluso no preço de imposto cobrado por fora', () => {
  const included = calculate({
    items: [item({ unitPriceCents: 11_000 })],
    taxes: [{
      name: 'ISS incluso', acronym: 'ISS', ratePercent: '10', calculationBase: 'tributavel', includedInPrice: true
    }]
  });
  assert.equal(included.includedTaxesCents, 1_000);
  assert.equal(included.outsideTaxesCents, 0);
  assert.equal(included.totalCents, 11_000);

  const outside = calculate({
    taxes: [{
      name: 'ISS por fora', acronym: 'ISS', ratePercent: '10', calculationBase: 'tributavel', includedInPrice: false
    }]
  });
  assert.equal(outside.outsideTaxesCents, 1_000);
  assert.equal(outside.totalCents, 11_000);
  assert.equal(outside.netFeesCents, 10_000);
  assert.equal(included.netFeesCents, 10_000);

  assert.throws(() => calculate({
    taxes: [{
      name: 'ISS ajustado', acronym: 'ISS', ratePercent: '5', calculationBase: 'tributavel',
      includedInPrice: false, manualAdjustmentCents: 100
    }]
  }), /Justifique o ajuste manual/);

  const adjusted = calculate({
    taxes: [{
      name: 'ISS ajustado', acronym: 'ISS', ratePercent: '5', calculationBase: 'tributavel',
      includedInPrice: false, manualAdjustmentCents: 100, adjustmentReason: 'Regra municipal específica'
    }]
  });
  assert.equal(adjusted.estimatedTaxesCents, 600);
});

test('calcula lucro, margem e markup percentual com custo estimado', () => {
  const result = calculate({ items: [item({ unitCostCents: 6_000 })] });
  assert.equal(result.estimatedProfitCents, 4_000);
  assert.equal(result.estimatedMarginBasisPoints, 4_000);
  assert.equal(result.markupBasisPoints, 6_667);
});

test('separa custos próprios, reembolsáveis, taxas repassadas e valores não tributáveis', () => {
  const result = calculate({
    items: [
      item({ unitPriceCents: 10_000, unitCostCents: 3_000 }),
      item({ description: 'Cópias', unitPriceCents: 500, unitCostCents: 0, component: 'despesa', taxable: false })
    ],
    costs: [
      { category: 'Equipe', description: 'Auxiliar', amountCents: 1_000, classification: 'custo_proprio' },
      { category: 'Viagem', description: 'Combustível', amountCents: 2_000, classification: 'despesa_reembolsavel', taxable: false },
      { category: 'Taxas', description: 'Emolumentos', amountCents: 1_500, classification: 'taxa_repassada', taxable: false }
    ]
  });
  assert.equal(result.subtotalExpensesCents, 2_500);
  assert.equal(result.subtotalFeesCents, 1_500);
  assert.equal(result.reimbursableCents, 2_000);
  assert.equal(result.nonTaxableCents, 4_000);
  assert.equal(result.totalCents, 14_000);
  assert.equal(result.estimatedCostCents, 7_500);
});

test('mantém item opcional cotado sem incluí-lo no total, custo ou base tributável', () => {
  const result = calculate({
    items: [
      item({ unitPriceCents: 10_000, unitCostCents: 3_000 }),
      item({ description: 'Serviço opcional', unitPriceCents: 5_000, unitCostCents: 2_000, optional: true })
    ]
  });
  assert.equal(result.items[1].totalCents, 5_000);
  assert.equal(result.totalCents, 10_000);
  assert.equal(result.estimatedCostCents, 3_000);
  assert.equal(result.taxableBaseCents, 10_000);
});

test('trata orçamento sem custo, margem negativa e total zero', () => {
  const noCost = calculate({ items: [item({ unitCostCents: 0 })] });
  assert.equal(noCost.markupBasisPoints, null);
  assert.equal(noCost.estimatedProfitCents, 10_000);

  const negative = calculate({ items: [item({ unitCostCents: 12_000 })] });
  assert.equal(negative.estimatedProfitCents, -2_000);
  assert.equal(negative.estimatedMarginBasisPoints, -2_000);
  assert.ok(negative.warnings.some((warning) => warning.includes('negativa')));

  const zero = calculate({ items: [item({ unitPriceCents: 0, unitCostCents: 0, taxable: false })] });
  assert.equal(zero.totalCents, 0);
  assert.equal(zero.estimatedMarginBasisPoints, null);
  assert.ok(zero.warnings.some((warning) => warning.includes('maior que zero')));
});

test('divide parcelas preservando a soma exata e corrige o residual na última', () => {
  const installments = splitInstallments(10_000, 3, '2026-07-13');
  assert.deepEqual(installments.map((entry) => entry.valueCents), [3_333, 3_333, 3_334]);
  assert.deepEqual(installments.map((entry) => entry.dueDate), ['2026-07-13', '2026-08-12', '2026-09-11']);
  assert.equal(installments.reduce((sum, entry) => sum + entry.valueCents, 0), 10_000);

  const percentages = calculateInstallments(10_001, [
    { percentage: '50', daysAfterApproval: 0, label: 'Entrada' },
    { percentage: '50', daysAfterApproval: 30, label: 'Entrega' }
  ], '2026-07-13');
  assert.deepEqual(percentages.map((entry) => entry.valueCents), [5_001, 5_000]);
  assert.equal(percentages.reduce((sum, entry) => sum + entry.valueCents, 0), 10_001);
});
