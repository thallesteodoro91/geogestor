/**
 * @fileoverview Serviço de integração com Google Calendar
 * Gerencia conexão OAuth, sincronização, preferências e status
 */

import { supabase } from '@/integrations/supabase/client';
import { getCurrentTenantId } from '@/services/supabase.service';
import type { EventCategory } from '@/lib/calendar/eventCategories';

export interface GoogleCalendarSyncTypes {
  servico?: boolean;
  visita?: boolean;
  orcamento?: boolean;
  vencimento?: boolean;
  financeiro?: boolean;
  reuniao?: boolean;
  tarefa?: boolean;
}

export interface GoogleCalendarStatus {
  connected: boolean;
  last_synced_at: string | null;
  connected_at: string | null;
  selected_calendar_id: string;
  calendar_label: string | null;
  auto_sync_enabled: boolean;
  sync_types: GoogleCalendarSyncTypes;
  connection_status: 'active' | 'needs_reconnect' | string;
  realtime_active?: boolean;
  watch_expires_at?: string | null;
}

export interface GoogleCalendarItem {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor?: string;
}

export async function getGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
  const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
    body: { action: 'status' },
  });

  if (error) {
    console.error('Erro ao verificar status Google Calendar:', error);
    return {
      connected: false,
      last_synced_at: null,
      connected_at: null,
      selected_calendar_id: 'primary',
      calendar_label: null,
      auto_sync_enabled: true,
      sync_types: {},
      connection_status: 'active',
    };
  }

  return data as GoogleCalendarStatus;
}

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

  window.location.href = data.url;
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const { error } = await supabase.functions.invoke('google-calendar-auth', {
    body: { action: 'disconnect' },
  });

  if (error) throw new Error('Erro ao desconectar Google Calendar');
}

export async function listGoogleCalendars(): Promise<GoogleCalendarItem[]> {
  const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
    body: { action: 'list-calendars' },
  });
  if (error) throw new Error('Erro ao listar calendários');
  return (data?.calendars || []) as GoogleCalendarItem[];
}

export async function updateGoogleCalendarPreferences(payload: {
  selected_calendar_id?: string;
  calendar_label?: string;
  auto_sync_enabled?: boolean;
  sync_types?: GoogleCalendarSyncTypes;
}): Promise<void> {
  const { error } = await supabase.functions.invoke('google-calendar-auth', {
    body: { action: 'update-preferences', ...payload },
  });
  if (error) throw new Error('Erro ao salvar preferências');
}

export async function syncEventToGoogle(
  eventId: string,
  eventType: 'orcamento' | 'servico',
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
    body: { action: 'push', event_id: eventId, event_type: eventType },
  });

  if (error) {
    console.error('Erro ao sincronizar com Google Calendar:', error);
  }

  if (data?.skipped) {
    console.log('Sync skipped:', data.reason);
  }
}

export async function deleteEventFromGoogle(
  eventId: string,
  eventType: 'orcamento' | 'servico',
): Promise<void> {
  const { error } = await supabase.functions.invoke('google-calendar-sync', {
    body: { action: 'delete', event_id: eventId, event_type: eventType },
  });
  if (error) console.error('Erro ao remover evento do Google Calendar:', error);
}

export async function fullSyncGoogleCalendar(): Promise<{ synced: number; errors: number }> {
  const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
    body: { action: 'full-sync' },
  });

  if (error) throw new Error('Erro ao sincronizar com Google Calendar');

  return { synced: data?.synced || 0, errors: data?.errors || 0 };
}

export async function startGoogleCalendarWatch(): Promise<void> {
  const { error } = await supabase.functions.invoke('google-calendar-watch', {
    body: { action: 'start' },
  });
  if (error) throw new Error('Erro ao ativar sincronização em tempo real');
}

export async function stopGoogleCalendarWatch(): Promise<void> {
  const { error } = await supabase.functions.invoke('google-calendar-watch', {
    body: { action: 'stop' },
  });
  if (error) throw new Error('Erro ao desativar sincronização em tempo real');
}

export type { EventCategory };
