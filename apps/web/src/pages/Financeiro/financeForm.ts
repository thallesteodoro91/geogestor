export interface RevenueFormValues {
  clienteId: string;
  projetoId: string;
  valorTotal: string;
  status: string;
  descricao: string;
  anotacoes: string;
  formaDePagamento: string;
  desconto: string;
  codigoOrcamento: string;
  dataCompetencia: string;
  dataPagamento: string;
  impostoValor: string;
  impostoRetido: boolean;
  centroCusto: string;
}

export interface PayableFormValues {
  clienteId: string;
  projetoId: string;
  descricao: string;
  fornecedor: string;
  numeroDocumento: string;
  valor: string;
  data: string;
  dataCompetencia: string;
  dataPagamento: string;
  categoria: string;
  tipoCusto: string;
  centroCusto: string;
  reembolsavel: boolean;
  observacoes: string;
  status: string;
  formaPagamento: string;
}

export const MAX_FINANCIAL_VALUE_CENTS = 99_999_999_999;

export const financialInputToCents = (value: string) => (
  Math.round(Number.parseFloat(value.trim().replace(',', '.')) * 100)
);

function moneyError(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return `Informe ${label}.`;
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(trimmed)) return `Use um formato válido para ${label}, como 1500,00.`;
  const cents = financialInputToCents(trimmed);
  if (!Number.isFinite(cents)) return `Use um formato válido para ${label}, como 1500,00.`;
  if (cents === 0) return `${label[0].toUpperCase()}${label.slice(1)} deve ser maior que zero.`;
  if (cents < 0) return `${label[0].toUpperCase()}${label.slice(1)} não pode ser negativo.`;
  if (cents > MAX_FINANCIAL_VALUE_CENTS) return `${label[0].toUpperCase()}${label.slice(1)} excede o limite permitido.`;
  return undefined;
}

function dateError(value: string, label: string, required: boolean) {
  if (!value) return required ? `Informe ${label}.` : undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return `Informe uma ${label} válida.`;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return `Informe uma ${label} válida.`;
  return undefined;
}

export type RevenueFormErrors = Partial<Record<'clienteId' | 'descricao' | 'valorTotal' | 'dataCompetencia' | 'dataPagamento', string>>;
export type PayableFormErrors = Partial<Record<'descricao' | 'valor' | 'data' | 'dataCompetencia' | 'dataPagamento', string>>;

export function validateRevenueForm(values: RevenueFormValues) {
  const errors: RevenueFormErrors = {};
  if (!values.clienteId) errors.clienteId = 'Selecione o cliente responsável pela receita.';
  if (!values.descricao.trim()) errors.descricao = 'Informe a descrição da receita.';
  errors.valorTotal = moneyError(values.valorTotal, 'o valor da receita');
  errors.dataCompetencia = dateError(values.dataCompetencia, 'data de competência', false);
  errors.dataPagamento = dateError(values.dataPagamento, 'data de pagamento', false);
  Object.keys(errors).forEach((key) => {
    if (!errors[key as keyof RevenueFormErrors]) delete errors[key as keyof RevenueFormErrors];
  });
  return errors;
}

export function validatePayableForm(values: PayableFormValues) {
  const errors: PayableFormErrors = {};
  if (!values.descricao.trim()) errors.descricao = 'Informe a descrição da conta a pagar.';
  errors.valor = moneyError(values.valor, 'o valor da conta');
  errors.data = dateError(values.data, 'data de vencimento', true);
  errors.dataCompetencia = dateError(values.dataCompetencia, 'data de competência', false);
  errors.dataPagamento = dateError(values.dataPagamento, 'data de pagamento', false);
  Object.keys(errors).forEach((key) => {
    if (!errors[key as keyof PayableFormErrors]) delete errors[key as keyof PayableFormErrors];
  });
  return errors;
}

export const revenueFormFingerprint = (values: RevenueFormValues) => JSON.stringify(values);
export const payableFormFingerprint = (values: PayableFormValues) => JSON.stringify(values);

const nullable = (value: string) => value || null;
const optionalMoneyToCents = (value: string) => value ? financialInputToCents(value) : null;

export const buildRevenuePayload = (values: RevenueFormValues) => ({
  clienteId: values.clienteId,
  projetoId: nullable(values.projetoId),
  valorTotal: financialInputToCents(values.valorTotal),
  status: values.status,
  descricao: nullable(values.descricao),
  anotacoes: nullable(values.anotacoes),
  formaDePagamento: nullable(values.formaDePagamento),
  desconto: optionalMoneyToCents(values.desconto),
  codigoOrcamento: nullable(values.codigoOrcamento),
  dataCompetencia: nullable(values.dataCompetencia),
  dataPagamento: nullable(values.dataPagamento),
  impostoValor: optionalMoneyToCents(values.impostoValor),
  impostoRetido: values.impostoRetido,
  centroCusto: nullable(values.centroCusto)
});

export const buildPayablePayload = (values: PayableFormValues) => ({
  clienteId: nullable(values.clienteId),
  projetoId: nullable(values.projetoId),
  descricao: values.descricao,
  fornecedor: nullable(values.fornecedor),
  numeroDocumento: nullable(values.numeroDocumento),
  valor: financialInputToCents(values.valor),
  data: values.data,
  dataCompetencia: values.dataCompetencia || values.data,
  dataPagamento: nullable(values.dataPagamento),
  categoria: values.categoria,
  tipoCusto: nullable(values.tipoCusto),
  centroCusto: nullable(values.centroCusto),
  reembolsavel: values.reembolsavel,
  observacoes: nullable(values.observacoes),
  status: values.status,
  formaPagamento: nullable(values.formaPagamento)
});
