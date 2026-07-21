import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultBudgetForm, validateBudgetForm } from './budgetForm';
import {
  createProfessionalBudgetPdfDefinition,
  professionalBudgetPdfFileName
} from './budgetPdfGenerator';
import type { BudgetDetail } from './types';

function validForm() {
  const form = createDefaultBudgetForm('client-1');
  form.description = 'Levantamento topográfico executivo';
  form.items[0].description = 'Levantamento planialtimétrico';
  form.items[0].unitPrice = '1.250,00';
  return form;
}

function budgetFixture(): BudgetDetail {
  return {
    id: 'budget-1',
    grupoId: 'group-1',
    versao: 2,
    codigoOrcamento: 'ORC-2026/001',
    status: 'emitido',
    descricao: `Escopo profissional ${'detalhado '.repeat(450)}`,
    anotacoes: 'SIGILO_INTERNO_NOTAS',
    observacoesCliente: 'Acesso ao imóvel mediante agendamento.',
    termosCondicoes: 'Validade e condições comerciais desta proposta.',
    dataEmissao: '2026-07-19',
    validadeAte: '2026-08-03',
    responsavelTecnico: 'Thalles Wesley Teodoro',
    servicoTipo: 'Levantamento topográfico',
    imovelTipo: 'rural',
    imovelNome: 'Fazenda Integração',
    municipio: 'Florianópolis',
    uf: 'SC',
    metodologia: 'GNSS RTK com pontos de apoio físico.',
    entregaveis: 'Planta e memorial descritivo.',
    prazoExecucaoDias: 15,
    clienteId: 'client-1',
    clientId: 'client-1',
    clientName: 'Cliente Ção & Filhos',
    clientDocument: '123.456.789-00',
    clientEmail: 'cliente@teste.local',
    clientPhone: '(48) 99999-9999',
    characterization: {
      estimatedArea: '12,5', areaUnit: 'ha', surveyMethod: 'RTK',
      physicalGroundControl: 'Marco M-01', gnssElectronicBase: 'Receptor GNSS base'
    },
    subtotalServicos: 105_000,
    subtotalDespesas: 0,
    subtotalTaxas: 0,
    impostosPrevistos: 5_000,
    valorReembolsavel: 0,
    valorTotal: 105_000,
    items: [
      {
        id: 'item-1', description: 'Serviço principal', unit: 'serviço', quantity: '1',
        unitCostCents: 20_000, unitPriceCents: 100_000,
        discount: { type: 'fixo', value: '0' }, addition: { type: 'fixo', value: '0' },
        taxable: true, component: 'servico', optional: false, totalCents: 100_000
      },
      {
        id: 'item-2', description: 'Implantação de marco adicional', unit: 'unidade', quantity: '1',
        unitCostCents: 5_000, unitPriceCents: 15_000,
        discount: { type: 'fixo', value: '0' }, addition: { type: 'fixo', value: '0' },
        taxable: true, component: 'servico', optional: true, totalCents: 15_000
      }
    ],
    costs: [{
      id: 'cost-1', category: 'Custo interno', description: 'SIGILO_INTERNO_CUSTO', amountCents: 20_000,
      classification: 'custo_proprio', taxable: false
    }],
    taxes: [{
      id: 'tax-1', name: 'Imposto sobre serviços', acronym: 'ISS', ratePercent: '5',
      calculationBase: 'tributavel', includedInPrice: false, cumulative: false,
      manualAdjustmentCents: 0, baseCents: 100_000, amountCents: 5_000
    }],
    payment: {
      type: 'parcelas', description: 'Entrada e saldo',
      installments: [
        { percentage: '40', daysAfterApproval: 0, label: 'Entrada' },
        { percentage: '60', daysAfterApproval: 30, label: 'Saldo' }
      ],
      interestBasisPoints: 0, fineBasisPoints: 0, earlyDiscountBasisPoints: 0
    },
    history: [],
    versions: [],
    installments: []
  };
}

test('valida campos essenciais, datas e vincula cada erro ao campo correto', () => {
  const form = validForm();
  form.clientId = '';
  form.description = '';
  form.validUntil = '2026-01-01';
  form.issueDate = '2026-01-02';
  const issues = validateBudgetForm(form);
  assert.deepEqual(
    issues.slice(0, 3).map((issue) => issue.fieldId),
    ['budget-description', 'budget-valid-until', 'budget-client']
  );
});

test('exige 100% nas parcelas e justificativa para ajuste tributário manual', () => {
  const form = validForm();
  form.installments = [{ percentage: '90', daysAfterApproval: 0, label: 'Entrada' }];
  form.taxes = [{
    id: 'tax-1', name: 'ISS', acronym: 'ISS', ratePercent: '5', calculationBase: 'tributavel',
    includedInPrice: false, cumulative: false, manualAdjustment: '10,00', adjustmentReason: ''
  }];
  const issues = validateBudgetForm(form);
  assert.ok(issues.some((issue) => issue.fieldId === 'installment-count'));
  assert.ok(issues.some((issue) => issue.fieldId === 'budget-tax-adjustment-reason-0'));
});

test('aceita um rascunho profissionalmente completo', () => {
  assert.deepEqual(validateBudgetForm(validForm()), []);
});

test('valida ajustes globais negativos, percentuais e desconto acima da base', () => {
  const negative = validForm();
  negative.globalAdditionType = 'fixo';
  negative.globalAdditionValue = '-1,00';
  assert.ok(validateBudgetForm(negative).some((issue) => issue.fieldId === 'global-addition' && issue.message.includes('negativo')));

  const excessivePercentage = validForm();
  excessivePercentage.globalDiscountType = 'percentual';
  excessivePercentage.globalDiscountValue = '100,01';
  assert.ok(validateBudgetForm(excessivePercentage).some((issue) => issue.fieldId === 'global-discount' && issue.message.includes('100%')));

  const excessiveFixed = validForm();
  excessiveFixed.globalDiscountType = 'fixo';
  excessiveFixed.globalDiscountValue = '1.250,01';
  assert.ok(validateBudgetForm(excessiveFixed).some((issue) => issue.fieldId === 'global-discount' && issue.message.includes('subtotal faturável')));
});

test('permite acréscimo global superior a 100% e valida desconto por item', () => {
  const highAddition = validForm();
  highAddition.globalAdditionType = 'percentual';
  highAddition.globalAdditionValue = '125';
  assert.deepEqual(validateBudgetForm(highAddition), []);

  const excessiveItemDiscount = validForm();
  excessiveItemDiscount.items[0].discountType = 'fixo';
  excessiveItemDiscount.items[0].discountValue = '1.250,01';
  assert.ok(validateBudgetForm(excessiveItemDiscount).some((issue) => issue.fieldId === 'budget-item-discount-0'));
});

test('definição do PDF preserva conteúdo longo e não expõe custos ou notas internas', () => {
  const budget = budgetFixture();
  const definition = createProfessionalBudgetPdfDefinition(budget, { razao: 'SkyGeo', cor: '#0891b2' });
  const serialized = JSON.stringify(definition);
  assert.equal(definition.pageSize, 'A4');
  assert.match(serialized, /SkyGeo/);
  assert.match(serialized, /Serviço principal/);
  assert.match(serialized, /Implantação de marco adicional/);
  assert.match(serialized, /detalhado detalhado/);
  assert.doesNotMatch(serialized, /SIGILO_INTERNO_NOTAS/);
  assert.doesNotMatch(serialized, /SIGILO_INTERNO_CUSTO/);
  assert.equal(professionalBudgetPdfFileName(budget), 'ORC-2026_001_v2_Cliente_Cao_Filhos.pdf');
});
