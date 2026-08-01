import { z } from 'zod';

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida');
export const nullableDateSchema = isoDateSchema.nullable().optional();
export const centsSchema = z.number().int().min(0).max(9_000_000_000);
export const nullableCentsSchema = centsSchema.nullable().optional();

export const legacyBudgetItemSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  quantidade: z.number().finite().positive().max(1_000_000),
  valorUnitario: centsSchema,
  // Mantido no contrato por compatibilidade; o valor persistido é recalculado no servidor.
  total: centsSchema
});

export const legacyBudgetCostSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  valor: centsSchema
});
