import { z } from 'zod';
import { LicenseStatusSchema } from './environmental';

export * from './budgets';
export * from './opportunities';
export * from './environmental';
export * from './reports';
export * from './strategic-planning';
export * from './alerts';
export * from './auxiliary-catalogs';
export * from './properties';

export const StatusProjetoSchema = z.enum([
  'Em Andamento',
  'Aguardando Documentação',
  'Em Análise no Órgão',
  'Concluído',
  'Cancelado'
]);
export type StatusProjeto = z.infer<typeof StatusProjetoSchema>;

export const StatusOrcamentoSchema = z.enum([
  'Pendente',
  'Aprovado',
  'Rejeitado',
  'Expirado'
]);
export type StatusOrcamento = z.infer<typeof StatusOrcamentoSchema>;

export const ProjetoPayloadSchema = z.object({
  nome: z.string().trim().min(1, 'Nome do projeto é obrigatório').max(160, 'Use até 160 caracteres no nome do projeto'),
  clienteId: z.string().uuid('Selecione um cliente válido'),
  descricao: z.string().nullable().optional(),
  status: z.string().optional(),
  dataInicio: z.string().nullable().optional(),
  dataEntrega: z.string().nullable().optional(),
  areaHa: z.number().min(0, 'A área não pode ser negativa').nullable().optional(),
  matricula: z.string().nullable().optional(),
  car: z.string().nullable().optional(),
  ccir: z.string().nullable().optional(),
  itr: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  municipio: z.string().nullable().optional(),
  situacaoImovel: z.string().nullable().optional(),
  tipo: z.string().nullable().optional(),
  averbacao: z.string().nullable().optional(),
  latitude: z.number().min(-90, 'Informe uma latitude entre -90 e 90').max(90, 'Informe uma latitude entre -90 e 90').nullable().optional(),
  longitude: z.number().min(-180, 'Informe uma longitude entre -180 e 180').max(180, 'Informe uma longitude entre -180 e 180').nullable().optional(),
  possuiMemorialDescritivo: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
  propriedadeId: z.string().uuid('Selecione um imóvel válido').nullable().optional(),
  orgaoAmbiental: z.string().nullable().optional(),
  tipoDemanda: z.string().nullable().optional(),
  protocolo: z.string().nullable().optional(),
  numeroProcesso: z.string().nullable().optional(),
  numeroLicenca: z.string().nullable().optional(),
  dataEmissao: z.string().nullable().optional(),
  dataVencimentoLicenca: z.string().nullable().optional(),
  tipoLicenca: z.string().nullable().optional(),
  statusLicenca: LicenseStatusSchema.nullable().optional(),
  observacoesLicenca: z.string().max(2000).nullable().optional(),
  tipoPericia: z.string().nullable().optional(),
  dataVistoria: z.string().nullable().optional()
});
export type ProjetoPayload = z.infer<typeof ProjetoPayloadSchema>;

const digitsOnly = (value?: string | null) => (value || '').replace(/\D/g, '');

export const isValidCpf = (value?: string | null) => {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calculateDigit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10]);
};

export const isValidCnpj = (value?: string | null) => {
  const cnpj = digitsOnly(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calculateDigit = (base: string, weights: number[]) => {
    const sum = base
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calculateDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculateDigit(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(cnpj[12]) && second === Number(cnpj[13]);
};

export const isValidBrazilianPhone = (value?: string | null) => {
  const digits = digitsOnly(value);
  return digits.length === 10 || digits.length === 11;
};

export const isValidCep = (value?: string | null) => digitsOnly(value).length === 8;

const ClientPrimaryOriginSchema = z.enum([
  'Site',
  'Indicação',
  'Instagram',
  'Google',
  'WhatsApp',
  'Outro'
]);

export const ClientePayloadBaseSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome completo ou a razão social.'),
  tipoPessoa: z.enum(['PF', 'PJ']).default('PF'),
  documento: z.string().nullable().optional(),
  email: z.string().email('Informe um e-mail válido.').nullable().optional().or(z.literal('')),
  telefone: z.string().nullable().optional(),
  endereco: z.string().nullable().optional(),
  numero: z.string().nullable().optional(),
  semNumero: z.boolean().optional().default(false),
  complemento: z.string().nullable().optional(),
  bairro: z.string().nullable().optional(),
  municipio: z.string().nullable().optional(),
  uf: z.string().max(2, 'Use a sigla da UF com duas letras.').nullable().optional(),
  cep: z.string().nullable().optional(),
  celular: z.string().nullable().optional(),
  celularWhatsapp: z.boolean().optional().default(false),
  cpf: z.string().nullable().optional(),
  rg: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
  inscricaoEstadual: z.string().nullable().optional(),
  origem: z.string().nullable().optional(),
  origemPrincipal: ClientPrimaryOriginSchema.nullable().optional(),
  origemDetalhe: z.string().nullable().optional(),
  indicadoPor: z.string().nullable().optional(),
  categoria: z.string().nullable().optional(),
  perfis: z.string().nullable().optional(),
  anotacoes: z.string().nullable().optional(),
  situacao: z.string().nullable().optional(),
  previsaoEntrega: z.string().nullable().optional(),
  servicos: z.string().nullable().optional()
});

export const ClientePayloadSchema = ClientePayloadBaseSchema.superRefine((data, context) => {
  if (data.tipoPessoa === 'PF' && !isValidCpf(data.cpf)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'Informe um CPF válido com 11 dígitos.' });
  }
  if (data.tipoPessoa === 'PJ' && !isValidCnpj(data.cnpj)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['cnpj'], message: 'Informe um CNPJ válido com 14 dígitos.' });
  }
  if (data.celular && !isValidBrazilianPhone(data.celular)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['celular'], message: 'Informe um celular com DDD e 10 ou 11 dígitos.' });
  }
  if (data.telefone && !isValidBrazilianPhone(data.telefone)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['telefone'], message: 'Informe um telefone com DDD e 10 ou 11 dígitos.' });
  }
  if (!data.celular && !data.telefone) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['celular'], message: 'Informe um celular ou telefone com DDD e 10 ou 11 dígitos.' });
  }
  if (data.celularWhatsapp && !data.celular) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['celularWhatsapp'], message: 'Informe o celular antes de indicar que ele possui WhatsApp.' });
  }
  if (data.cep && !isValidCep(data.cep)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['cep'], message: 'Informe um CEP com 8 dígitos.' });
  }
  if (data.origemPrincipal === 'Indicação' && !data.indicadoPor?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['indicadoPor'], message: 'Informe quem indicou o cliente.' });
  }
  if (data.origemPrincipal === 'Outro' && !data.origemDetalhe?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['origemDetalhe'], message: 'Descreva a origem do cliente.' });
  }
});

