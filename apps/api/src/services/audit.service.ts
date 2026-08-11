import { db } from '../db';
import { schema } from '@geogestor/database';
import crypto from 'crypto';
import { OperationalLogService } from './operational-log.service';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(senha|password|secret|token|cpf|cnpj|documento|email|telefone|celular|endereco|cep|rg|inscricao|path|pasta|directory|folder|arquivo|filename)/i;

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
  private static failureInjector: ((action: string, entity: string) => void | Promise<void>) | null = null;

  static setFailureInjectorForTests(injector: ((action: string, entity: string) => void | Promise<void>) | null) {
    if (process.env.NODE_ENV !== 'test' && !process.env.GEOGESTOR_DB_PATH?.includes('scratch')) {
      throw new Error('A injeção de falhas de auditoria é permitida somente em ambiente de teste.');
    }
    this.failureInjector = injector;
  }

  static async log(
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'DELETE (SOFT)', 
    entity: string, 
    oldData?: any, 
    newData?: any,
    dbOrTx: any = db
  ) {
    try {
      await this.failureInjector?.(action, entity);
      await (dbOrTx || db).insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        action,
        entity,
        userId: 'admin',
        oldData: oldData ? JSON.stringify(sanitizeAuditValue(oldData)) : null,
        newData: newData ? JSON.stringify(sanitizeAuditValue(newData)) : null
      });
    } catch (err) {
      await OperationalLogService.error('audit-write-failed', { entity, action, error: err });
      if (dbOrTx !== db) throw err;
    }
  }
}
