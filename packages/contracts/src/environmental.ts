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

export const ENVIRONMENTAL_PHASES = [
  'Levantamento inicial',
  'Documentação',
  'Protocolo',
  'Em análise',
  'Atendimento de exigência',
  'Vistoria',
  'Deferido',
  'Indeferido',
  'Concluído'
] as const;

export const EnvironmentalPhaseSchema = z.enum(ENVIRONMENTAL_PHASES);

export function isRealEnvironmentalDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const nullableDateKey = z.string().trim()
  .refine(isRealEnvironmentalDateKey, 'Informe uma data válida no formato AAAA-MM-DD.')
  .nullable()
  .optional();

export const LicensePayloadBaseSchema = z.object({
  projetoId: z.string().uuid('Selecione um projeto válido.'),
  clienteId: z.string().uuid().nullable().optional(),
  numero: z.string().trim().min(1, 'Informe o número da licença.').max(120),
  protocolo: z.string().trim().max(160).nullable().optional(),
  orgao: z.string().trim().min(1, 'Informe o órgão ambiental.').max(160),
  tipoLicenca: z.string().trim().min(1, 'Selecione o tipo da licença.').max(120),
  dataEmissao: nullableDateKey,
  dataVencimento: z.string().trim().min(1, 'Informe a data de vencimento.')
    .refine(isRealEnvironmentalDateKey, 'Informe uma data válida no formato AAAA-MM-DD.'),
  status: LicenseStatusSchema.default('Em análise'),
  observacoes: z.string().trim().max(2000).nullable().optional()
}).strict();

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
  dataLimite: nullableDateKey,
  periodicidade: z.string().trim().max(120).nullable().optional(),
  responsavel: z.string().trim().max(160).nullable().optional(),
  status: ConditionStatusSchema.default('Pendente'),
  dataCumprimento: nullableDateKey,
  observacoes: z.string().trim().max(2000).nullable().optional(),
  comprovante: z.string().trim().max(1000).nullable().optional()
}).strict();

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
  trabalhoStatus: string;
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
  statusRegistrado: string;
  statusRegistradoReconhecido: boolean;
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

export function isRecognizedLicenseStatus(status?: string | null) {
  if (!status) return false;
  const normalized = status.trim().toLocaleLowerCase('pt-BR');
  return Object.prototype.hasOwnProperty.call(STATUS_ALIASES, normalized);
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
