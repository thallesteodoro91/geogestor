import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateForm,
  createDefaultBudgetForm,
  emptyBudgetItem,
  formToPayload
} from './budgetForm';

test('preserva cálculos, impostos e flags dos itens após a reorganização visual', () => {
  const requiredItem = {
    ...emptyBudgetItem(),
    description: 'Levantamento de campo',
    quantity: '2',
    unitCost: '400,00',
    unitPrice: '1.000,00',
    discountType: 'percentual' as const,
    discountValue: '10',
    additionType: 'fixo' as const,
    additionValue: '50,00',
    taxable: true,
    optional: false
  };
  const optionalItem = {
    ...emptyBudgetItem(),
    description: 'Produto complementar opcional',
    unitPrice: '500,00',
    taxable: false,
    optional: true
  };
  const form = {
    ...createDefaultBudgetForm('cliente-1'),
    description: 'Proposta de levantamento',
    items: [requiredItem, optionalItem],
    globalDiscountType: 'fixo' as const,
    globalDiscountValue: '100,00',
    globalAdditionType: 'percentual' as const,
    globalAdditionValue: '5',
    taxes: [{
      id: crypto.randomUUID(),
      taxId: '',
      name: 'ISS',
      acronym: 'ISS',
      ratePercent: '5',
      calculationBase: 'servicos' as const,
      includedInPrice: false,
      cumulative: false,
      manualAdjustment: '0,00',
      adjustmentReason: ''
    }]
  };

  const result = calculateForm(form);
  const payload = formToPayload(form);

  assert.equal(result.items[0].subtotalCents, 200_000);
  assert.equal(result.items[0].discountCents, 20_000);
  assert.equal(result.items[0].additionCents, 5_000);
  assert.equal(result.items[0].totalCents, 185_000);
  assert.equal(result.items[1].totalCents, 50_000);
  assert.equal(result.subtotalServicesCents, 185_000, 'item opcional não entra no subtotal');
  assert.ok(result.estimatedTaxesCents > 0);
  assert.ok(result.taxes[0].amountCents > 0);
  assert.ok(result.totalCents > result.subtotalServicesCents);
  assert.equal(payload.items[0].unitCostCents, 40_000);
  assert.equal(payload.items[0].discount.type, 'percentual');
  assert.equal(payload.items[0].addition.type, 'fixo');
  assert.equal(payload.items[0].taxable, true);
  assert.equal(payload.items[1].optional, true);
  assert.equal(payload.items[1].taxable, false);
  assert.equal(payload.taxes?.[0]?.acronym, 'ISS');
});
