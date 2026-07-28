import { calculateBudget, type BudgetCostInput, type BudgetItemInput } from '@geogestor/contracts';

export type LegacyBudgetItem = {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
};

export type LegacyBudgetCost = {
  descricao: string;
  valor: number;
};

export class LegacyFinanceDomainService {
  static calculate(input: {
    requestedTotalCents: number;
    discountCents?: number | null;
    items?: LegacyBudgetItem[];
    costs?: LegacyBudgetCost[];
  }) {
    if (!input.items?.length) {
      const calculation = calculateBudget({
        items: [{
          description: 'Serviço informado no financeiro',
          unit: 'serviço',
          quantity: '1',
          unitCostCents: 0,
          unitPriceCents: input.requestedTotalCents,
          discount: { type: 'fixo', value: '0' },
          addition: { type: 'fixo', value: '0' },
          taxable: false,
          component: 'servico'
        }],
        costs: [],
        taxes: [],
        globalDiscount: { type: 'fixo', value: String(input.discountCents || 0) },
        globalAddition: { type: 'fixo', value: '0' }
      });
      return {
        totalCents: calculation.totalCents,
        itemTotals: calculation.items.map((item) => item.totalCents),
        canonicalCalculationUsed: true
      };
    }

    const items: BudgetItemInput[] = input.items.map((item) => ({
      description: item.descricao,
      unit: 'un',
      quantity: String(item.quantidade),
      unitCostCents: 0,
      unitPriceCents: item.valorUnitario,
      discount: { type: 'fixo', value: '0' },
      addition: { type: 'fixo', value: '0' },
      taxable: false,
      component: 'servico'
    }));
    const costs: BudgetCostInput[] = (input.costs || []).map((cost) => ({
      category: 'Legado',
      description: cost.descricao,
      amountCents: cost.valor,
      classification: 'custo_proprio',
      taxable: false
    }));
    const calculation = calculateBudget({
      items,
      costs,
      taxes: [],
      globalDiscount: { type: 'fixo', value: String(input.discountCents || 0) },
      globalAddition: { type: 'fixo', value: '0' }
    });
    return {
      totalCents: calculation.totalCents,
      itemTotals: calculation.items.map((item) => item.totalCents),
      canonicalCalculationUsed: true
    };
  }
}
