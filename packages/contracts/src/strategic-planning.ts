import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} é obrigatório.`).max(max, `${label} excede ${max} caracteres.`);
const dateText = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label} deve estar no formato AAAA-MM-DD.`);

export const StrategicCycleStatusSchema = z.enum(['rascunho', 'ativo', 'em_revisao', 'encerrado']);
export const StrategicObjectiveStatusSchema = z.enum(['nao_iniciado', 'em_andamento', 'em_risco', 'concluido', 'cancelado']);
export const StrategicPrioritySchema = z.enum(['baixa', 'media', 'alta', 'critica']);
export const StrategicDirectionSchema = z.enum(['aumentar', 'reduzir', 'manter']);
export const StrategicSourceTypeSchema = z.enum(['manual', 'financeiro', 'crm', 'projetos', 'tarefas']);
export const StrategicConfidenceSchema = z.enum(['baixa', 'media', 'alta']);
export const StrategicFrequencySchema = z.enum(['semanal', 'mensal', 'trimestral', 'semestral', 'anual']);
export const StrategicInitiativeStatusSchema = z.enum(['planejada', 'em_andamento', 'bloqueada', 'concluida', 'cancelada']);
export const StrategicCheckinStatusSchema = z.enum(['no_rumo', 'atencao', 'critico']);
export const StrategicRiskLevelSchema = z.enum(['baixo', 'medio', 'alto', 'critico']);
export const StrategicRiskStatusSchema = z.enum(['aberto', 'mitigando', 'resolvido', 'aceito']);
export const StrategicDecisionStatusSchema = z.enum(['pendente', 'em_andamento', 'concluida', 'cancelada']);

export const StrategicCyclePayloadSchema = z.object({
  nome: requiredText('Nome do ciclo', 160),
  dataInicio: dateText('Data inicial'),
  dataFim: dateText('Data final'),
  visao: requiredText('Direcionamento estratégico', 2_000),
  status: StrategicCycleStatusSchema.default('rascunho'),
  proximaRevisao: dateText('Próxima revisão').nullable().optional()
}).superRefine((value, context) => {
  if (value.dataFim < value.dataInicio) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dataFim'], message: 'A data final deve ser posterior à data inicial.' });
  }
});

export const StrategicCycleUpdateSchema = z.object({
  nome: requiredText('Nome do ciclo', 160).optional(),
  dataInicio: dateText('Data inicial').optional(),
  dataFim: dateText('Data final').optional(),
  visao: requiredText('Direcionamento estratégico', 2_000).optional(),
  status: StrategicCycleStatusSchema.optional(),
  proximaRevisao: dateText('Próxima revisão').nullable().optional()
});

export const StrategicPillarPayloadSchema = z.object({
  cicloId: z.string().uuid(),
  nome: requiredText('Nome do pilar', 120),
  descricao: optionalText(1_000),
  ordem: z.number().int().min(0).max(999).default(0)
});
export const StrategicPillarUpdateSchema = StrategicPillarPayloadSchema.omit({ cicloId: true }).partial();

export const StrategicObjectivePayloadSchema = z.object({
  cicloId: z.string().uuid(),
  pilarId: z.string().uuid(),
  titulo: requiredText('Título do objetivo', 180),
  descricao: optionalText(2_000),
  responsavel: requiredText('Responsável', 160),
  dataLimite: dateText('Prazo'),
  status: StrategicObjectiveStatusSchema.default('nao_iniciado'),
  prioridade: StrategicPrioritySchema.default('media'),
  ordem: z.number().int().min(0).max(999).default(0)
});
export const StrategicObjectiveUpdateSchema = StrategicObjectivePayloadSchema.omit({ cicloId: true }).partial();

const StrategicKeyResultBaseSchema = z.object({
  objetivoId: z.string().uuid(),
  titulo: requiredText('Título do resultado-chave', 180),
  descricao: optionalText(1_000),
  linhaBase: z.number().finite(),
  meta: z.number().finite(),
  valorAtual: z.number().finite().nullable().optional(),
  unidade: requiredText('Unidade', 40),
  direcao: StrategicDirectionSchema.default('aumentar'),
  fonteTipo: StrategicSourceTypeSchema.default('manual'),
  fonteCodigo: optionalText(80),
  fonteRegra: optionalText(500),
  fontePeriodo: optionalText(120),
  fonteRota: optionalText(500),
  frequencia: StrategicFrequencySchema.default('mensal'),
  ultimaAtualizacao: z.string().datetime().nullable().optional(),
  confianca: StrategicConfidenceSchema.default('media')
});
export const StrategicKeyResultPayloadSchema = StrategicKeyResultBaseSchema.superRefine((value, context) => {
  if (value.fonteTipo !== 'manual' && !value.fonteCodigo) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fonteCodigo'], message: 'Selecione uma fonte automática válida.' });
  }
  if (value.fonteTipo === 'manual' && value.valorAtual == null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['valorAtual'], message: 'Informe o valor atual da fonte manual.' });
  }
});
export const StrategicKeyResultUpdateSchema = StrategicKeyResultBaseSchema.omit({ objetivoId: true }).partial();

