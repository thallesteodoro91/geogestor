import { z } from 'zod';

export const LICENSE_STATUSES = [
  'Em análise',
  'Válida',
  'Em renovação',
  'Suspensa',
  'Vencida',
  'Encerrada'
] as const;

export const LicenseStatusSchema = z.enum(LICENSE_STATUSES);
export type LicenseStatus = z.infer<typeof LicenseStatusSchema>;

export const CONDITION_STATUSES = [
  'Pendente',
  'Em andamento',
  'Cumprida',
  'Vencida',
  'Dispensada'
] as const;

export const ConditionStatusSchema = z.enum(CONDITION_STATUSES);
export type ConditionStatus = z.infer<typeof ConditionStatusSchema>;

export const LicensePayloadBaseSchema = z.object({
  projetoId: z.string().uuid('Selecione um projeto válido.'),
  clienteId: z.string().uuid().nullable().optional(),
  numero: z.string().trim().min(1, 'Informe o número da licença.').max(120),
  protocolo: z.string().trim().max(160).nullable().optional(),
  orgao: z.string().trim().min(1, 'Informe o órgão ambiental.').max(160),
  tipoLicenca: z.string().trim().min(1, 'Selecione o tipo da licença.').max(120),
  dataEmissao: z.string().nullable().optional(),
  dataVencimento: z.string().min(1, 'Informe a data de vencimento.'),
  status: LicenseStatusSchema.default('Em análise'),
  observacoes: z.string().trim().max(2000).nullable().optional()
});

const validateLicenseDates = (
  data: { dataEmissao?: string | null; dataVencimento?: string | null },
  context: z.RefinementCtx
) => {
  if (data.dataEmissao && data.dataVencimento && data.dataVencimento < data.dataEmissao) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dataVencimento'],
      message: 'O vencimento deve ser posterior ou igual à emissão.'
    });
  }
};

export const LicensePayloadSchema = LicensePayloadBaseSchema.superRefine(validateLicenseDates);
export const LicensePatchPayloadSchema = LicensePayloadBaseSchema.partial().superRefine(validateLicenseDates);

export type LicensePayload = z.infer<typeof LicensePayloadSchema>;

export const ConditionPayloadBaseSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título da condicionante.').max(180),
  descricao: z.string().trim().max(2000).nullable().optional(),
  dataLimite: z.string().nullable().optional(),
  periodicidade: z.string().trim().max(120).nullable().optional(),
  responsavel: z.string().trim().max(160).nullable().optional(),
  status: ConditionStatusSchema.default('Pendente'),
  dataCumprimento: z.string().nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
  comprovante: z.string().trim().max(1000).nullable().optional()
});

const validateConditionCompletion = (
  data: { status?: ConditionStatus; dataCumprimento?: string | null },
  context: z.RefinementCtx
) => {
  if (data.status === 'Cumprida' && !data.dataCumprimento) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dataCumprimento'],
      message: 'Informe a data de cumprimento.'
    });
  }
};

export const ConditionPayloadSchema = ConditionPayloadBaseSchema.superRefine(validateConditionCompletion);
export const ConditionPatchPayloadSchema = ConditionPayloadBaseSchema.partial().superRefine(validateConditionCompletion);

export type ConditionPayload = z.infer<typeof ConditionPayloadSchema>;

export interface EnvironmentalDemandListItem {
  id: string;
  clienteId: string;
  clienteNome: string;
  nome: string;
  tipo: string;
  tipoDemanda: string | null;
  orgaoAmbiental: string | null;
  protocolo: string | null;
  statusFase: string | null;
  status: string | null;
  descricao: string | null;
  dataInicio: string | null;
  dataEntrega: string | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentalDemandListResponse {
  items: EnvironmentalDemandListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface EnvironmentalHistoryItem {
  id: string;
  tipo: string;
  titulo: string | null;
  categoria: string | null;
  descricao: string;
  data: string;
  manual: boolean | null;
  createdAt: string;
}

export interface EnvironmentalDemandDetail extends EnvironmentalDemandListItem {
  propriedadeId: string | null;
  propriedadeNome: string | null;
  history: EnvironmentalHistoryItem[];
}

export interface LicenseCondition {
  id: string;
  licencaId: string;
  titulo: string;
  descricao: string | null;
  dataLimite: string | null;
  periodicidade: string | null;
  responsavel: string | null;
  status: ConditionStatus;
  dataCumprimento: string | null;
  observacoes: string | null;
  comprovante: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseListItem {
  id: string;
  projetoId: string;
  clienteId: string | null;
  clienteNome: string;
  projetoNome: string;
  numero: string;
  protocolo: string | null;
  orgao: string;
  tipoLicenca: string | null;
  dataEmissao: string | null;
  dataVencimento: string;
  status: LicenseStatus;
  statusRegistrado: LicenseStatus;
  observacoes: string | null;
  condicionantesPendentes: number;
  condicionantesVencidas: number;
  proximaCondicionante: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseDetail extends LicenseListItem {
  condicionantes: LicenseCondition[];
  history: EnvironmentalHistoryItem[];
}

const STATUS_ALIASES: Record<string, LicenseStatus> = {
  ativa: 'Válida',
  valido: 'Válida',
  valida: 'Válida',
  válida: 'Válida',
  em_analise: 'Em análise',
  'em analise': 'Em análise',
  'em análise': 'Em análise',
  'em renovacao': 'Em renovação',
  'em renovação': 'Em renovação',
  suspensa: 'Suspensa',
  vencida: 'Vencida',
  encerrada: 'Encerrada'
};

export function normalizeLicenseStatus(status?: string | null): LicenseStatus {
  if (!status) return 'Em análise';
  const normalized = status.trim().toLocaleLowerCase('pt-BR');
  return STATUS_ALIASES[normalized] || 'Em análise';
}

export function resolveEffectiveLicenseStatus(
  status: string | null | undefined,
  expirationDate: string,
  today = new Date()
): LicenseStatus {
  const normalized = normalizeLicenseStatus(status);
  if (normalized === 'Encerrada' || normalized === 'Suspensa') return normalized;
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(today);
  return expirationDate < todayKey ? 'Vencida' : normalized;
}

export function daysUntilDate(date: string, now = new Date()) {
  const target = new Date(`${date}T12:00:00`);
  const current = new Date(now);
  current.setHours(12, 0, 0, 0);
  return Math.ceil((target.getTime() - current.getTime()) / 86_400_000);
}
