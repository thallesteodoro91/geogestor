import { z } from 'zod';

export const OPPORTUNITY_STAGES = ['Prospectado', 'Contato', 'Proposta', 'Ganho', 'Perdido'] as const;
export const ACTIVE_OPPORTUNITY_STAGES = ['Prospectado', 'Contato', 'Proposta'] as const;
export const TERMINAL_OPPORTUNITY_STAGES = ['Ganho', 'Perdido'] as const;

export const OpportunityStageSchema = z.enum(OPPORTUNITY_STAGES);
export type OpportunityStage = z.infer<typeof OpportunityStageSchema>;

export const OPPORTUNITY_STAGE_PROBABILITY_BASIS_POINTS: Record<OpportunityStage, number> = {
  Prospectado: 1_000,
  Contato: 3_000,
  Proposta: 6_500,
  Ganho: 10_000,
  Perdido: 0
};

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use uma data válida no formato AAAA-MM-DD').nullable().optional();

const OpportunityFieldsSchema = z.object({
  clienteId: z.string().min(1).nullable().optional(),
  leadId: z.string().min(1).nullable().optional(),
  titulo: z.string().trim().min(1, 'Informe o título do negócio').max(200),
  valorEstimado: z.number().int().min(0).max(9_000_000_000_000).nullable().optional(),
  responsavel: optionalText(120),
  origem: optionalText(120),
  servicoTipo: optionalText(160),
  proximaAcao: optionalText(240),
  proximaAcaoEm: optionalDate,
  previsaoFechamento: optionalDate,
  probabilidadePontosBase: z.number().int().min(0).max(10_000).optional(),
  observacoes: optionalText(4_000),
  orcamentoId: z.string().min(1).nullable().optional()
});

export const OpportunityPayloadSchema = OpportunityFieldsSchema.superRefine((payload, context) => {
  const subjects = Number(Boolean(payload.clienteId)) + Number(Boolean(payload.leadId));
  if (subjects !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['clienteId'],
      message: 'Selecione um cliente ou um lead'
    });
  }
  if (payload.leadId && payload.orcamentoId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['orcamentoId'],
      message: 'Converta o lead em cliente antes de vincular um orçamento'
    });
  }
});
export type OpportunityPayload = z.infer<typeof OpportunityPayloadSchema>;

export const OpportunityUpdateSchema = OpportunityFieldsSchema.partial().refine(
  (payload) => Object.keys(payload).length > 0,
  'Informe ao menos um campo para atualização'
);
export type OpportunityUpdate = z.infer<typeof OpportunityUpdateSchema>;

export const OpportunityReorderItemSchema = z.object({
  id: z.string().min(1),
  estagio: OpportunityStageSchema,
  ordem: z.number().int().min(0)
});
export const OpportunityReorderSchema = z.array(OpportunityReorderItemSchema).min(1).max(1_000);

export const OpportunityTransitionSchema = z.object({
  estagio: OpportunityStageSchema,
  ordem: z.number().int().min(0).optional(),
  motivo: optionalText(1_000),
  encerradoEm: optionalDate
}).superRefine((payload, context) => {
  if (payload.estagio === 'Perdido' && !payload.motivo?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['motivo'], message: 'Informe o motivo da perda' });
  }
});
export type OpportunityTransition = z.infer<typeof OpportunityTransitionSchema>;

export const OpportunityLinkBudgetSchema = z.object({
  orcamentoId: z.string().min(1, 'Selecione um orçamento')
});

export const OpportunityConvertProjectSchema = z.object({
  nomeProjeto: z.string().trim().min(1).max(200).optional()
});

export interface OpportunityListItem {
  id: string;
  clienteId: string | null;
  leadId: string | null;
  clienteNome: string;
  leadNome: string | null;
  vinculoTipo: 'cliente' | 'lead';
  titulo: string;
  valorEstimado: number | null;
  estagio: OpportunityStage;
  ordem: number;
  responsavel: string | null;
  origem: string | null;
  servicoTipo: string | null;
  proximaAcao: string | null;
  proximaAcaoEm: string | null;
  previsaoFechamento: string | null;
  probabilidadePontosBase: number;
  observacoes: string | null;
  motivoPerda: string | null;
  encerradoEm: string | null;
  ultimoContatoEm: string | null;
  orcamentoId: string | null;
  orcamentoCodigo: string | null;
  orcamentoStatus: string | null;
  projetoId: string | null;
  projetoNome: string | null;
  estagioAlteradoEm: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityAnalytics {
  total: number;
  activeCount: number;
  wonCount: number;
  lostCount: number;
  openPipelineCents: number;
  weightedPipelineCents: number;
  wonValueCents: number;
  conversionBasisPoints: number;
  overdueNextActions: number;
  staleOpportunities: number;
  counts: Record<OpportunityStage, number>;
  values: Record<OpportunityStage, number>;
  averageDaysInStage: Record<OpportunityStage, number>;
}

export function isTerminalOpportunityStage(stage: OpportunityStage) {
  return (TERMINAL_OPPORTUNITY_STAGES as readonly string[]).includes(stage);
}

export function isActiveOpportunityStage(stage: OpportunityStage) {
  return (ACTIVE_OPPORTUNITY_STAGES as readonly string[]).includes(stage);
}

export function opportunityStageProbability(stage: OpportunityStage) {
  return OPPORTUNITY_STAGE_PROBABILITY_BASIS_POINTS[stage];
}
