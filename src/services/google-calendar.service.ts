/**
 * @fileoverview Serviço de integração com Google Calendar
 * Gerencia conexão OAuth, sincronização e status
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export interface GoogleCalendarStatus {
  connected: boolean;
  last_synced_at: string | null;
  connected_at: string | null;
}

/**
 * Verifica o status da conexão com o Google Calendar
 */
export async function getGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
  const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
    body: { action: 'status' },
  });

  if (error) {
    console.error('Erro ao verificar status Google Calendar:', error);
    return { connected: false, last_synced_at: null, connected_at: null };
  }

  return data;
}

/**
 * Inicia o fluxo de conexão OAuth com o Google Calendar
 * Abre popup para autorização
 */
export async function connectGoogleCalendar(): Promise<void> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error('Tenant não identificado');

  const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
    body: {
      action: 'get-auth-url',
      tenant_id: tenantId,
      origin: window.location.origin,
    },
  });

  if (error || !data?.url) {
    throw new Error('Erro ao gerar URL de autorização');
  }

  // Full page redirect instead of popup
  window.location.href = data.url;
}

/**
 * Desconecta o Google Calendar
 */
export async function disconnectGoogleCalendar(): Promise<void> {
  const { error } = await supabase.functions.invoke('google-calendar-auth', {
    body: { action: 'disconnect' },
  });

  if (error) throw new Error('Erro ao desconectar Google Calendar');
}

/**
 * Sincroniza um evento específico com o Google Calendar
 */
export async function syncEventToGoogle(
  eventId: string,
  eventType: 'orcamento' | 'servico'
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
    body: { action: 'push', event_id: eventId, event_type: eventType },
  });

  if (error) {
    console.error('Erro ao sincronizar com Google Calendar:', error);
    // Don't throw - sync failure shouldn't block the user's operation
  }

  if (data?.skipped) {
    console.log('Sync skipped:', data.reason);
  }
}

/**
 * Executa sincronização completa de todos os eventos
 */
export async function fullSyncGoogleCalendar(): Promise<{ synced: number; errors: number }> {
  const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
    body: { action: 'full-sync' },
  });

  if (error) throw new Error('Erro ao sincronizar com Google Calendar');

  return { synced: data?.synced || 0, errors: data?.errors || 0 };
}
