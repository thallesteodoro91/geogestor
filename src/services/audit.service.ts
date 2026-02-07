/**
 * @fileoverview Serviço de auditoria para rastreabilidade de ações críticas
 * Registra INSERT, UPDATE, DELETE com dados antigos/novos
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

interface AuditEventParams {
  action: AuditAction;
  entity: string;
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
}

/**
 * Registra um evento de auditoria na tabela audit_logs.
 * Captura automaticamente tenant_id e user_id da sessão atual.
 * Falhas são silenciosas para não bloquear operações do usuário.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const [tenantId, { data: { user } }] = await Promise.all([
      getCurrentTenantId(),
      supabase.auth.getUser(),
    ]);

    if (!tenantId || !user) return;

    await supabase.from('audit_logs' as any).insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId || null,
      old_data: params.oldData || null,
      new_data: params.newData || null,
    });
  } catch (error) {
    console.error('[AuditService] Falha ao registrar log:', error);
  }
}
