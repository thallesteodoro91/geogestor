export const EXPENSE_CATEGORY_LABELS = {
  combustivel: 'Combustível',
  pedagio: 'Pedágio',
  hospedagem: 'Hospedagem',
  alimentacao: 'Alimentação',
  viagem_transporte: 'Viagem e transporte',
  cartorio_taxas: 'Cartório e taxas',
  tributos: 'Tributos',
  equipamentos: 'Equipamentos',
  software_licencas: 'Software e licenças',
  documentos: 'Documentos',
  outros: 'Outros'
} as const;

export type ExpenseCategoryCode = keyof typeof EXPENSE_CATEGORY_LABELS;

const normalizeText = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function normalizeExpenseCategoryCode(value?: string | null): ExpenseCategoryCode {
  const category = normalizeText(value);
  if (category.includes('combust')) return 'combustivel';
  if (category.includes('hosped')) return 'hospedagem';
  if (category.includes('pedag')) return 'pedagio';
  if (category.includes('alimenta')) return 'alimentacao';
  if (category.includes('viagem') || category.includes('transport')) return 'viagem_transporte';
  if (category.includes('cart') || category.includes('emolumento') || category.includes('taxa')) return 'cartorio_taxas';
  if (category.includes('tribut') || category.includes('imposto')) return 'tributos';
  if (category.includes('equip')) return 'equipamentos';
  if (category.includes('software') || category.includes('licen')) return 'software_licencas';
  if (category.includes('document') || category.includes('protocolo')) return 'documentos';
  return 'outros';
}

export function calculateReceiptCash(input: {
  valorPrincipal: number;
  juros?: number;
  multa?: number;
  desconto?: number;
  taxas?: number;
}) {
  const values = {
    valorPrincipal: input.valorPrincipal,
    juros: input.juros || 0,
    multa: input.multa || 0,
    desconto: input.desconto || 0,
    taxas: input.taxas || 0
  };
  for (const [key, value] of Object.entries(values)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${key} deve ser informado em centavos e não pode ser negativo.`);
    }
  }
  if (values.valorPrincipal <= 0) throw new Error('O valor principal deve ser maior que zero.');
  const valorRecebido = values.valorPrincipal + values.juros + values.multa - values.desconto - values.taxas;
  if (valorRecebido <= 0) throw new Error('O valor efetivamente recebido deve ser maior que zero.');
  return { ...values, valorRecebido };
}

export function calculateInstallmentSettlement(valorParcela: number, pagamentosPrincipais: number[]) {
  const valorPago = pagamentosPrincipais.reduce((sum, value) => sum + value, 0);
  if (valorPago < 0 || valorPago > valorParcela) {
    throw new Error('A soma dos recebimentos não pode ultrapassar o valor principal da parcela.');
  }
  return {
    valorPago,
    saldo: valorParcela - valorPago,
    status: valorPago === 0
      ? 'Pendente'
      : valorPago === valorParcela
        ? 'Pago'
        : 'Parcialmente pago'
  } as const;
}
