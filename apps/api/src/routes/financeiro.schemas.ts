import { z } from 'zod';

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export const isoDateSchema = z.string().refine(isValidIsoDate, 'Data inválida');
export const entityIdSchema = z.string().trim().min(1, 'Identificador é obrigatório').max(100, 'Identificador inválido');
export const nullableDateSchema = isoDateSchema.nullable().optional();
export const centsSchema = z.number().int().min(0).max(9_000_000_000);
export const nullableCentsSchema = centsSchema.nullable().optional();

export const safeHttpUrlSchema = z.string().url().max(2000).refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}, 'Use um link HTTP ou HTTPS válido.');

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
