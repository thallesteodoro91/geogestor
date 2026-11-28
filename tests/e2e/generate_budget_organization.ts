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
  for (const scenario of ['simples', 'decimal', 'aliquota-precisa', 'multiplas-paginas', 'textos-extremos', 'opcionais-vazios', 'logo-horizontal', 'logo-vertical', 'logo-quadrada', 'sem-logo', 'rascunho', 'tributos-fronteira', 'simples-parcelado', 'extensa-parcelado', 'parcelas-valores', 'parcelas-centavos', 'contraste-personalizado', 'tecnica-extensa']) {
    const extreme = scenario === 'textos-extremos';
    const items = Array.from({ length: ['multiplas-paginas', 'extensa-parcelado'].includes(scenario) ? 70 : scenario === 'decimal' ? 4 : 1 }, (_, index) => ({
      id: `item-${index}`, description: `ITEM-${String(index + 1).padStart(3, '0')} — Medição de São João, área técnica e confrontação. ${extreme ? 'Descrição extensa com acentuação, vértices e levantamento. '.repeat(200) : ''} FIM-ITEM-${index + 1}`,
      unit: 'hectare', quantity: scenario === 'decimal' ? '1.234567' : '1', unitCostCents: 999,
      unitPriceCents: scenario === 'aliquota-precisa' ? 1000000 : scenario === 'decimal' ? 10001 + index : scenario === 'parcelas-centavos' ? 123457 : 125000,
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
      imovelNome: scenario === 'opcionais-vazios' ? '' : 'Sítio São João', imovelTipo: 'rural', municipio: scenario === 'opcionais-vazios' ? '' : 'Florianópolis', uf: scenario === 'opcionais-vazios' ? '' : 'SC',
      metodologia: scenario === 'tributos-fronteira' ? 'Método de levantamento e controle de qualidade. '.repeat(25) : scenario === 'opcionais-vazios' ? '' : 'Pontos de apoio físicos no solo e estação base eletrônica GNSS.', entregaveis: scenario === 'opcionais-vazios' ? '' : 'Planta e memorial.',
      prazoExecucaoDias: scenario === 'opcionais-vazios' ? null : 15,
      dataEmissao: '2026-10-10', validadeAte: '2026-11-09', responsavelTecnico: 'Profissional fictício',
      observacoesCliente: extreme ? 'Observação extensa: acesso e agendamento de atividades. '.repeat(220) + 'FIM-OBSERVACOES' : '',
      termosCondicoes: scenario === 'tributos-fronteira' ? 'Condições comerciais aplicáveis.' : extreme ? 'Condições contratuais de execução. '.repeat(180) + 'FIM-TERMOS' : '',
      anotacoes: 'SIGILO_NOTAS', characterization: scenario === 'opcionais-vazios' ? { estimatedArea: '', areaUnit: 'hectare' } : { scopeDescription: 'Levantamento dos limites e feições do imóvel para elaboração de planta cadastral.', estimatedArea: '12.345678', areaUnit: 'ha' },
      items: calculation.items, costs, taxes: calculation.taxes,
      subtotalServicos: calculation.subtotalServicesCents, subtotalDespesas: calculation.subtotalExpensesCents,
      subtotalTaxas: calculation.subtotalFeesCents, valorTotal: calculation.totalCents,
      descontoGlobalTipo: globalDiscount.type, descontoGlobalValor: globalDiscount.value,
      acrescimoGlobalTipo: globalAddition.type, acrescimoGlobalValor: globalAddition.value,
      payment: {
        type: extreme || scenario.includes('parcelado') || scenario.startsWith('parcelas-') ? 'parcelas' : 'avista',
        description: extreme ? 'Condição extensa '.repeat(180) + 'FIM-PAGAMENTO' : '', paymentMethod: 'PIX', financialAccount: 'CONTA_INTERNA_NAO_EXPORTAR',
        installments: scenario === 'parcelas-valores' ? [{ valueCents: Math.floor(calculation.totalCents / 2), dueDate: '2026-11-10', label: 'Entrada' }, { valueCents: calculation.totalCents - Math.floor(calculation.totalCents / 2), dueDate: '2026-12-10', label: 'Saldo' }]
          : scenario === 'parcelas-centavos' ? [{ percentage: '50', daysAfterApproval: 0, label: 'Entrada' }, { percentage: '50', daysAfterApproval: 30, label: 'Saldo' }]
          : scenario.includes('parcelado') ? [{ percentage: '40', daysAfterApproval: 0, label: 'Entrada' }, { percentage: '60', daysAfterApproval: 30, label: 'Saldo' }]
          : [{ percentage: '100', daysAfterApproval: 0, label: 'Pagamento' }],
        interestBasisPoints: 0, fineBasisPoints: 0, earlyDiscountBasisPoints: 0
      },
      history: [], versions: [], installments: []
    } as BudgetDetail;
    if (scenario === 'tecnica-extensa') {
      budget.characterization!.scopeDescription = 'Escopo técnico extenso: levantamento dos limites, feições e confrontações do imóvel. '.repeat(80) + 'FIM-ESCOPO';
      budget.metodologia = 'Metodologia de campo: medição, processamento e controle de qualidade do levantamento. '.repeat(90) + 'FIM-METODOLOGIA';
      budget.entregaveis = 'Entregável técnico: planta cadastral e memorial descritivo com identificação dos vértices. '.repeat(60) + 'FIM-ENTREGAVEIS';
    }
    if (scenario === 'simples') budget.characterization!.executionStart = { type: 'approval' };
    if (scenario.includes('parcelado')) budget.characterization!.executionStart = { type: 'initial_payment' };
    if (scenario === 'parcelas-valores') budget.characterization!.executionStart = { type: 'custom', description: 'Liberação de acesso ao imóvel e entrega dos documentos pelo cliente.' };
    const company = { razao: extreme ? 'Empresa de Topografia São João '.repeat(6) : 'Empresa fictícia — Cartografia', cor: scenario === 'contraste-personalizado' ? '#777777' : '#059669', endereco: 'Rua da Medição, Florianópolis — SC',
      conselhoProfissional: 'CREA-SC', registroProfissional: '000000-0',
      ...(scenario.startsWith('logo-') || scenario.includes('parcelado') || scenario === 'simples' ? { logo: `data:image/png;base64,${fs.readFileSync(path.join(output, scenario.startsWith('logo-') ? `${scenario}.png` : 'logo-horizontal.png')).toString('base64')}` } : {}) };
    const definition = createProfessionalBudgetPdfDefinition(budget, company);
    fs.writeFileSync(path.join(output, `${scenario}.json`), JSON.stringify({ budget, company, calculation }, null, 2));
    const buffer = await make.createPdf(definition).getBuffer();
    fs.writeFileSync(path.join(output, `${scenario}.pdf`), buffer);
    console.log(`${scenario}: ${buffer.length} bytes, ${budget.valorTotal} centavos`);
  }
}
void main();
