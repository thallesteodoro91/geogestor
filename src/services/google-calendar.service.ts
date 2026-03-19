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

  // Open OAuth popup
  const popup = window.open(data.url, 'google-calendar-auth', 'width=500,height=700,scrollbars=yes');

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'google-calendar-success') {
        window.removeEventListener('message', handleMessage);
        resolve();
      } else if (event.data?.type === 'google-calendar-error') {
        window.removeEventListener('message', handleMessage);
        reject(new Error(event.data.error || 'Falha na autorização'));
      }
    };

    window.addEventListener('message', handleMessage);

    // Timeout after 5 minutes
    setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      if (popup && !popup.closed) popup.close();
      reject(new Error('Tempo limite de autorização excedido'));
    }, 5 * 60 * 1000);

    // Check if popup was closed without completing
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        // Give a small delay for the message to arrive
        setTimeout(() => {
          window.removeEventListener('message', handleMessage);
        }, 2000);
      }
    }, 500);
  });
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
