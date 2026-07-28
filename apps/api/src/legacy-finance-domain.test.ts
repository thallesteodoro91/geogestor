import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBudget } from '@geogestor/contracts';
import { LegacyFinanceDomainService } from './services/legacy-finance-domain.service';

test('adaptador financeiro legado usa o mesmo cálculo canônico e ignora total de item adulterado', () => {
  const legacy = LegacyFinanceDomainService.calculate({
    requestedTotalCents: 999_999,
    discountCents: 500,
    items: [{ descricao: 'Serviço técnico', quantidade: 2, valorUnitario: 10_000, total: 1 }],
    costs: [{ descricao: 'Custo interno', valor: 2_000 }]
  });
  const canonical = calculateBudget({
    items: [{
      description: 'Serviço técnico',
      unit: 'un',
      quantity: '2',
      unitCostCents: 0,
      unitPriceCents: 10_000,
      discount: { type: 'fixo', value: '0' },
      addition: { type: 'fixo', value: '0' },
      taxable: false,
      component: 'servico'
    }],
    costs: [{
      category: 'Legado',
      description: 'Custo interno',
      amountCents: 2_000,
      classification: 'custo_proprio',
      taxable: false
    }],
    taxes: [],
    globalDiscount: { type: 'fixo', value: '500' },
    globalAddition: { type: 'fixo', value: '0' }
  });
  assert.equal(legacy.totalCents, canonical.totalCents);
  assert.equal(legacy.totalCents, 19_500);
  assert.deepEqual(legacy.itemTotals, [20_000]);
});

test('orçamento legado sem composição aplica desconto no motor canônico', () => {
  const result = LegacyFinanceDomainService.calculate({
    requestedTotalCents: 1_000_000,
    discountCents: 100_000
  });
  assert.equal(result.totalCents, 900_000);
  assert.deepEqual(result.itemTotals, [1_000_000]);
  assert.equal(result.canonicalCalculationUsed, true);
});
