import { db } from '../db';
import { schema } from '@geogestor/database';
import crypto from 'crypto';

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
        oldData: oldData ? JSON.stringify(oldData) : null,
        newData: newData ? JSON.stringify(newData) : null
      });
    } catch (err) {
      console.error('Erro ao salvar log de auditoria:', err);
    }
  }
}