export const ClientePatchPayloadSchema = ClientePayloadBaseSchema.partial().superRefine((data, context) => {
  if (data.cpf !== undefined && data.cpf !== null && !isValidCpf(data.cpf)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'Informe um CPF válido com 11 dígitos.' });
  }
  if (data.cnpj !== undefined && data.cnpj !== null && !isValidCnpj(data.cnpj)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['cnpj'], message: 'Informe um CNPJ válido com 14 dígitos.' });
  }
  if (data.celular && !isValidBrazilianPhone(data.celular)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['celular'], message: 'Informe um celular com DDD e 10 ou 11 dígitos.' });
  }
  if (data.telefone && !isValidBrazilianPhone(data.telefone)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['telefone'], message: 'Informe um telefone com DDD e 10 ou 11 dígitos.' });
  }
  if (data.cep && !isValidCep(data.cep)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['cep'], message: 'Informe um CEP com 8 dígitos.' });
  }
  if (data.origemPrincipal === 'Indicação' && !data.indicadoPor?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['indicadoPor'], message: 'Informe quem indicou o cliente.' });
  }
  if (data.origemPrincipal === 'Outro' && !data.origemDetalhe?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['origemDetalhe'], message: 'Descreva a origem do cliente.' });
  }
});
export type ClientePayload = z.infer<typeof ClientePayloadSchema>;

export interface OrcamentoItem {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number; // Em reais ou centavos dependendo do contexto da interface
  total: number;
}

export interface Cliente {
  id: string;
  nome: string;
  tipoPessoa?: 'PF' | 'PJ' | null;
  tipo?: string | null;
  cpfCnpj?: string | null;
  documento?: string | null;
  email?: string | null;
  telefone?: string | null;
  celular?: string | null;
  celularWhatsapp?: boolean | null;
  endereco?: string | null;
  enderecoLegado?: string | null;
  numero?: string | null;
  semNumero?: boolean | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  cpf?: string | null;
  rg?: string | null;
  cnpj?: string | null;
  inscricaoEstadual?: string | null;
  origem?: string | null;
  origemPrincipal?: string | null;
  origemDetalhe?: string | null;
  indicadoPor?: string | null;
  categoria?: string | null;
  categoriaLegada?: string | null;
  perfis?: string | null;
  enderecoValidacao?: 'validado' | 'nao_validado' | 'requer_revisao' | null;
  revisaoCadastral?: boolean | null;
  revisaoMotivos?: string | null;
  observacoes?: string | null;
  anotacoes?: string | null;
  situacao?: string | null;
  previsaoEntrega?: string | null;
  servicos?: string | null;
}

export interface Projeto {
  id: string;
  nome: string;
  clienteId?: string | null;
  descricao?: string | null;
  status?: string;
  dataInicio?: string | null;
  dataEntrega?: string | null;
  areaHa?: number | null;
  matricula?: string | null;
  car?: string | null;
  ccir?: string | null;
  itr?: string | null;
  cidade?: string | null;
  municipio?: string | null;
  situacaoImovel?: string | null;
  tipo?: string | null;
  averbacao?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  possuiMemorialDescritivo?: string | null;
  observacoes?: string | null;
}

export interface Tarefa {
  id: string;
  clienteId?: string | null;
  clienteNome?: string | null;
  projetoId?: string | null;
  projetoNome?: string;
  titulo: string;
  descricao?: string;
  status: string;
  prioridade: string;
  dataLimite?: string;
}

export interface MonthlyCashFlowSummary {
  mes: string;
  receitas: number;
  despesas: number;
  lucro: number;
}

/** @deprecated Use MonthlyCashFlowSummary. Mantido para consumidores legados. */
export type DRE = MonthlyCashFlowSummary;