export const StrategicInitiativePayloadSchema = z.object({
  objetivoId: z.string().uuid(),
  titulo: requiredText('Título da iniciativa', 180),
  descricao: optionalText(2_000),
  responsavel: requiredText('Responsável', 160),
  dataLimite: dateText('Prazo'),
  progresso: z.number().min(0).max(100).default(0),
  status: StrategicInitiativeStatusSchema.default('planejada'),
  orcamentoCentavos: z.number().int().min(0).nullable().optional(),
  dependencias: optionalText(1_000),
  proximoMarco: optionalText(500),
  projetoId: z.string().uuid().nullable().optional(),
  tarefaId: z.string().uuid().nullable().optional()
});
export const StrategicInitiativeUpdateSchema = StrategicInitiativePayloadSchema.omit({ objetivoId: true }).partial();

export const StrategicCheckinPayloadSchema = z.object({
  cicloId: z.string().uuid(),
  objetivoId: z.string().uuid().nullable().optional(),
  data: dateText('Data do check-in'),
  status: StrategicCheckinStatusSchema,
  narrativa: requiredText('Narrativa', 4_000),
  confianca: StrategicConfidenceSchema,
  bloqueios: optionalText(2_000),
  decisoes: optionalText(2_000),
  decisoesPendentes: optionalText(2_000),
  proximosPassos: optionalText(2_000),
  proximaRevisao: dateText('Próxima revisão').nullable().optional()
});
export const StrategicCheckinUpdateSchema = StrategicCheckinPayloadSchema.omit({ cicloId: true }).partial();

export const StrategicRiskPayloadSchema = z.object({
  cicloId: z.string().uuid(),
  objetivoId: z.string().uuid().nullable().optional(),
  iniciativaId: z.string().uuid().nullable().optional(),
  descricao: requiredText('Descrição do risco', 2_000),
  impacto: StrategicRiskLevelSchema,
  probabilidade: StrategicRiskLevelSchema,
  mitigacao: optionalText(2_000),
  responsavel: requiredText('Responsável', 160),
  status: StrategicRiskStatusSchema.default('aberto')
});
export const StrategicRiskUpdateSchema = StrategicRiskPayloadSchema.omit({ cicloId: true }).partial();

export const StrategicDecisionPayloadSchema = z.object({
  cicloId: z.string().uuid(),
  checkinId: z.string().uuid().nullable().optional(),
  objetivoId: z.string().uuid().nullable().optional(),
  descricao: requiredText('Descrição da decisão', 2_000),
  responsavel: requiredText('Responsável', 160),
  prazo: dateText('Prazo'),
  status: StrategicDecisionStatusSchema.default('pendente'),
  concluidaEm: z.string().datetime().nullable().optional(),
  observacaoEncerramento: optionalText(2_000)
}).superRefine((value, context) => {
  if (value.status === 'concluida' && !value.observacaoEncerramento?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['observacaoEncerramento'], message: 'Informe como a decisão foi concluída.' });
  }
});
export const StrategicDecisionUpdateSchema = z.object({
  checkinId: z.string().uuid().nullable().optional(),
  objetivoId: z.string().uuid().nullable().optional(),
  descricao: requiredText('Descrição da decisão', 2_000).optional(),
  responsavel: requiredText('Responsável', 160).optional(),
  prazo: dateText('Prazo').optional(),
  status: StrategicDecisionStatusSchema.optional(),
  concluidaEm: z.string().datetime().nullable().optional(),
  observacaoEncerramento: optionalText(2_000)
});

