import { z } from 'zod';

const auditLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  entity: z.string(),
  userId: z.string(),
  oldData: z.string().nullable(),
  newData: z.string().nullable(),
  createdAt: z.string()
});

const auditPageSchema = z.object({
  items: z.array(auditLogSchema),
  page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
  summary: z.object({
    inserts: z.number().int().nonnegative(),
    updates: z.number().int().nonnegative(),
    deletes: z.number().int().nonnegative()
  })
});

export type AuditLog = z.infer<typeof auditLogSchema>;
export type AuditPage = z.infer<typeof auditPageSchema>;

export function parseAuditPage(value: unknown, params: URLSearchParams): AuditPage {
  // Older local services return the entire history as an array.
  if (Array.isArray(value)) {
    const result = z.array(auditLogSchema).safeParse(value);
    if (result.success) {
      const action = params.get('action');
      const entity = params.get('entity');
      const logs = result.data.filter((log) => (!action || log.action === action) && (!entity || log.entity === entity));
      const limit = Math.max(1, Number(params.get('limit')) || 50);
      const totalPages = Math.max(1, Math.ceil(logs.length / limit));
      const page = Math.min(totalPages, Math.max(1, Number(params.get('page')) || 1));
      return {
        items: logs.slice((page - 1) * limit, page * limit),
        page, total: logs.length, totalPages,
        summary: {
          inserts: logs.filter((log) => log.action === 'INSERT').length,
          updates: logs.filter((log) => log.action === 'UPDATE').length,
          deletes: logs.filter((log) => log.action === 'DELETE').length
        }
      };
    }
  } else {
    const result = auditPageSchema.safeParse(value);
    if (result.success) return result.data;
  }

  throw new Error('Resposta de auditoria inválida. Verifique se o serviço local está atualizado.');
}
