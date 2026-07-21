import { db } from '../db';
import { schema } from '@geogestor/database';
import crypto from 'crypto';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(senha|password|secret|token|cpf|cnpj|documento|email|telefone|celular|endereco|cep|rg|inscricao)/i;

function sanitizeAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[MAX_DEPTH]';
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitizeAuditValue(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : sanitizeAuditValue(item, depth + 1)
    ]));
  }
  if (typeof value === 'string' && value.length > 4_000) return `${value.slice(0, 4_000)}[TRUNCATED]`;
  return value;
}

export class AuditLogService {
  static async log(
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'DELETE (SOFT)', 
    entity: string, 
    oldData?: any, 
    newData?: any,
    dbOrTx: any = db
  ) {
    try {
      await (dbOrTx || db).insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        action,
        entity,
        userId: 'admin',
        oldData: oldData ? JSON.stringify(sanitizeAuditValue(oldData)) : null,
        newData: newData ? JSON.stringify(sanitizeAuditValue(newData)) : null
      });
    } catch (err) {
      console.error('Erro ao salvar log de auditoria:', err);
      if (dbOrTx !== db) throw err;
    }
  }
}