export type StrategicCyclePayload = z.infer<typeof StrategicCyclePayloadSchema>;
export type StrategicCycleUpdate = z.infer<typeof StrategicCycleUpdateSchema>;
export type StrategicPillarPayload = z.infer<typeof StrategicPillarPayloadSchema>;
export type StrategicPillarUpdate = z.infer<typeof StrategicPillarUpdateSchema>;
export type StrategicObjectivePayload = z.infer<typeof StrategicObjectivePayloadSchema>;
export type StrategicObjectiveUpdate = z.infer<typeof StrategicObjectiveUpdateSchema>;
export type StrategicKeyResultPayload = z.infer<typeof StrategicKeyResultPayloadSchema>;
export type StrategicKeyResultUpdate = z.infer<typeof StrategicKeyResultUpdateSchema>;
export type StrategicInitiativePayload = z.infer<typeof StrategicInitiativePayloadSchema>;
export type StrategicInitiativeUpdate = z.infer<typeof StrategicInitiativeUpdateSchema>;
export type StrategicCheckinPayload = z.infer<typeof StrategicCheckinPayloadSchema>;
export type StrategicCheckinUpdate = z.infer<typeof StrategicCheckinUpdateSchema>;
export type StrategicRiskPayload = z.infer<typeof StrategicRiskPayloadSchema>;
export type StrategicRiskUpdate = z.infer<typeof StrategicRiskUpdateSchema>;
export type StrategicDecisionPayload = z.infer<typeof StrategicDecisionPayloadSchema>;
export type StrategicDecisionUpdate = z.infer<typeof StrategicDecisionUpdateSchema>;

type EntityTimestamps = {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};
export type StrategicCycle = StrategicCyclePayload & EntityTimestamps & { id: string };
export type StrategicPillar = StrategicPillarPayload & EntityTimestamps & { id: string };
export type StrategicObjective = StrategicObjectivePayload & EntityTimestamps & {
  id: string;
  progresso?: number | null;
};
export type StrategicKeyResult = StrategicKeyResultPayload & EntityTimestamps & {
  id: string;
  valorAtual: number | null;
  ultimaAtualizacao: string | null;
  progresso: number | null;
  desatualizado: boolean;
  fonteNome: string;
  estadoDado: 'disponivel' | 'indisponivel' | 'desatualizado';
  formulaProgresso: string;
};
export type StrategicInitiative = StrategicInitiativePayload & EntityTimestamps & {
  id: string;
  atrasada: boolean;
};
export type StrategicCheckin = StrategicCheckinPayload & EntityTimestamps & { id: string };
export type StrategicRisk = StrategicRiskPayload & EntityTimestamps & { id: string };
export type StrategicDecision = StrategicDecisionPayload & EntityTimestamps & {
  id: string;
  atrasada: boolean;
};

export type StrategicTimelineItem = {
  id: string;
  tipo: 'revisao' | 'decisao' | 'risco' | 'iniciativa';
  data: string;
  titulo: string;
  descricao: string;
  status: string;
};

export type StrategicTrendSummary = {
  disponivel: boolean;
  motivo: string | null;
  revisaoAnterior: string | null;
  revisaoAtual: string | null;
  progressoAnterior: number | null;
  progressoAtual: number | null;
  variacaoProgresso: number | null;
  objetivosMelhoraram: Array<{ id: string; titulo: string; variacao: number }>;
  objetivosPioraram: Array<{ id: string; titulo: string; variacao: number }>;
  riscosNovos: number;
  riscosAgravados: number;
  riscosMitigados: number;
  riscosResolvidos: number;
  iniciativasConcluidas: number;
  iniciativasAtrasadas: number;
  iniciativasBloqueadas: number;
  decisoesAbertas: number;
  decisoesConcluidas: number;
  dadosDesatualizados: number;
};

export type StrategicSourceOption = {
  tipo: z.infer<typeof StrategicSourceTypeSchema>;
  codigo: string;
  nome: string;
  regra: string;
  periodo: string;
  rota: string;
  unidade: string;
};

export type StrategicPlanningSnapshot = {
  ciclo: StrategicCycle;
  pilares: StrategicPillar[];
  objetivos: StrategicObjective[];
  resultadosChave: StrategicKeyResult[];
  iniciativas: StrategicInitiative[];
  checkins: StrategicCheckin[];
  riscos: StrategicRisk[];
  decisoes: StrategicDecision[];
  tendencias: StrategicTrendSummary;
  linhaDoTempo: StrategicTimelineItem[];
  resumo: {
    progressoGeral: number | null;
    objetivosEmRisco: number;
    iniciativasAtrasadas: number;
    decisoesPendentes: number;
    dadosDesatualizados: number;
    ultimaRevisao: string | null;
    proximaDecisao: { id: string; descricao: string; prazo: string } | null;
    proximoMarco: { titulo: string; data: string } | null;
  };
};
