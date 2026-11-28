import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { calculateBudget } from '../../packages/contracts/src/budgets';
import { createProfessionalBudgetPdfDefinition } from '../../apps/web/src/pages/Orcamentos/budgetPdfGenerator';
import type { BudgetDetail } from '../../apps/web/src/pages/Orcamentos/types';

const output = path.resolve(process.argv[2]);
const requireWeb = createRequire(path.resolve('apps/web/package.json'));
const make = requireWeb('pdfmake/build/pdfmake');
const fonts = requireWeb('pdfmake/build/vfs_fonts');
make.addVirtualFileSystem(fonts.pdfMake?.vfs || fonts.vfs || fonts);
fs.mkdirSync(output, { recursive: true });

async function main() {
  for (const scenario of ['simples', 'decimal', 'aliquota-precisa', 'multiplas-paginas', 'textos-extremos', 'opcionais-vazios', 'logo-horizontal', 'logo-vertical', 'logo-quadrada', 'sem-logo', 'rascunho', 'tributos-fronteira']) {
    const extreme = scenario === 'textos-extremos';
    const items = Array.from({ length: scenario === 'multiplas-paginas' ? 70 : scenario === 'decimal' ? 4 : 1 }, (_, index) => ({
      id: `item-${index}`, description: `ITEM-${String(index + 1).padStart(3, '0')} — Medição de São João, área técnica e confrontação. ${extreme ? 'Descrição extensa com acentuação, vértices e levantamento. '.repeat(200) : ''} FIM-ITEM-${index + 1}`,
      unit: 'hectare', quantity: scenario === 'decimal' ? '1.234567' : '1', unitCostCents: 999,
      unitPriceCents: scenario === 'aliquota-precisa' ? 1000000 : scenario === 'decimal' ? 10001 + index : 125000,
      discount: { type: 'percentual' as const, value: scenario === 'decimal' ? '10' : '0' },
      addition: { type: 'fixo' as const, value: scenario === 'decimal' ? '57' : '0' },
      taxable: true, component: 'servico' as const, optional: index === 3,
      notes: 'NOTA_ITEM_INTERNA_NAO_EXPORTAR', totalCents: 0
    }));
    const costs = scenario === 'decimal' ? [
      { id: 'own', category: 'Equipe', description: 'SIGILO_CUSTO', amountCents: 5000, classification: 'custo_proprio' as const, taxable: false },
      { id: 'refund', category: 'Viagem', description: 'Despesa reembolsável', amountCents: 3000, classification: 'despesa_reembolsavel' as const, taxable: true },
      { id: 'fee', category: 'Taxas', description: 'Taxa repassada', amountCents: 1500, classification: 'taxa_repassada' as const, taxable: false }
    ] : [];
    const taxes = scenario === 'aliquota-precisa' ? [
      { id: 'precise', name: 'Tributo de teste', acronym: 'EXT', ratePercent: '5.555', calculationBase: 'tributavel' as const, includedInPrice: false, cumulative: false, manualAdjustmentCents: 0 }
    ] : scenario === 'decimal' ? [
      { id: 'iss', name: 'ISS', acronym: 'ISS', ratePercent: '5.555', calculationBase: 'servicos' as const, includedInPrice: true, cumulative: false, manualAdjustmentCents: 0 },
      { id: 'out', name: 'Tributo', acronym: 'EXT', ratePercent: '3', calculationBase: 'tributavel' as const, includedInPrice: false, cumulative: false, manualAdjustmentCents: 3, adjustmentReason: 'SIGILO_JUSTIFICATIVA' }
    ] : [];
    const globalDiscount = { type: 'fixo' as const, value: scenario === 'decimal' ? '852' : '0' };
    const globalAddition = { type: 'percentual' as const, value: scenario === 'decimal' ? '7.5' : '0' };
    const calculation = calculateBudget({ items, costs, taxes, globalDiscount, globalAddition });
    const budget = {
      id: scenario, grupoId: scenario, versao: 1, codigoOrcamento: 'ORC-2026-AUDITORIA', status: scenario === 'rascunho' ? 'rascunho' : 'emitido',
      clienteId: 'ficticio', clientId: 'ficticio', clientName: extreme ? 'Associação de São João '.repeat(10) : 'Cliente fictício — São João',
      clientDocument: 'Documento fictício', clientEmail: 'teste@example.invalid', clientPhone: '(48) 99999-0000',
      descricao: 'Proposta fictícia para auditoria', servicoTipo: extreme ? 'Serviço cadastral '.repeat(100) : 'Levantamento cadastral',
      metodologia: scenario === 'tributos-fronteira' ? 'Método de levantamento e controle de qualidade. '.repeat(25) : scenario === 'opcionais-vazios' ? '' : 'Pontos de apoio físicos no solo e estação base eletrônica GNSS.', entregaveis: scenario === 'opcionais-vazios' ? '' : 'Planta e memorial.',
      prazoExecucaoDias: scenario === 'opcionais-vazios' ? null : 15,
      dataEmissao: '2026-10-10', validadeAte: '2026-11-09', responsavelTecnico: 'Profissional fictício',
      observacoesCliente: extreme ? 'Observação extensa: acesso e agendamento de atividades. '.repeat(220) + 'FIM-OBSERVACOES' : '',
      termosCondicoes: scenario === 'tributos-fronteira' ? 'Condições comerciais aplicáveis.' : extreme ? 'Condições contratuais de execução. '.repeat(180) + 'FIM-TERMOS' : '',
      anotacoes: 'SIGILO_NOTAS', characterization: scenario === 'opcionais-vazios' ? {} : { estimatedArea: '12.345678', areaUnit: 'ha' },
      items: calculation.items, costs, taxes: calculation.taxes,
      subtotalServicos: calculation.subtotalServicesCents, subtotalDespesas: calculation.subtotalExpensesCents,
      subtotalTaxas: calculation.subtotalFeesCents, valorTotal: calculation.totalCents,
      descontoGlobalTipo: globalDiscount.type, descontoGlobalValor: globalDiscount.value,
      acrescimoGlobalTipo: globalAddition.type, acrescimoGlobalValor: globalAddition.value,
      payment: extreme ? { type: 'parcelas', description: 'Condição extensa '.repeat(180), installments: [{ valueCents: calculation.totalCents, dueDate: '2026-12-10', label: 'Pagamento' }], interestBasisPoints: 0, fineBasisPoints: 0, earlyDiscountBasisPoints: 0 } : null,
      history: [], versions: [], installments: []
    } as BudgetDetail;
    const company = { razao: extreme ? 'Empresa de Topografia São João '.repeat(6) : 'Empresa fictícia — Cartografia', cor: '#059669', endereco: 'Rua da Medição, Florianópolis — SC',
      ...(scenario.startsWith('logo-') ? { logo: `data:image/png;base64,${fs.readFileSync(path.join(output, `${scenario}.png`)).toString('base64')}` } : {}) };
    const definition = createProfessionalBudgetPdfDefinition(budget, company);
    fs.writeFileSync(path.join(output, `${scenario}.json`), JSON.stringify({ budget, company, calculation }, null, 2));
    const buffer = await make.createPdf(definition).getBuffer();
    fs.writeFileSync(path.join(output, `${scenario}.pdf`), buffer);
    console.log(`${scenario}: ${buffer.length} bytes, ${budget.valorTotal} centavos`);
  }
}
void main();
